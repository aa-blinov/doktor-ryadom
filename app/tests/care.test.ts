import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {today} from '../src/shared';
import {digest} from '../server/auth';
const db=createDatabase(),mail:{to:string;subject:string;text:string}[]=[],origin='https://care.test',password='sufficiently-long-test-password';
const env={DB:db.binding,ASSETS:{} as Fetcher,MAIL:{send:async(message:typeof mail[number])=>{mail.push(message);}},PUSH_PUBLIC_KEY:'test-key'};
async function request(path:string,body?:unknown,cookie?:string,method?:string){const r=await app.request(origin+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'CF-Connecting-IP':'test-client',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function register(role:string,tag:string){const r=await request('/auth/register',{name:'Тест '+tag,email:tag+'@example.com',password,role,consent:true,adult:true});expect(r.status).toBe(201);return r;}
afterAll(()=>db.close());
it('one-use account tokens, password rotation and complete patient data deletion',async()=>{
 const p=await register('patient','accounts'),id=p.data.user.id;
 const second=await request('/auth/login',{email:p.data.user.email,password});
 expect((await request('/account/verify-email',{},p.cookie)).status).toBe(200);
 const verify=mail.at(-1)!.text.match(/token=([a-f0-9]+)/)![1];
 expect((await request('/auth/verify',{token:verify})).status).toBe(200);expect((await request('/auth/verify',{token:verify})).status).toBe(400);
 expect((await request('/me',undefined,p.cookie)).data.user.email_verified_at).toBeTypeOf('number');
 expect((await request('/auth/forgot',{email:'unknown@example.com'})).data.message).toBe((await request('/auth/forgot',{email:p.data.user.email})).data.message);
 const reset=mail.at(-1)!.text.match(/token=([a-f0-9]+)/)![1];expect(await db.binding.prepare('SELECT token FROM account_tokens WHERE token=?').bind(reset).first()).toBeNull();
 expect((await db.binding.prepare('SELECT token FROM account_tokens WHERE token=?').bind(await digest(reset)).first())).not.toBeNull();
 const newPassword='new-sufficiently-long-password';
 const resets=await Promise.all([request('/auth/reset',{token:reset,password:newPassword}),request('/auth/reset',{token:reset,password:newPassword})]);expect(resets.map(r=>r.status).sort()).toEqual([200,400]);
 expect((await request('/me',undefined,p.cookie)).status).toBe(401);expect((await request('/me',undefined,second.cookie)).status).toBe(401);
 const login=await request('/auth/login',{email:p.data.user.email,password:newPassword});expect(login.status).toBe(200);
 expect((await request('/auth/login',{email:p.data.user.email,password})).status).toBe(401);
 const other=await request('/auth/login',{email:p.data.user.email,password:newPassword});
 expect((await request('/account/password',{currentPassword:newPassword,password},login.cookie)).status).toBe(200);expect((await request('/me',undefined,other.cookie)).status).toBe(401);expect((await request('/me',undefined,login.cookie)).status).toBe(200);
 expect((await request('/patient/checkins',{date:today(),mood:3,sleep:null,anxiety:0,energy:null,functioning:null,sleepContext:null,note:'Synthetic private note',habit:null},login.cookie)).status).toBe(201);
 const exported=await request('/account/export',undefined,login.cookie);expect(exported.data.data.checkins).toHaveLength(1);expect(exported.data.account.password).toBeUndefined();
 expect((await request('/account',{password:'wrong',confirm:'УДАЛИТЬ'},login.cookie,'DELETE')).status).toBe(403);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},login.cookie,'DELETE')).status).toBe(200);
 expect(await db.binding.prepare('SELECT id FROM users WHERE id=?').bind(id).first()).toBeNull();expect((await request('/me',undefined,login.cookie)).status).toBe(401);
},30000);
it('draft, concurrent correction, assigned questionnaires, treatment and immutable reports respect role and consent',async()=>{
 const d=await register('doctor','care-doctor'),p=await register('patient','care-patient'),stranger=await register('doctor','care-stranger'),id=p.data.user.id;
 expect((await request('/doctor/invites',{},d.cookie)).status).toBe(403);
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.data.user.id).run();
 const invite=await request('/doctor/invites',{},d.cookie);expect(invite.status).toBe(201);expect((await request('/patient/accept',{token:invite.data.token,consent:true,adult:true},p.cookie)).status).toBe(200);
 const data=(await request('/patient/data',undefined,p.cookie)).data;
 const entry={date:today(),mood:2,sleep:5,anxiety:0,energy:null,functioning:3,sleepContext:'tired',note:'Original synthetic note',habit:null};
 expect((await request('/patient/draft',{entry,plan:data.plan,step:2},p.cookie,'PUT')).status).toBe(200);expect((await request('/patient/data',undefined,p.cookie)).data.draft.step).toBe(2);
 expect((await request(`/doctor/patients/${id}/data`,undefined,d.cookie)).data.draft).toBeNull();
 expect((await request('/patient/checkins',entry,p.cookie)).status).toBe(201);expect((await request('/patient/data',undefined,p.cookie)).data.draft).toBeNull();
 expect((await request('/patient/draft',{entry,plan:data.plan,step:2},p.cookie,'PUT')).status).toBe(409);
 const assigned=await request(`/doctor/patients/${id}/assessments`,{kind:'gad7',dueDate:today()},d.cookie);expect(assigned.status).toBe(201);
 let a=(await request('/patient/data',undefined,p.cookie)).data.assessments[0];
 expect((await request(`/patient/assessments/${a.id}`,{answers:[0,0]},p.cookie)).status).toBe(400);
 expect((await request(`/patient/assessments/${a.id}`,{answers:[0,1,2,3,0,1,2]},stranger.cookie)).status).toBe(403);
 expect((await request(`/patient/assessments/${a.id}`,{answers:[0,1,2,3,0,1,2]},p.cookie)).status).toBe(201);
 a=(await request('/patient/data',undefined,p.cookie)).data.assessments[0];expect(a.score).toBe(9);expect((await request(`/patient/assessments/${a.id}`,{answers:[0,0,0,0,0,0,0]},p.cookie)).status).toBe(409);
 expect((await request('/doctor/patients',undefined,d.cookie)).data.patients[0].pending_assessments).toBe(1);
 expect((await request(`/doctor/patients/${id}/assessments/${a.id}`,{},d.cookie,'DELETE')).status).toBe(409);
 expect((await request(`/doctor/patients/${id}/assessments/${a.id}/review`,{},d.cookie)).status).toBe(200);
 expect((await request(`/doctor/patients/${id}/followups`,{notes:'Synthetic recommendation',goal:'Synthetic goal',nextDate:today(),contact:'Agreed contact'},d.cookie)).status).toBe(201);
 expect((await request(`/doctor/patients/${id}/medications`,{name:'Synthetic medication',instructions:'Synthetic prescription, not medical advice',startDate:today()},d.cookie)).status).toBe(201);
 const m=(await request('/patient/data',undefined,p.cookie)).data.medications[0];
 expect((await request('/patient/medication-logs',{medicationId:m.id,date:today(),status:'not_needed',note:''},p.cookie)).status).toBe(400);
 expect((await request('/patient/medication-logs',{medicationId:m.id,date:today(),status:'missed',note:''},p.cookie)).status).toBe(200);
 expect((await request('/patient/experiences',{date:today(),note:'Synthetic sensation'},p.cookie)).status).toBe(201);
 expect((await request(`/doctor/patients/${id}/followups`,{notes:'Denied',goal:'',nextDate:null,contact:''},stranger.cookie)).status).toBe(403);
 const sent=await request('/patient/reports',{days:14,endDate:today()},p.cookie);expect(sent.status).toBe(201);
 const live=(await request('/patient/data',undefined,p.cookie)).data.entries[0];
 const edits=await Promise.all([request(`/patient/checkins/${live.id}`,{...entry,note:'Correction A',expectedVersion:1},p.cookie,'PUT'),request(`/patient/checkins/${live.id}`,{...entry,note:'Correction B',expectedVersion:1},p.cookie,'PUT')]);expect(edits.map(r=>r.status).sort()).toEqual([200,409]);
 expect((await request('/patient/data',undefined,p.cookie)).data.entries[0].version).toBe(2);
 expect((await db.binding.prepare('SELECT count(*) AS count FROM checkin_revisions WHERE entry_id=?').bind(live.id).first<{count:number}>())?.count).toBe(1);
 const report=(await request('/patient/data',undefined,p.cookie)).data.reports[0];expect(report.entries[0].note).toBe(entry.note);expect(report.assessments[0].score).toBe(9);expect(report.medicationLogs[0].status).toBe('missed');
 expect((await request('/patient/revoke',{},p.cookie)).status).toBe(200);expect((await request(`/doctor/patients/${id}/data`,undefined,d.cookie)).status).toBe(403);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},d.cookie,'DELETE')).status).toBe(200);
 expect((await request('/patient/data',undefined,p.cookie)).data.medications[0].id).toBe(m.id);expect((await request('/auth/login',{email:d.data.user.email,password})).status).toBe(401);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},p.cookie,'DELETE')).status).toBe(200);
 expect(await db.binding.prepare('SELECT id FROM reports WHERE patient_id=?').bind(id).first()).toBeNull();
},30000);
it('push subscriptions reject arbitrary URLs and move ownership only on explicit subscribe',async()=>{
 const p=await register('patient','push-patient'),q=await register('patient','push-other');
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};
 expect((await request('/notifications/subscribe',{...sub,endpoint:'https://127.0.0.1/private'},p.cookie)).status).toBe(400);
 expect((await request('/notifications/subscribe',sub,p.cookie)).status).toBe(200);
 expect((await request('/notifications/subscribe',sub,q.cookie)).status).toBe(200);
 expect((await request('/notifications',undefined,p.cookie)).data.endpoints).toEqual([]);
 expect((await request('/notifications/unsubscribe',{endpoint:sub.endpoint},p.cookie)).status).toBe(200);expect((await request('/notifications',undefined,q.cookie)).data.endpoints).toHaveLength(1);
 expect((await request('/auth/logout',{endpoint:sub.endpoint},q.cookie)).status).toBe(200);expect(await db.binding.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).first()).toBeNull();
},20000);

