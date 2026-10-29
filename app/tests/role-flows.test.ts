import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://role-flows.test',env={DB:db.binding,ASSETS:{} as Fetcher};
const password='test-role-flows-password-long';
async function request(path:string,body?:unknown,cookie?:string,method?:string){
 const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function register(role:string,tag:string){const r=await request('/auth/register',{name:'Тест '+tag,email:tag+'@example.com',password,role,consent:true,adult:true});if(role!=='patient')db.binding.prepare('UPDATE users SET totp_enabled_at=1 WHERE id=?').bind(r.data.user.id).run();return r;}
afterAll(()=>db.close());

it('the doctor leaves a contact and the administrator sees it in the queue',async()=>{
 const doctor=await register('doctor','flow-contact-doctor'),admin=await register('doctor','flow-contact-admin');
 const form={kind:'psychiatrist',specialty:'Психиатр',license:'KZ-22222',city:'Алматы',contact:'+7 700 111-22-33',note:''};
 expect((await request('/doctor/verification',form,doctor.cookie)).status).toBe(200);
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('flow-contact-admin@example.com').run();
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 const row=queue.data.requests.find((r:{email:string})=>r.email==='flow-contact-doctor@example.com');
 expect(row.contact).toBe('+7 700 111-22-33');
},60000);

it('the administrator sees whether the address of the doctor is confirmed',async()=>{
 const doctor=await register('doctor','flow-mail-doctor'),admin=await register('doctor','flow-mail-admin');
 const form={kind:'psychologist',specialty:'Психолог',license:'KZ-33333',city:'Астана',note:''};
 expect((await request('/doctor/verification',form,doctor.cookie)).status).toBe(200);
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('flow-mail-admin@example.com').run();
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 const row=queue.data.requests.find((r:{email:string})=>r.email==='flow-mail-doctor@example.com');
 expect(row.email_verified_at).toBeNull();
 db.binding.prepare('UPDATE users SET email_verified_at=? WHERE email=?').bind(Date.now(),'flow-mail-doctor@example.com').run();
 const again=await request('/admin/verifications',undefined,admin.cookie);
 expect(again.data.requests.find((r:{email:string})=>r.email==='flow-mail-doctor@example.com').email_verified_at).toBeTruthy();
},60000);

it('a change of the name opens a new request instead of leaving the doctor stuck',async()=>{
 const doctor=await register('doctor','flow-recheck-doctor'),admin=await register('doctor','flow-recheck-admin');
 const form={kind:'psychologist',specialty:'Психолог',license:'KZ-44444',city:'Алматы',note:''};
 expect((await request('/doctor/verification',form,doctor.cookie)).status).toBe(200);
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('flow-recheck-admin@example.com').run();
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 const id=queue.data.requests.find((r:{email:string})=>r.email==='flow-recheck-doctor@example.com').id;
 expect((await request(`/admin/verifications/${id}/decision`,{decision:'approve',note:''},admin.cookie)).status).toBe(200);
 expect((await request('/doctor/verification',undefined,doctor.cookie)).data.verified).toBe(true);
 // The name in the profile is not the one in the account, so the confirmation is taken back.
 const profile={timezone:'Asia/Almaty',name:'Другое Имя',specialty:'Психолог',clinic:'',address:'',experienceYears:null,price:null,visitFormat:'both',about:'',education:'',courses:'',workHistory:'',focusAreas:'',showEducation:true,showCourses:true,showWorkHistory:true};
 expect((await request('/profile',profile,doctor.cookie,'PUT')).status).toBe(200);
 expect((await request('/me',undefined,doctor.cookie)).data.user.specialist_verified_at).toBeNull();
 // The old request stays approved, so the doctor has to be able to file a new one.
 const after=await request('/doctor/verification',undefined,doctor.cookie);
 expect(after.data.verified).toBe(false);
 expect(after.data.request.status).toBe('approved');
 expect((await request('/doctor/verification',{...form,specialty:'Психолог, детский'},doctor.cookie)).status).toBe(200);
 const pending=await request('/doctor/verification',undefined,doctor.cookie);
 expect(pending.data.request.status).toBe('pending');
 expect(pending.data.request.specialty).toBe('Психолог, детский');
},60000);

it('a notice points at the screen where the person can act',async()=>{
 const doctor=await register('doctor','flow-notice-doctor'),admin=await register('doctor','flow-notice-admin');
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('flow-notice-admin@example.com').run();
 const form={kind:'psychologist',specialty:'Психолог',license:'KZ-66666',city:'Алматы',note:''};
 await request('/doctor/verification',form,doctor.cookie);
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 const id=queue.data.requests.find((r:{email:string})=>r.email==='flow-notice-doctor@example.com').id;
 const adminNotice=await db.binding.prepare('SELECT url FROM notices WHERE user_id=? AND body LIKE ?').bind((await request('/me',undefined,admin.cookie)).data.user.id,'%Новая заявка%').first<{url:string}>();
 // The queue of the requests is the section "Заявки", not the list of the doctors.
 expect(adminNotice?.url).toBe('/#/admin');
 await request(`/admin/verifications/${id}/decision`,{decision:'needs_info',note:'Уточните номер лицензии'},admin.cookie);
 const doctorNotice=await db.binding.prepare('SELECT url FROM notices WHERE user_id=? AND body LIKE ?').bind((await request('/me',undefined,doctor.cookie)).data.user.id,'%уточнить данные%').first<{url:string}>();
 // The comment of the administrator is on the connection screen, not on the profile.
 expect(doctorNotice?.url).toBe('/#/patients');
},60000);

it('the newest request of a doctor is the one the administrator decides',async()=>{
 const doctor=await register('doctor','flow-latest-doctor'),admin=await register('doctor','flow-latest-admin');
 const form={kind:'psychologist',specialty:'Психолог',license:'KZ-55555',city:'Алматы',note:''};
 await request('/doctor/verification',form,doctor.cookie);
 await db.binding.prepare("UPDATE users SET role='admin' WHERE email=?").bind('flow-latest-admin@example.com').run();
 const queue=await request('/admin/verifications',undefined,admin.cookie);
 const id=queue.data.requests.find((r:{email:string})=>r.email==='flow-latest-doctor@example.com').id;
 expect((await request(`/admin/verifications/${id}/decision`,{decision:'needs_info',note:'Уточните номер'},admin.cookie)).status).toBe(200);
 await request('/doctor/verification',{...form,license:'KZ-55566'},doctor.cookie);
 const again=await request('/admin/verifications',undefined,admin.cookie);
 const row=again.data.requests.find((r:{email:string})=>r.email==='flow-latest-doctor@example.com');
 expect(row.status).toBe('pending');
 expect(row.license).toBe('KZ-55566');
},60000);
