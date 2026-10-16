import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://inbox.test',password='inbox-test-password-long';
const pushed:{endpoint:string;body:string}[]=[];
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async(sub:{endpoint:string},body:string)=>{pushed.push({endpoint:sub.endpoint,body});}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.13.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined?'POST':'GET'),headers,body},env);
}
async function register(role:'doctor'|'patient',email:string,name:string){
 const r=await request('/auth/register',{json:{name,email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 const id=(await r.json() as {user:{id:string}}).user.id;
 if(role==='doctor')db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychologist' WHERE id=?").bind(Date.now(),id).run();
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id};
}
const link=(patientId:string,doctorId:string)=>db.binding.prepare('INSERT INTO links (patient_id,doctor_id,accepted_at,revoked_at) VALUES (?,?,?,NULL)').bind(patientId,doctorId,Date.now()).run();
const day=()=>new Date().toISOString().slice(0,10);

it('a linked doctor writes a card entry; the patient is pushed at once and sees it in the card and inbox',async()=>{
 const doctor=await register('doctor','inb-doc@example.com','Жанна Врачева');
 const patient=await register('patient','inb-pat@example.com','Руслан Инбоксов');
 await link(patient.id,doctor.id);
 db.binding.prepare('INSERT INTO push_subscriptions (endpoint,user_id,data,created_at) VALUES (?,?,?,?)').bind('https://fcm.googleapis.com/fcm/send/inbox-'+patient.id,patient.id,JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/inbox-'+patient.id,keys:{p256dh:'p',auth:'a'}}),Date.now()).run();
 const before=pushed.length;
 const made=await app.request(origin+'/api/doctor/patients/'+patient.id+'/card/entries',{method:'POST',headers:{Origin:origin,Cookie:doctor.cookie,'Content-Type':'application/json','CF-Connecting-IP':'10.13.99.1'},body:JSON.stringify({kind:'treatment',body:'Продолжить план практик, через месяц пересмотреть дозу',occurredOn:day()})},env);
 expect(made.status).toBe(201);
 expect(pushed.length).toBe(before+1);
 expect(pushed.at(-1)?.body).toContain('Врач добавил запись');
 const inbox=await (await request('/inbox',{cookie:patient.cookie})).json() as {unread:number;items:{body:string;read:boolean}[]};
 expect(inbox.unread).toBeGreaterThan(0);
 expect(inbox.items[0].body).toContain('карточку');
 expect((await request('/inbox/read',{json:{all:true},cookie:patient.cookie})).status).toBe(200);
 expect(((await (await request('/inbox',{cookie:patient.cookie})).json()) as {unread:number}).unread).toBe(0);
 const card=await (await request('/patient/card',{cookie:patient.cookie})).json() as {entries:{kindLabel:string;authorName:string;body:string}[];history:{type:string}[]};
 expect(card.entries[0].authorName).toBe('Жанна Врачева');
 expect(card.entries[0].body).toContain('план практик');
 expect(card.history.map(h=>h.type)).toContain('entry');
 // the doctor's own view of the card
 const mine=await (await request('/doctor/patients/'+patient.id+'/card',{cookie:doctor.cookie})).json() as {entries:{mine:boolean}[]};
 expect(mine.entries[0].mine).toBe(true);
});

it('entries are append-only: only the author withdraws, once, with a reason; unlinked doctors see nothing',async()=>{
 const author=await register('doctor','inb-auth@example.com','Марина Автор');
 const other=await register('doctor','inb-other@example.com','Павел Чужой');
 const patient=await register('patient','inb-pat2@example.com','Нина Карточкина');
 await link(patient.id,author.id);
 const id=(await (await request('/doctor/patients/'+patient.id+'/card/entries',{json:{kind:'other',body:'Запись с ошибкой',occurredOn:day()},cookie:author.cookie})).json() as {id:string}).id;
 expect((await request('/doctor/patients/'+patient.id+'/card',{cookie:other.cookie})).status).toBe(403);
 expect((await request('/doctor/patients/'+patient.id+'/card/entries',{json:{kind:'other',body:'x',occurredOn:day()},cookie:other.cookie})).status).toBe(403);
 expect((await request('/doctor/card/entries/'+id+'/withdraw',{json:{reason:'Перепутали пациента'},cookie:other.cookie})).status).toBe(409);
 expect((await request('/doctor/card/entries/'+id+'/withdraw',{json:{reason:''},cookie:author.cookie})).status).toBe(400);
 expect((await request('/doctor/card/entries/'+id+'/withdraw',{json:{reason:'Перепутали пациента'},cookie:author.cookie})).status).toBe(200);
 expect((await request('/doctor/card/entries/'+id+'/withdraw',{json:{reason:'ещё раз'},cookie:author.cookie})).status).toBe(409);
 const card=await (await request('/patient/card',{cookie:patient.cookie})).json() as {entries:{withdrawn:boolean;withdrawReason:string;body:string}[]};
 expect(card.entries[0].withdrawn).toBe(true);
 expect(card.entries[0].withdrawReason).toBe('Перепутали пациента');
 expect(card.entries[0].body).toBe('');
 expect((await request('/patient/card',{cookie:author.cookie})).status).toBe(403);
});
