import { afterAll, describe, expect, it } from 'vitest';
import app from '../server/index';
import { createDatabase } from './db-adapter';
import { today } from '../src/shared';
const db=createDatabase();const env={DB:db.binding,ASSETS:{} as Fetcher};const origin='https://test.local';const password='sufficiently-long-test-password';
async function request(path:string,body?:unknown,cookie?:string,method?:string){const response=await app.request(origin+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);return {status:response.status,data:await response.json() as Record<string,any>,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
afterAll(()=>db.close());
describe('real SQL role and consent workflow',()=>{
 it('persists records and enforces ownership, CSRF and revoked consent',async()=>{
  const register=async(role:string,name:string)=>{const r=await request('/auth/register',{email:name.replaceAll(' ','').toLowerCase()+'@example.com',name,role,password,consent:true});expect(r.status,JSON.stringify(r.data)).toBe(201);if(role==='doctor')await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),r.data.user.id).run();return r;};
  const doctor=await register('doctor','Doctor One'),patient=await register('patient','Patient One'),stranger=await register('doctor','Doctor Two');const id=patient.data.user.id;
  expect((await request('/patient/data')).status).toBe(401);
  expect((await request('/patient/data',undefined,patient.cookie)).data.plan.frequency).toBe('daily');
  expect((await request('/patient/reports',{days:14,endDate:today()},patient.cookie)).status).toBe(403);
  expect((await request('/doctor/patients',undefined,patient.cookie)).status).toBe(403);
  expect((await request(`/doctor/patients/${id}/data`,undefined,doctor.cookie)).status).toBe(403);
  const invite=await request('/doctor/invites',{},doctor.cookie);expect(invite.status).toBe(201);
  expect((await request('/patient/accept',{token:invite.data.token,consent:false},patient.cookie)).status).toBe(400);
  expect((await request('/patient/accept',{token:invite.data.token,consent:true},patient.cookie)).status).toBe(200);
  expect((await request('/invites/'+invite.data.token)).status).toBe(404);
  const entry={date:today(),mood:3,sleep:5,anxiety:0,energy:null,functioning:2,sleepContext:'tired',note:'Synthetic test record',habit:null};
  expect((await request('/patient/checkins',{...entry,functioning:4},patient.cookie)).status).toBe(400);
  expect((await request('/patient/checkins',entry,patient.cookie)).status).toBe(201);
  expect((await request('/patient/checkins',entry,patient.cookie)).status).toBe(409);
  const detail=await request(`/doctor/patients/${id}/data`,undefined,doctor.cookie);expect(detail.status).toBe(200);expect(detail.data.entries[0].anxiety).toBe(0);expect(detail.data.entries[0].sleepContext).toBe('tired');
  expect((await request(`/doctor/patients/${id}/data`,undefined,stranger.cookie)).status).toBe(403);
  const sent=await Promise.all([request('/patient/reports',{days:14,endDate:today()},patient.cookie),request('/patient/reports',{days:14,endDate:today()},patient.cookie)]);
  expect(sent.map(r=>r.status).sort()).toEqual([200,201]);expect(sent[0].data.id).toBe(sent[1].data.id);const reportId=sent[0].data.id;
  expect((await request('/doctor/patients',undefined,doctor.cookie)).data.patients[0].pending_reports).toBe(1);
  expect((await request(`/doctor/patients/${id}/reports/${reportId}/review`,{},stranger.cookie)).status).toBe(403);
  await db.binding.prepare('UPDATE checkins SET note=? WHERE patient_id=?').bind('Changed live note',id).run();
  expect((await request(`/doctor/patients/${id}/data`,undefined,doctor.cookie)).data.reports[0].entries[0].note).toBe('Synthetic test record');
  expect((await request(`/doctor/patients/${id}/reports/${reportId}/review`,{},doctor.cookie)).status).toBe(200);
  expect((await request('/doctor/patients',undefined,doctor.cookie)).data.patients[0].pending_reports).toBe(0);
  expect((await request('/patient/data',undefined,patient.cookie)).data.reports[0].reviewed_at).toBeTypeOf('number');
  const plan={...detail.data.plan,habit:'Synthetic habit',reviewNote:'Просмотр перед приёмом. Срочные вопросы — по согласованному каналу.'};
  expect((await request(`/doctor/patients/${id}/plan`,plan,doctor.cookie,'PUT')).status).toBe(200);
  expect((await request('/patient/data',undefined,patient.cookie)).data.plan.habit).toBe('Synthetic habit');
  expect((await request('/patient/practices',{practiceId:'breath',feedback:'same'},patient.cookie)).status).toBe(403);
  const expanded={...plan,practices:['ground','breath','sounds','kind','values']};
  expect((await request(`/doctor/patients/${id}/plan`,expanded,doctor.cookie,'PUT')).status).toBe(200);
  expect((await request('/patient/practices',{practiceId:'breath',feedback:'same'},patient.cookie)).status).toBe(201);
  expect((await request('/patient/practices',{practiceId:'unknown',feedback:'same'},patient.cookie)).status).toBe(400);
  expect((await request('/patient/practices',{practiceId:'ground',feedback:'unpleasant'},patient.cookie)).status).toBe(201);
  expect((await request('/patient/data',undefined,patient.cookie)).data.settings.blockedPractices).toEqual(['ground']);
  expect((await request('/patient/practices',{practiceId:'ground',feedback:'comfortable'},patient.cookie)).status).toBe(403);
  const csrf=await app.request(origin+'/api/patient/revoke',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json',Cookie:patient.cookie!},body:'{}'},env);expect(csrf.status).toBe(403);
  expect((await request('/patient/revoke',{},patient.cookie)).status).toBe(200);
  expect((await request(`/doctor/patients/${id}/reports/${reportId}/review`,{},doctor.cookie)).status).toBe(403);
  expect((await request('/patient/reports',{days:14,endDate:today()},patient.cookie)).status).toBe(403);
  expect((await request(`/doctor/patients/${id}/data`,undefined,doctor.cookie)).status).toBe(403);
  expect((await request(`/doctor/patients/${id}/plan`,plan,doctor.cookie,'PUT')).status).toBe(403);
  expect((await request('/patient/data',undefined,patient.cookie)).data.entries).toHaveLength(1);
  expect((await request('/auth/logout',{},patient.cookie)).status).toBe(200);
  expect((await request('/me',undefined,patient.cookie)).status).toBe(401);
  const login=await request('/auth/login',{email:'PatientOne@example.com',password});expect(login.status).toBe(200);
  expect((await request('/patient/data',undefined,login.cookie)).data.entries).toHaveLength(1);
 },20000);
});

it('does not assign practices automatically and prevents simultaneous replacement of a doctor',async()=>{
 const register=async(role:string,email:string)=>{const r=await request('/auth/register',{email,name:email.split('@')[0],role,password,consent:true});expect(r.status).toBe(201);if(role==='doctor')await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),r.data.user.id).run();return r;};
 const p=await register('patient','qa-patient@example.com'),d=await register('doctor','qa-doctor@example.com'),other=await register('doctor','qa-other@example.com');
 expect((await request('/patient/data',undefined,p.cookie)).data.plan.practices).toEqual([]);
 expect((await request('/patient/practices',{practiceId:'ground',feedback:'same'},p.cookie)).status).toBe(403);
 const code=(await request('/doctor/invites',{},d.cookie)).data.token,second=(await request('/doctor/invites',{},other.cookie)).data.token;
 const prepare=db.binding.prepare.bind(db.binding);let reads=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 db.binding.prepare=((sql:string)=>{const statement=prepare(sql);if(sql==='SELECT patient_id FROM links WHERE patient_id=? AND revoked_at IS NULL'){const bind=statement.bind.bind(statement);statement.bind=((...values:unknown[])=>{const bound=bind(...values);const first=bound.first.bind(bound);bound.first=(async()=>{const row=await first();if(++reads===2)release();await gate;return row;}) as typeof bound.first;return bound;}) as typeof statement.bind;}return statement;});
 let accepted:Awaited<ReturnType<typeof request>>[];try{accepted=await Promise.all([request('/patient/accept',{token:code,consent:true},p.cookie),request('/patient/accept',{token:second,consent:true},p.cookie)]);}finally{db.binding.prepare=prepare;}

 expect(accepted.map(r=>r.status).sort()).toEqual([200,409]);
 const winner=accepted[0].status===200?d:other;expect((await request('/patient/data',undefined,p.cookie)).data.doctor.id).toBe(winner.data.user.id);
 expect((await request('/patient/data',undefined,p.cookie)).data.plan.practices).toEqual([]);
 await request('/patient/revoke',{},p.cookie);expect((await request('/patient/data',undefined,p.cookie)).data.plan.practices).toEqual([]);
 expect((await request('/patient/accept',{token:second,consent:true},p.cookie)).status).toBe(200);
 const q=await register('patient','qa-invite-one@example.com'),r=await register('patient','qa-invite-two@example.com');const invite=await request('/doctor/invites',{},d.cookie);
 const once=await Promise.all([request('/patient/accept',{token:invite.data.token,consent:true},q.cookie),request('/patient/accept',{token:invite.data.token,consent:true},r.cookie)]);
 expect(once.filter(x=>x.status===200)).toHaveLength(1);expect(once.filter(x=>x.status===409||x.status===404)).toHaveLength(1);
 const connections=await db.binding.prepare('SELECT patient_id FROM links WHERE patient_id IN (?,?) AND revoked_at IS NULL').bind(q.data.user.id,r.data.user.id).all();expect(connections.results).toHaveLength(1);

},20000);
