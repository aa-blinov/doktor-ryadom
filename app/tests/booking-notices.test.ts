import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {deliverQueued,sweepVisits} from '../server/notices';
const db=createDatabase(),origin='https://notices.test',password='notices-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
const HOUR=3600000,DAY=86400000;
const pushed:string[]=[];
const services={publicKey:'k',mail:undefined,push:async(_sub:unknown,body:string)=>{pushed.push(body);}} as unknown as Parameters<typeof deliverQueued>[1];
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.12.${Math.floor(ip/200)}.${(++ip%200)+1}`};
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
const keysFor=async(userId:string)=>(await db.binding.prepare('SELECT key,sent_at FROM notices WHERE user_id=?').bind(userId).all<{key:string;sent_at:number|null}>()).results;
// A slot at a given instant, inserted directly so the test controls the clock.
function slot(doctorId:string,startsAt:number){const id=crypto.randomUUID();db.binding.prepare('INSERT INTO doctor_slots (id,doctor_id,starts_at,minutes) VALUES (?,?,?,?)').bind(id,doctorId,startsAt,30).run();return id;}

it('a booking queues notices for both sides, delivered once, with the clinic clock and no medical text',async()=>{
 const doctor=await register('doctor','ntc-doc@example.com','Наталья Врачева');
 const patient=await register('patient','ntc-pat@example.com','Егор Пациентов');
 db.binding.prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?)').bind(doctor.id,JSON.stringify({timezone:'Asia/Bishkek'}),Date.now()).run();
 const start=Date.now()+5*DAY;
 const slotId=slot(doctor.id,start);
 const book=await request('/patient/appointments',{json:{slotId,reason:'Секретная причина визита'},cookie:patient.cookie});
 expect(book.status).toBe(201);
 const apptId=(await book.json() as {id:string}).id;
 // A browser subscribed to push receives the notices; the endpoint must be an allowed push service.
 db.binding.prepare('INSERT INTO push_subscriptions (endpoint,user_id,data,created_at) VALUES (?,?,?,?)').bind('https://fcm.googleapis.com/fcm/send/notices-test-'+patient.id,patient.id,JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/notices-test-'+patient.id,keys:{p256dh:'p',auth:'a'}}),Date.now()).run();
 const docKeys=await keysFor(doctor.id);
 expect(docKeys.map(k=>k.key)).toContain(`visit:${apptId}:requested:doctor`);
 expect(await request(`/doctor/appointments/${apptId}/confirm`,{json:{},cookie:doctor.cookie})).toBeTruthy();
 const patKeys=await keysFor(patient.id);
 expect(patKeys.map(k=>k.key)).toContain(`visit:${apptId}:confirmed:patient`);
 await deliverQueued(db.binding,services,Date.now());
 const sent=await keysFor(patient.id);
 expect(sent.every(k=>k.sent_at!==null)).toBe(true);
 expect(pushed.every(text=>!text.includes('Секретная'))).toBe(true);
 await deliverQueued(db.binding,services,Date.now());
 expect(pushed.filter(t=>t.includes('подтвердил')).length).toBe(1);
});

it('reminders go to both sides an hour before, and a stale pending request expires',async()=>{
 const doctor=await register('doctor','ntc-doc2@example.com','Тимур Врачев');
 const patient=await register('patient','ntc-pat2@example.com','Аня Пациентова');
 const soon=slot(doctor.id,Date.now()+30*60000);
 const apptId=(await (await request('/patient/appointments',{json:{slotId:soon,reason:''},cookie:patient.cookie})).json() as {id:string}).id;
 await request(`/doctor/appointments/${apptId}/confirm`,{json:{},cookie:doctor.cookie});
 await sweepVisits(db.binding,Date.now());
 expect((await keysFor(doctor.id)).map(k=>k.key)).toContain(`visit:${apptId}:remind1:doctor`);
 expect((await keysFor(patient.id)).map(k=>k.key)).toContain(`visit:${apptId}:remind1:patient`);

 const later=slot(doctor.id,Date.now()+3*DAY);
 const staleId=(await (await request('/patient/appointments',{json:{slotId:later,reason:''},cookie:patient.cookie})).json() as {id:string}).id;
 db.binding.prepare('UPDATE appointment_requests SET created_at=? WHERE id=?').bind(Date.now()-25*HOUR,staleId).run();
 await sweepVisits(db.binding,Date.now());
 const status=await db.binding.prepare('SELECT status FROM appointment_requests WHERE id=?').bind(staleId).first<{status:string}>();
 expect(status?.status).toBe('cancelled');
 expect((await keysFor(patient.id)).map(k=>k.key)).toContain(`visit:${staleId}:expired:patient`);
});

it('the patient card shows the treatment history to the patient only',async()=>{
 const doctor=await register('doctor','card-doc@example.com','Лейла Врачева');
 const patient=await register('patient','card-pat@example.com','Тарас Картов');
 db.binding.prepare("INSERT INTO medications (id,patient_id,doctor_id,name,instructions,as_needed,start_date,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),patient.id,doctor.id,'Тестовый препарат','Одна таблетка утром',0,'2026-10-01',Date.now()).run();
 const s=slot(doctor.id,Date.now()+4*DAY);
 await request('/patient/appointments',{json:{slotId:s,reason:''},cookie:patient.cookie});
 const card=await (await request('/patient/card',{cookie:patient.cookie})).json() as {patient:{name:string};medications:{name:string}[];history:{type:string;title:string}[];note:string};
 expect(card.patient.name).toBe('Тарас Картов');
 expect(card.medications.map(m=>m.name)).toContain('Тестовый препарат');
 expect(card.history.map(h=>h.type)).toContain('visit');
 expect(card.history.find(h=>h.type==='medication')?.title).toContain('Тестовый препарат');
 expect(card.note).toContain('Заметки врача');
 expect((await request('/patient/card',{cookie:doctor.cookie})).status).toBe(403);
});

it('the request keeps the patient zone and the slot list is shown in it; the clinic zone stays on the slot',async()=>{
 const doctor=await register('doctor','zone-doc@example.com','Роза Врачева');
 const patient=await register('patient','zone-pat@example.com','Камиль Зонов');
 db.binding.prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?)').bind(doctor.id,JSON.stringify({timezone:'Europe/Moscow'}),Date.now()).run();
 db.binding.prepare('UPDATE settings SET data=? WHERE user_id=?').bind(JSON.stringify({timezone:'Asia/Oral'}),patient.id).run();
 const s=slot(doctor.id,Date.now()+6*DAY);
 db.binding.prepare("UPDATE doctor_slots SET tz='Europe/Moscow' WHERE id=?").bind(s).run();
 const list=await (await request(`/directory/${doctor.id}/slots`,{cookie:patient.cookie})).json() as {timezone:string;viewerTimezone:string};
 expect(list.viewerTimezone).toBe('Asia/Oral');
 expect(list.timezone).toBe('Europe/Moscow');
 const id=(await (await request('/patient/appointments',{json:{slotId:s,reason:''},cookie:patient.cookie})).json() as {id:string}).id;
 const row=await db.binding.prepare('SELECT r.patient_tz,s.tz FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id WHERE r.id=?').bind(id).first<{patient_tz:string;tz:string}>();
 expect(row?.patient_tz).toBe('Asia/Oral');
 expect(row?.tz).toBe('Europe/Moscow');
 const mine=await (await request('/patient/appointments',{cookie:patient.cookie})).json() as {appointments:{timezone:string}[]};
 expect(mine.appointments[0].timezone).toBe('Asia/Oral');
});
