import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {defaultPlan,today} from '../src/shared';
const db=createDatabase(),origin='https://goals.test',env={DB:db.binding,ASSETS:{} as Fetcher};
const password='test-goals-password-long';
async function request(path:string,body?:unknown,cookie?:string,method?:string){
 const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function register(role:string,tag:string){return request('/auth/register',{name:'Тест '+tag,email:tag+'@example.com',password,role,consent:true,adult:true});}
afterAll(()=>db.close());
it('personal goals, practice feedback and review respect consent, keep snapshots and erase patient data',async()=>{
 const p=await register('patient','goals-patient'),q=await register('patient','goals-other'),d=await register('doctor','goals-doctor'),other=await register('doctor','goals-stranger'),id=p.data.user.id;
 const create=(title:string)=>request('/patient/goals',{title,reason:'Важно для меня'},p.cookie);
 expect((await create(' ')).status).toBe(400);
 for(const title of ['Встречаться с друзьями','Вернуться к прогулкам','Уделять время себе'])expect((await create(title)).status).toBe(201);
 expect((await create('Четвёртая цель')).status).toBe(409);
 const goal=(await request('/patient/data',undefined,p.cookie)).data.goals[0];
 expect((await request(`/patient/goals/${goal.id}/logs`,{status:'step',note:'Небольшой шаг'},q.cookie)).status).toBe(404);
 expect((await request(`/patient/goals/${goal.id}/logs`,{status:'step',note:'Небольшой шаг'},p.cookie)).status).toBe(201);
 expect((await request(`/doctor/patients/${id}/data`,undefined,d.cookie)).status).toBe(403);
 await db.binding.prepare('UPDATE users SET totp_enabled_at=1,specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.data.user.id).run();
 const invite=await request('/doctor/invites',{},d.cookie);
 expect((await request('/patient/accept',{token:invite.data.token,consent:true,adult:true},p.cookie)).status).toBe(200);
 await request(`/doctor/patients/${id}/plan`,{...defaultPlan,practices:['ground']},d.cookie,'PUT');
 expect((await request('/patient/practices',{practiceId:'ground',feedback:'unpleasant',note:'Стало некомфортно, остановился'},p.cookie)).status).toBe(201);
 let data=(await request('/patient/data',undefined,p.cookie)).data;
 const log=data.goalLogs[0],practice=data.practices[0];expect(practice.note).toBe('Стало некомфортно, остановился');expect(data.settings.blockedPractices).toContain('ground');
 expect((await request('/doctor/patients',undefined,d.cookie)).data.patients[0]).toMatchObject({pending_goals:1,pending_practices:1});
 for(const [path,record] of [['goal-logs',log],['practices',practice]] as const){
  expect((await request(`/doctor/patients/${id}/${path}/${record.id}/review`,{},other.cookie)).status).toBe(403);
  expect((await request(`/doctor/patients/${id}/${path}/${record.id}/review`,{},d.cookie)).status).toBe(200);
 }
 expect((await request('/doctor/patients',undefined,d.cookie)).data.patients[0]).toMatchObject({pending_goals:0,pending_practices:0});
 await request('/patient/checkins',{date:today(),mood:3,sleep:null,anxiety:null,energy:null,functioning:null,sleepContext:null,note:'',habit:null},p.cookie);
 expect((await request('/patient/reports',{days:14,endDate:today()},p.cookie)).status).toBe(201);
 expect((await request(`/patient/goals/${goal.id}/close`,{},p.cookie,'PUT')).status).toBe(200);
 expect((await request(`/patient/goals/${goal.id}/logs`,{status:'step',note:''},p.cookie)).status).toBe(404);
 expect((await create('Новая цель')).status).toBe(201);
 data=(await request('/patient/data',undefined,p.cookie)).data;expect(data.reports[0].goals.find((g:any)=>g.id===goal.id).closed_at).toBeNull();expect(data.reports[0].goalLogs[0].note).toBe('Небольшой шаг');
 expect((await request('/account/export',undefined,p.cookie)).data.data.goal_logs).toHaveLength(1);
 await request('/patient/revoke',{},p.cookie);
 expect((await request(`/doctor/patients/${id}/goal-logs/${log.id}/review`,{},d.cookie)).status).toBe(403);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},p.cookie,'DELETE')).status).toBe(200);
 expect(await db.binding.prepare('SELECT id FROM goals WHERE patient_id=?').bind(id).first()).toBeNull();
 expect(await db.binding.prepare('SELECT id FROM goal_logs WHERE patient_id=?').bind(id).first()).toBeNull();
},30000);
