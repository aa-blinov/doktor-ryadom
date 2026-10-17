import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://visit.test',password='visit-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.17.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined?'POST':'GET'),headers,body},env);
}
async function register(role:'doctor'|'patient',email:string){
 const r=await request('/auth/register',{json:{name:'Визит Тест',email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 const id=(await r.json() as {user:{id:string}}).user.id;
 if(role==='doctor')db.binding.prepare("UPDATE users SET totp_enabled_at=1,specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),id).run();
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id};
}

it('the visit record keeps objective and diagnosis for the clinician and hides them from the patient',async()=>{
 const doctor=await register('doctor','visit-doc@example.com');
 const patient=await register('patient','visit-pat@example.com');
 db.binding.prepare('INSERT INTO links (patient_id,doctor_id,accepted_at,revoked_at) VALUES (?,?,?,NULL)').bind(patient.id,doctor.id,Date.now()).run();
 const saved=await request(`/doctor/patients/${patient.id}/followups`,{json:{visitAt:'2026-10-16T10:30',complaints:'Трудно засыпать',objective:'Речь спокойная, контакт есть',dynamics:'improved',dynamicsNote:'Лучше спит четыре ночи из семи',diagnosis:'Тестовый диагноз',notes:'Продолжить дневник сна',goal:'Спать до полуночи',nextDate:null,contact:'Сообщение в приложении'},cookie:doctor.cookie});
 expect(saved.status).toBe(201);
 const forPatient=await (await request('/patient/data',{cookie:patient.cookie})).json() as {followups:{data:Record<string,unknown>}[]};
 const shown=forPatient.followups[0].data;
 expect(shown.notes).toBe('Продолжить дневник сна');
 expect(shown.dynamics).toBe('improved');
 expect(shown).not.toHaveProperty('complaints');
 expect(shown).not.toHaveProperty('objective');
 expect(shown).not.toHaveProperty('diagnosis');
 expect(shown).not.toHaveProperty('visitAt');
 const forDoctor=await (await request(`/doctor/patients/${patient.id}/data`,{cookie:doctor.cookie})).json() as {followups:{data:Record<string,unknown>}[]};
 expect(forDoctor.followups[0].data.objective).toBe('Речь спокойная, контакт есть');
 expect(forDoctor.followups[0].data.diagnosis).toBe('Тестовый диагноз');
});

it('records written before the visit fields existed still read correctly',async()=>{
 const doctor=await register('doctor','visit-old@example.com');
 const patient=await register('patient','visit-old-pat@example.com');
 db.binding.prepare('INSERT INTO links (patient_id,doctor_id,accepted_at,revoked_at) VALUES (?,?,?,NULL)').bind(patient.id,doctor.id,Date.now()).run();
 db.binding.prepare('INSERT INTO followups VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),patient.id,doctor.id,JSON.stringify({notes:'Старая запись',goal:'',nextDate:null,contact:''}),Date.now()).run();
 const forPatient=await (await request('/patient/data',{cookie:patient.cookie})).json() as {followups:{data:{notes:string}}[]};
 expect(forPatient.followups[0].data.notes).toBe('Старая запись');
});
