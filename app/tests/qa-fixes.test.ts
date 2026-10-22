import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
// Regression tests for the defects found by the QA round of 2026-10-21: each one pins the rule that was broken.
const db=createDatabase(),origin='https://fixes.test',password='fixes-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string;raw?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.25.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.raw!==undefined){headers['Content-Type']='application/json';body=init.raw;}
 else if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined||init.raw!==undefined?'POST':'GET'),headers,body},env);
}
const json=async(r:Response)=>await r.json() as any;
async function register(role:'doctor'|'patient',email:string){
 const r=await request('/auth/register',{json:{name:'Кузнецова Ксения',email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 const id=(await json(r)).user.id as string;
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id,email};
}
async function staff(id:string,kind:'psychiatrist'|'psychologist'='psychiatrist'){
 await db.binding.prepare('UPDATE users SET totp_enabled_at=1,specialist_verified_at=?,specialty_kind=? WHERE id=?').bind(Date.now(),kind,id).run();
}
async function admin(id:string){await db.binding.prepare("UPDATE users SET totp_enabled_at=1,role='admin' WHERE id=?").bind(id).run();}
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);

it('an unverified doctor does not reach the cabinet',async()=>{
 const doctor=await register('doctor','fix-unverified@example.com');
 await db.binding.prepare('UPDATE users SET totp_enabled_at=1 WHERE id=?').bind(doctor.id).run();
 expect((await request('/doctor/patients',{cookie:doctor.cookie})).status).toBe(403);
 expect((await request('/doctor/practices',{cookie:doctor.cookie})).status).toBe(403);
 expect((await request('/doctor/invites',{cookie:doctor.cookie})).status).toBe(403);
 // The request for the check stays open, otherwise the doctor could not apply.
 expect((await request('/doctor/verification',{cookie:doctor.cookie})).status).toBe(200);
},60000);

it('a check-in covers today and the two previous days, and only today can be edited',async()=>{
 const patient=await register('patient','fix-diary@example.com');
 const entry={mood:3,sleep:5,anxiety:1,energy:3,functioning:2,sleepContext:'tired',note:'запись',habit:null};
 expect((await request('/patient/checkins',{json:{...entry,date:day(0)},cookie:patient.cookie})).status).toBe(201);
 expect((await request('/patient/checkins',{json:{...entry,date:day(-2)},cookie:patient.cookie})).status).toBe(201);
 expect((await request('/patient/checkins',{json:{...entry,date:day(-3)},cookie:patient.cookie})).status).toBe(400);
 expect((await request('/patient/checkins',{json:{...entry,date:day(2)},cookie:patient.cookie})).status).toBe(400);
 const data=await json(await request('/patient/data',{cookie:patient.cookie}));
 const today=data.entries.find((e:any)=>e.date===day(0));
 const past=data.entries.find((e:any)=>e.date===day(-2));
 expect((await request(`/patient/checkins/${past.id}`,{method:'PUT',json:{...entry,date:day(-2),note:'переписано',expectedVersion:past.version||1},cookie:patient.cookie})).status).toBe(400);
 expect((await request(`/patient/checkins/${today.id}`,{method:'PUT',json:{...entry,date:day(0),note:'исправлено',expectedVersion:today.version||1},cookie:patient.cookie})).status).toBe(200);
},60000);

it('a broken body is a bad request, not a server failure',async()=>{
 const patient=await register('patient','fix-broken@example.com');
 expect((await request('/patient/checkins',{raw:'{не json',cookie:patient.cookie})).status).toBe(400);
},60000);

it('the draft can be read back',async()=>{
 const patient=await register('patient','fix-draft@example.com');
 const entry={date:day(0),mood:0,sleep:5,anxiety:1,energy:3,functioning:2,sleepContext:'tired',note:'черновик',habit:null};
 expect((await request('/patient/draft',{method:'PUT',json:{entry,plan:{frequency:'daily',sleep:true,anxiety:true,energy:false,functioning:true,practices:[],habit:''},step:1},cookie:patient.cookie})).status).toBe(200);
 const draft=await json(await request('/patient/draft',{cookie:patient.cookie}));
 expect(draft.draft.entry.note).toBe('черновик');
},60000);

it('a medication mark is kept once and can be removed by the patient',async()=>{
 const doctor=await register('doctor','fix-med-doc@example.com'),patient=await register('patient','fix-med-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 expect((await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie})).status).toBe(200);
 await request(`/doctor/patients/${patient.id}/medications`,{json:{name:'Препарат',instructions:'по схеме',startDate:day(-1),asNeeded:false},cookie:doctor.cookie});
 const data=await json(await request('/patient/data',{cookie:patient.cookie}));
 const medication=data.medications[0];
 expect((await request('/patient/medication-logs',{json:{medicationId:medication.id,date:day(0),status:'taken',note:''},cookie:patient.cookie})).status).toBe(200);
 expect((await request('/patient/medication-logs',{json:{medicationId:medication.id,date:day(0),status:'missed',note:''},cookie:patient.cookie})).status).toBe(409);
 const after=await json(await request('/patient/data',{cookie:patient.cookie}));
 const log=after.medicationLogs.find((l:any)=>l.date===day(0));
 expect(log.status).toBe('taken');
 expect((await request(`/patient/medication-logs/${log.id}`,{method:'DELETE',cookie:patient.cookie})).status).toBe(200);
});

it('a medication mark is changed atomically, without deleting it first',async()=>{
 const doctor=await register('doctor','fix-med2-doc@example.com'),patient=await register('patient','fix-med2-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie});
 await request(`/doctor/patients/${patient.id}/medications`,{json:{name:'Препарат',instructions:'по схеме',startDate:day(-1),asNeeded:false},cookie:doctor.cookie});
 const data=await json(await request('/patient/data',{cookie:patient.cookie}));
 const medication=data.medications[0];
 expect((await request('/patient/medication-logs',{json:{medicationId:medication.id,date:day(0),status:'taken',note:''},cookie:patient.cookie})).status).toBe(200);
 const after=await json(await request('/patient/data',{cookie:patient.cookie}));
 const log=after.medicationLogs.find((l:any)=>l.date===day(0));
 expect((await request(`/patient/medication-logs/${log.id}`,{method:'PUT',json:{status:'missed',note:'забыл'},cookie:patient.cookie})).status).toBe(200);
 const updated=await json(await request('/patient/data',{cookie:patient.cookie}));
 const changed=updated.medicationLogs.find((l:any)=>l.date===day(0));
 expect(changed.status).toBe('missed');
 expect(updated.medicationLogs.filter((l:any)=>l.date===day(0))).toHaveLength(1);
},60000);

it('a doctor creates a goal for the patient',async()=>{
 const doctor=await register('doctor','fix-goal-doc@example.com'),patient=await register('patient','fix-goal-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie});
 expect((await request(`/doctor/patients/${patient.id}/goals`,{json:{title:'Вести дневник тревоги',reason:'по плану приёма'},cookie:doctor.cookie})).status).toBe(201);
 const data=await json(await request('/patient/data',{cookie:patient.cookie}));
 expect(data.goals.some((g:any)=>g.title==='Вести дневник тревоги')).toBe(true);
},60000);

it('a review is published once and shows the first name',async()=>{
 const doctor=await register('doctor','fix-review-doc@example.com'),patient=await register('patient','fix-review-pat@example.com');
 await staff(doctor.id,'psychologist');
 expect((await request(`/directory/${doctor.id}/review`,{method:'POST',json:{rating:5,body:'Внимательный врач'},cookie:patient.cookie})).status).toBe(201);
 expect((await request(`/directory/${doctor.id}/review`,{method:'PUT',json:{rating:1,body:'Второй'},cookie:patient.cookie})).status).toBe(409);
 const detail=await json(await request(`/directory/${doctor.id}`,{cookie:patient.cookie}));
 expect(detail.reviews[0].author).toBe('Ксения');
 expect((await request(`/directory/${doctor.id}/review`,{method:'DELETE',cookie:patient.cookie})).status).toBe(200);
},60000);

it('the doctor export holds the data of the patients he leads, the patient export hides the clinical notes',async()=>{
 const doctor=await register('doctor','fix-export-doc@example.com'),patient=await register('patient','fix-export-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie});
 await request('/patient/checkins',{json:{date:day(0),mood:3,sleep:5,anxiety:1,energy:3,functioning:2,sleepContext:'tired',note:'отметка',habit:null},cookie:patient.cookie});
 await request(`/doctor/patients/${patient.id}/followups`,{json:{notes:'Рекомендация',goal:'Цель',nextDate:day(3),contact:'Связь',visitAt:null,complaints:'Жалобы',objective:'Объективно',dynamics:'improved',dynamicsNote:'Заметка',diagnosis:'Диагноз'},cookie:doctor.cookie});
 await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:{frequency:'daily',sleep:true,anxiety:true,energy:false,functioning:true,practices:[],habit:''},cookie:doctor.cookie});
 const doctorExport=await json(await request('/account/export',{cookie:doctor.cookie}));
 expect(doctorExport.data.checkins.length).toBeGreaterThan(0);
 expect(doctorExport.data.followups.length).toBeGreaterThan(0);
 expect(doctorExport.data.plans.length).toBeGreaterThan(0);
 const patientExport=await json(await request('/account/export',{cookie:patient.cookie}));
 const followup=typeof patientExport.data.followups[0].data==='string'?JSON.parse(patientExport.data.followups[0].data):patientExport.data.followups[0].data;
 expect(followup.notes).toBe('Рекомендация');
 expect(followup.diagnosis).toBeUndefined();
 expect(followup.complaints).toBeUndefined();
 expect(followup.objective).toBeUndefined();
 expect(followup.dynamicsNote).toBeUndefined();
},60000);

it('a block ends the access of the other side and cannot be undone by an invite',async()=>{
 const doctor=await register('doctor','fix-block-doc@example.com'),patient=await register('patient','fix-block-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie});
 const chief=await register('doctor','fix-block-admin@example.com');
 await admin(chief.id);
 expect((await request(`/admin/accounts/${patient.id}/block`,{json:{blocked:true},cookie:chief.cookie})).status).toBe(200);
 expect((await request(`/doctor/patients/${patient.id}/data`,{cookie:doctor.cookie})).status).toBe(403);
 const second=await register('patient','fix-block-pat2@example.com');
 const blockedInvite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request(`/admin/accounts/${doctor.id}/block`,{json:{blocked:true},cookie:chief.cookie});
 expect((await request('/patient/accept',{json:{token:blockedInvite.token,consent:true,adult:true},cookie:second.cookie})).status).toBe(404);
},60000);

it('a signal of distress reaches the doctor in the inbox',async()=>{
 const doctor=await register('doctor','fix-sos-doc@example.com'),patient=await register('patient','fix-sos-pat@example.com');
 await staff(doctor.id);
 const invite=await json(await request('/doctor/invites',{json:{},cookie:doctor.cookie}));
 await request('/patient/accept',{json:{token:invite.token,consent:true,adult:true},cookie:patient.cookie});
 expect((await request('/patient/sos',{json:{},cookie:patient.cookie})).status).toBe(200);
 const inbox=await json(await request('/inbox',{cookie:doctor.cookie}));
 expect(JSON.stringify(inbox)).toContain('sos');
},60000);

it('the audit keeps the patient as the subject of a check-in',async()=>{
 const patient=await register('patient','fix-audit-pat@example.com');
 const chief=await register('doctor','fix-audit-admin@example.com');
 await admin(chief.id);
 await request('/patient/checkins',{json:{date:day(0),mood:3,sleep:5,anxiety:1,energy:3,functioning:2,sleepContext:'tired',note:'отметка',habit:null},cookie:patient.cookie});
 const audit=await json(await request('/admin/audit?action=save_checkin',{cookie:chief.cookie}));
 expect(audit.events[0].subject_id).toBe(patient.id);
},60000);
