import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://export.test',password='export-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.14.${Math.floor(ip/200)}.${(++ip%200)+1}`};
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

it('the patient export includes the card, doctor entries and visits; deleting the account removes them',async()=>{
 const doctor=await register('doctor','exp-doc@example.com','Гульнара Экспорт');
 const patient=await register('patient','exp-pat@example.com','Ильяс Выгрузкин');
 const now=Date.now();
 db.binding.prepare("INSERT INTO patient_cards (patient_id,created_at) VALUES (?,?)").bind(patient.id,now).run();
 db.binding.prepare("INSERT INTO card_entries (id,patient_id,author_id,kind,body,occurred_on,created_at) VALUES (?,?,?,?,?,?,?)").bind('e-export-1',patient.id,doctor.id,'treatment','Запись для выгрузки','2026-10-16',now).run();
 const exp=await (await request('/account/export',{cookie:patient.cookie})).json() as {data:{card_entries:{body:string}[];patient_cards:unknown[];notices:unknown[];appointment_requests:unknown[]}};
 expect(exp.data.card_entries.map(e=>e.body)).toContain('Запись для выгрузки');
 expect(exp.data.patient_cards).toHaveLength(1);
 expect(Array.isArray(exp.data.notices)).toBe(true);
 expect(Array.isArray(exp.data.appointment_requests)).toBe(true);
 const del=await request('/account',{method:'DELETE',json:{password,confirm:'УДАЛИТЬ'},cookie:patient.cookie});
 expect(del.status).toBe(200);
 const left=await db.binding.prepare('SELECT COUNT(*) AS n FROM card_entries WHERE patient_id=?').bind(patient.id).first<{n:number}>();
 expect(left?.n).toBe(0);
 const card=await db.binding.prepare('SELECT COUNT(*) AS n FROM patient_cards WHERE patient_id=?').bind(patient.id).first<{n:number}>();
 expect(card?.n).toBe(0);
},60000);
