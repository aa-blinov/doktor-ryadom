import {afterAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://profile.test',password='long-profile-test-password',env={DB:db.binding,ASSETS:{} as Fetcher};
async function request(path:string,body?:unknown,cookie?:string,method?:string){const r=await app.request(origin+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);return {r,status:r.status,data:r.headers.get('Content-Type')?.includes('application/json')?await r.json() as any:null,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function register(role:string,email:string){const r=await request('/auth/register',{name:'Тест профиля',email,password,role,consent:true});expect(r.status).toBe(201);return {id:r.data.user.id,cookie:r.cookie!,name:r.data.user.name};}
afterAll(()=>db.close());
it('role-specific profiles persist, validate dates and remain private until consent',async()=>{
 const p=await register('patient','profile-p@example.com'),d=await register('doctor','profile-d@example.com'),stranger=await register('doctor','profile-other@example.com');
 expect((await request('/profile')).status).toBe(401);
 expect((await request('/profile',{name:'Анна',birthDate:'2099-01-01',about:''},p.cookie,'PUT')).status).toBe(400);
 expect((await request('/profile',{name:'Анна',birthDate:'2025-02-30',about:''},p.cookie,'PUT')).status).toBe(400);
 expect((await request('/profile',{name:'Анна',birthDate:null,about:'',clinic:'Нельзя'},p.cookie,'PUT')).status).toBe(400);
 const saved=await request('/profile',{name:'Анна Пациент',birthDate:'1994-02-28',about:'Прошу говорить простыми словами'},p.cookie,'PUT');expect(saved.status).toBe(200);expect(saved.data.profile.birthDate).toBe('1994-02-28');
 expect((await request('/me',undefined,p.cookie)).data.user.name).toBe('Анна Пациент');expect((await request(`/doctor/patients/${p.id}/data`,undefined,d.cookie)).status).toBe(403);
 const doctor={name:'Врач Тест',specialty:'Психиатр',clinic:'Тестовая клиника',address:'Казахстан, Астана, улица Тестовая, 12, кабинет 4',experienceYears:0,about:'Консультации для взрослых',education:'2000–2006, Тестовая академия',courses:'2021, Тестовый курс',workHistory:'2018–2024, Тестовая клиника',focusAreas:'Тревога\nДепрессия'};expect((await request('/profile',doctor,d.cookie,'PUT')).status).toBe(200);
 expect((await request('/profile',{...doctor,birthDate:'1990-01-01'},d.cookie,'PUT')).status).toBe(400);
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.id).run();
 const invite=await request('/doctor/invites',{},d.cookie);expect(invite.status).toBe(201);const preview=await request('/invites/'+invite.data.token);expect(preview.data.doctorProfile.clinic).toBe(doctor.clinic);expect(preview.data.doctorProfile.address).toBe(doctor.address);expect((await request('/profile',{...doctor,address:'x'.repeat(501)},d.cookie,'PUT')).status).toBe(400);expect(preview.data.doctorProfile.experienceYears).toBe(0);expect(preview.data.doctorProfile.education).toBe(doctor.education);expect((await request('/profile',{...doctor,education:'x'.repeat(2001)},d.cookie,'PUT')).status).toBe(400);expect(preview.data).not.toHaveProperty('birthDate');const {address,education,courses,workHistory,focusAreas,...legacy}=doctor;await request('/profile',legacy,d.cookie,'PUT');expect((await request('/profile',undefined,d.cookie)).data.profile.education).toBe(education);expect((await request('/profile',undefined,d.cookie)).data.profile.address).toBe(address);
 expect((await request('/patient/accept',{token:invite.data.token,consent:true},p.cookie)).status).toBe(200);
 const details=await request(`/doctor/patients/${p.id}/data`,undefined,d.cookie);expect(details.data.patient.profile.about).toBe('Прошу говорить простыми словами');expect((await request(`/doctor/patients/${p.id}/data`,undefined,stranger.cookie)).status).toBe(403);
 expect((await request('/patient/data',undefined,p.cookie)).data.doctor.profile.clinic).toBe(doctor.clinic);expect((await request('/patient/data',undefined,p.cookie)).data.doctor.profile.workHistory).toBe(doctor.workHistory);
 const exported=await request('/account/export',undefined,p.cookie);expect(exported.data.data.profiles).toHaveLength(1);
 await request('/patient/revoke',{},p.cookie);expect((await request(`/doctor/patients/${p.id}/data`,undefined,d.cookie)).status).toBe(403);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},p.cookie,'DELETE')).status).toBe(200);expect(await db.binding.prepare('SELECT * FROM profiles WHERE user_id=?').bind(p.id).first()).toBeNull();
},20000);
it('doctor photos are validated, privately served, preserved on edits and erased on account deletion',async()=>{
 const d=await register('doctor','photo-d@example.com'),p=await register('patient','photo-p@example.com'),photo='data:image/jpeg;base64,'+readFileSync('tests/fixtures/profile.jpg','base64');
 expect((await request('/profile/photo',{photo},p.cookie,'PUT')).status).toBe(403);
 expect((await request('/profile/photo',{photo:'data:image/svg+xml;base64,PHN2Zz4='},d.cookie,'PUT')).status).toBe(400);
 expect((await request('/profile/photo',{photo:'data:image/jpeg;base64,YWJjZA=='},d.cookie,'PUT')).status).toBe(400);
 expect((await request('/profile/photo',{photo},d.cookie,'PUT')).status).toBe(200);
 const own=await request(`/profiles/${d.id}/photo`,undefined,d.cookie);expect(own.status).toBe(200);expect(own.r.headers.get('Content-Type')).toBe('image/jpeg');expect(own.r.headers.get('Cache-Control')).toContain('no-store');
 expect((await request(`/profiles/${d.id}/photo`,undefined,p.cookie)).status).toBe(403);expect((await request(`/profiles/${d.id}/photo`)).status).toBe(401);
 const body={name:'Врач Тест',specialty:'Психиатр',clinic:'Клиника',experienceYears:12,about:''};await request('/profile',body,d.cookie,'PUT');expect((await request('/profile',undefined,d.cookie)).data.profile.photoUrl).toBeTruthy();
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.id).run();
 await request('/profile',{...body,clinic:'Другая клиника'},d.cookie,'PUT');expect((await request('/me',undefined,d.cookie)).data.user.specialist_verified_at).toBeTypeOf('number');
 expect((await request(`/profiles/${d.id}/photo`,undefined,p.cookie)).status).toBe(200);
 await request('/profile',{...body,specialty:'Другая специальность'},d.cookie,'PUT');expect((await request('/me',undefined,d.cookie)).data.user.specialist_verified_at).toBeNull();expect((await request('/doctor/invites',{},d.cookie)).status).toBe(403);
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.id).run();const invite=await request('/doctor/invites',{},d.cookie);await request('/patient/accept',{token:invite.data.token,consent:true},p.cookie);
 expect((await request(`/profiles/${d.id}/photo`,undefined,p.cookie)).status).toBe(200);await request('/patient/revoke',{},p.cookie);expect((await request(`/profiles/${d.id}/photo`,undefined,p.cookie)).status).toBe(200);
 expect((await request('/profile/photo',{photo:null},d.cookie,'PUT')).data.profile.photoUrl).toBeNull();expect((await request(`/profiles/${d.id}/photo`,undefined,d.cookie)).status).toBe(404);
 await request('/profile/photo',{photo},d.cookie,'PUT');expect((await request('/account',{password,confirm:'УДАЛИТЬ'},d.cookie,'DELETE')).status).toBe(200);expect(await db.binding.prepare('SELECT * FROM profiles WHERE user_id=?').bind(d.id).first()).toBeNull();
},20000);
it('persistent doctor code needs verification and explicit patient consent, works for several patients and is erased on deletion',async()=>{
 const d=await register('doctor','code-d@example.com'),p=await register('patient','code-p@example.com'),q=await register('patient','code-q@example.com');
 expect((await request('/doctor/code')).status).toBe(401);expect((await request('/doctor/code',undefined,p.cookie)).status).toBe(403);
 const own=await request('/doctor/code',undefined,d.cookie);expect(own.status).toBe(200);const code=own.data.code;expect(code).toMatch(/^[A-F0-9]{12}$/);expect(own.data.active).toBe(false);expect((await request('/doctor/code',undefined,d.cookie)).data.code).toBe(code);
 expect((await request('/invites/'+code)).status).toBe(403);expect((await request('/patient/accept',{token:code,consent:true},p.cookie)).status).toBe(404);
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.id).run();expect((await request('/doctor/code',undefined,d.cookie)).data.active).toBe(true);expect((await request('/invites/'+code.toLowerCase())).status).toBe(200);
 expect((await request('/patient/accept',{token:code,consent:false},p.cookie)).status).toBe(400);expect((await request('/patient/accept',{token:code,consent:true},p.cookie)).status).toBe(200);expect((await request('/patient/accept',{token:code,consent:true},q.cookie)).status).toBe(200);expect((await request('/patient/accept',{token:code,consent:true},p.cookie)).status).toBe(409);
 expect((await request('/account',{password,confirm:'УДАЛИТЬ'},d.cookie,'DELETE')).status).toBe(200);expect((await request('/invites/'+code)).status).toBe(404);expect(await db.binding.prepare('SELECT code FROM doctor_codes WHERE user_id=?').bind(d.id).first()).toBeNull();
},20000);
it('qualification files are private by default, linked to an entry, explicitly shared and hidden with the section',async()=>{
 const d=await register('doctor','docfile-d@example.com'),p=await register('patient','docfile-p@example.com'),stranger=await register('doctor','docfile-x@example.com');const body={name:'Врач Тест',specialty:'Психиатр',clinic:'',experienceYears:10,about:'',education:'2006, Академия',courses:'2021, Курс',workHistory:'2018, Клиника'};
 await request('/profile',body,d.cookie,'PUT');const payload={category:'education',entry:body.education,filename:'test-diploma.pdf',data:Buffer.from('%PDF-1.4\nSynthetic fixture\n%%EOF').toString('base64')};
 expect((await request('/profile/documents',payload,p.cookie)).status).toBe(403);expect((await request('/profile/documents',{...payload,data:Buffer.from('<svg/>').toString('base64')},d.cookie)).status).toBe(400);expect((await request('/profile/documents',{...payload,entry:'Не сохранено'},d.cookie)).status).toBe(409);
 const uploaded=await request('/profile/documents',payload,d.cookie);expect(uploaded.status).toBe(201);const path='/profile/documents/'+uploaded.data.id;expect((await request(path)).status).toBe(401);expect((await request(path,undefined,stranger.cookie)).status).toBe(403);expect((await request(path,{shared:true},stranger.cookie,'PUT')).status).toBe(404);
 const own=await request(path,undefined,d.cookie);expect(own.status).toBe(200);expect(own.r.headers.get('Content-Disposition')).toContain('attachment');expect(own.r.headers.get('Cache-Control')).toContain('no-store');
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),d.id).run();const code=(await request('/doctor/code',undefined,d.cookie)).data.code;await request('/patient/accept',{token:code,consent:true},p.cookie);expect((await request(path,undefined,p.cookie)).status).toBe(403);expect((await request('/patient/data',undefined,p.cookie)).data.doctor.profile.documents).toEqual([]);
 expect((await request(path,{shared:true},d.cookie,'PUT')).status).toBe(200);expect((await request(path,undefined,p.cookie)).status).toBe(200);expect((await request('/patient/data',undefined,p.cookie)).data.doctor.profile.documents).toHaveLength(1);expect((await request('/invites/'+code)).data.doctorProfile.documents).toEqual([]);
 await request('/profile',{...body,showEducation:false},d.cookie,'PUT');expect((await request('/patient/data',undefined,p.cookie)).data.doctor.profile.education).toBe('');expect((await request('/profile',undefined,d.cookie)).data.profile.education).toBe(body.education);expect((await request(path,undefined,p.cookie)).status).toBe(403);
 await request('/profile',{...body,education:'Другая запись',showEducation:true},d.cookie,'PUT');expect((await request(path,undefined,p.cookie)).status).toBe(403);
 expect((await request('/account/export',undefined,d.cookie)).data.data.profile_documents).toHaveLength(1);expect((await request(path,{},d.cookie,'DELETE')).status).toBe(200);expect((await request(path,undefined,d.cookie)).status).toBe(404);
 await request('/profile',body,d.cookie,'PUT');await request('/profile/documents',payload,d.cookie);await request('/account',{password,confirm:'УДАЛИТЬ'},d.cookie,'DELETE');expect(await db.binding.prepare('SELECT id FROM profile_documents WHERE user_id=?').bind(d.id).first()).toBeNull();
},30000);
