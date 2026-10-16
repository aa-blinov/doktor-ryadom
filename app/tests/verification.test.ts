import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://verification.test',env={DB:db.binding,ASSETS:{} as Fetcher};
const password='test-verification-password-long';
async function request(path:string,body?:unknown,cookie?:string,method?:string){
 const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function register(role:string,tag:string){return request('/auth/register',{name:'Тест '+tag,email:tag+'@example.com',password,role,consent:true,adult:true});}
afterAll(()=>db.close());
it('doctor applies for verification, admin decides, only admin can see the queue',async()=>{
 const doctor=await register('doctor','verify-doctor'),patient=await register('patient','verify-patient'),admin=await register('doctor','verify-admin');
 const form={kind:'psychiatrist',specialty:'Психиатр',license:'KZ-12345',city:'Алматы',note:'Работаю в клинике'};
 expect((await request('/doctor/verification',undefined,doctor.cookie)).data).toEqual({verified:false,request:null});
 expect((await request('/doctor/verification',form,doctor.cookie)).status).toBe(200);
 expect((await request('/doctor/verification',undefined,doctor.cookie)).data.request.status).toBe('pending');
 expect((await request('/doctor/verification',{...form,city:'Астана'},doctor.cookie)).status).toBe(200);
 expect((await db.binding.prepare("SELECT count(*) AS count FROM specialist_requests WHERE doctor_id=?").bind((await request('/me',undefined,doctor.cookie)).data.user.id).first<{count:number}>())?.count).toBe(1);
 expect((await request('/doctor/verification',form,patient.cookie)).status).toBe(403);
 expect((await request('/admin/verifications',undefined,doctor.cookie)).status).toBe(403);
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('verify-admin@example.com').run();
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 expect(queue.status).toBe(200);
 expect(queue.data.requests.some((r:{email:string;status:string})=>r.email==='verify-doctor@example.com'&&r.status==='pending')).toBe(true);
 const id=queue.data.requests.find((r:{email:string})=>r.email==='verify-doctor@example.com').id;
 expect((await request(`/admin/verifications/${id}/decision`,{decision:'needs_info',note:'Приложите номер лицензии'},admin.cookie)).status).toBe(200);
 expect((await request('/doctor/verification',form,admin.cookie)).status).toBe(403);
 const blockedDoctor=await register('patient','verify-blocked');
 expect((await request(`/admin/accounts/${blockedDoctor.data.user.id}/block`,{blocked:true},admin.cookie)).status).toBe(200);
 expect((await request('/auth/login',{email:'verify-blocked@example.com',password},undefined)).status).toBe(403);
 const blockedMe=await request('/me',undefined,blockedDoctor.cookie);expect(blockedMe.status).toBe(403);expect(blockedMe.data.error).toMatch(/заблокирован/);
  expect((await request(`/admin/accounts/${blockedDoctor.data.user.id}/block`,{blocked:false},admin.cookie)).status).toBe(200);
  // The old cookie must not resume after unblock: the person signs in again.
  expect((await request('/me',undefined,blockedDoctor.cookie)).status).toBe(401);
 expect((await request('/admin/audit',undefined,admin.cookie)).status).toBe(200);
 expect((await request('/admin/accounts',undefined,doctor.cookie)).status).toBe(403);
 expect((await request('/doctor/verification',undefined,doctor.cookie)).data.request.admin_note).toBe('Приложите номер лицензии');
 expect((await request(`/admin/verifications/${id}/decision`,{decision:'approve',note:''},admin.cookie)).status).toBe(200);
 expect((await request('/me',undefined,doctor.cookie)).data.user.specialist_verified_at).toBeTruthy();
 expect((await request('/doctor/verification',form,doctor.cookie)).status).toBe(409);
 expect((await request(`/admin/verifications/${id}/decision`,{decision:'reject',note:'Поздно'},admin.cookie)).status).toBe(409);
},60000);