it('recovery codes are hashed, tied to email, expire and revoke every active session',async()=>{
 const p=await register('patient','recovery-patient');
 const result=await request('/account/recovery-codes',{password},p.cookie);expect(result.status).toBe(200);expect(result.data.codes).toHaveLength(5);
 const code=result.data.codes[0];expect(await db.binding.prepare('SELECT token FROM account_tokens WHERE token=?').bind(code).first()).toBeNull();
 const newPassword='new-secure-recovery-password';
 expect((await request('/auth/recover-code',{email:'other@example.com',code,password:newPassword})).status).toBe(400);
 expect((await request('/auth/recover-code',{email:p.data.user.email,code,password:newPassword})).status).toBe(200);
 expect((await request('/me',undefined,p.cookie)).status).toBe(401);expect((await request('/auth/recover-code',{email:p.data.user.email,code:result.data.codes[1],password:newPassword})).status).toBe(400);
 expect((await request('/auth/login',{email:p.data.user.email,password:newPassword})).status).toBe(200);
},20000);

it('WHO-5 and PHQ-9 enforce scoring and agreed contact protocol',async()=>{
 const d=await register('doctor','standard-doctor'),p=await register('patient','standard-patient'),id=p.data.user.id;
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.data.user.id).run();
 const invite=await request('/doctor/invites',{},d.cookie);expect((await request('/patient/accept',{token:invite.data.token,consent:true,adult:true},p.cookie)).status).toBe(200);
 expect((await request(`/doctor/patients/${id}/assessments`,{kind:'phq9',dueDate:today()},d.cookie)).status).toBe(400);
 const safety={contact:'Звонок врачу в рабочие часы',reviewNote:'Просмотр в рабочий день; экстренная помощь 112',confirmed:true};
 for(const kind of ['who5','phq9']){
 expect((await request(`/doctor/patients/${id}/assessments`,{kind,dueDate:today(),...(kind==='phq9'?{safety}:{})},d.cookie)).status).toBe(201);
 const a=(await request('/patient/data',undefined,p.cookie)).data.assessments.find((a:any)=>a.kind===kind);
 const answers=kind==='who5'?[5,5,5,5,5]:[0,0,0,0,0,0,0,0,1,3];
 expect((await request(`/patient/assessments/${a.id}`,{answers},d.cookie)).status).toBe(403);
 expect((await request(`/patient/assessments/${a.id}`,{answers},p.cookie)).status).toBe(201);
 const saved=(await request('/patient/data',undefined,p.cookie)).data.assessments.find((x:any)=>x.id===a.id);expect(saved.score).toBe(kind==='who5'?25:1);
 if(kind==='phq9'){expect(saved.safety.contact).toBe(safety.contact);expect((await request('/doctor/patients',undefined,d.cookie)).data.patients[0].pending_safety).toBe(1);expect((await request(`/doctor/patients/${id}/assessments/${a.id}/review`,{},d.cookie)).status).toBe(200);expect((await request('/doctor/patients',undefined,d.cookie)).data.patients[0].pending_safety).toBe(0);}
 }
},30000);
