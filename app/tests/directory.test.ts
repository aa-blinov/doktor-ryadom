import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const mail:{to:string;subject:string;text:string}[]=[];
const db=createDatabase(),origin='https://directory.test',env={DB:db.binding,ASSETS:{} as Fetcher,MAIL:{send:async(message:typeof mail[number])=>{mail.push(message);}}};
const password='test-directory-password-long';
async function request(path:string,body?:unknown,cookie?:string,method?:string){
 const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const accounts=new Map<string,{cookie:string;id:string}>();
async function register(role:string,tag:string){const known=accounts.get(tag);if(known)return known;const r=await request('/auth/register',{name:'Тест '+tag,email:tag+'@example.com',password,role,consent:true,adult:true});expect(r.status).toBe(201);const account={cookie:r.cookie!,id:r.data.user.id as string};accounts.set(tag,account);return account;}
async function verify(id:string,kind:string|null){await db.binding.prepare('UPDATE users SET totp_enabled_at=1,specialist_verified_at=?,specialty_kind=? WHERE id=?').bind(Date.now(),kind,id).run();await db.binding.prepare('INSERT INTO specialist_requests (id,doctor_id,kind,specialty,license,city,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,kind,'Специалист','LIC-'+id.slice(0,4),'Алматы','approved',Date.now(),Date.now()).run();}
afterAll(()=>db.close());

it('only a verified psychiatrist may prescribe medication',async()=>{
 const psychiatrist=await register('doctor','dir-psy'),psychologist=await register('doctor','dir-psych'),patient=await register('patient','dir-med-p');
 await verify(psychiatrist.id,'psychiatrist');await verify(psychologist.id,'psychologist');
 for(const doc of [psychiatrist,psychologist]){const inv=await request('/doctor/invites',{},doc.cookie);const pat=doc===psychiatrist?patient:await register('patient','dir-med-p2');expect((await request('/patient/accept',{token:inv.data.token,consent:true,adult:true},pat.cookie)).status).toBe(200);
  const res=await request(`/doctor/patients/${pat.id}/medications`,{name:'Препарат',instructions:'1 раз в день',startDate:'2026-10-01'},doc.cookie);
  expect(res.status).toBe(doc===psychiatrist?201:403);}
},40000);

it('catalogue lists verified doctors with filters, rating and patient-only access',async()=>{
 const a=await register('doctor','dir-a'),b=await register('doctor','dir-b'),hidden=await register('doctor','dir-unverified'),patient=await register('patient','dir-p'),other=await register('patient','dir-p2');
 await verify(a.id,'psychiatrist');await verify(b.id,'psychologist');
 expect((await request('/directory',undefined,a.cookie)).status).toBe(403);
 expect((await request('/directory')).status).toBe(401);
 const all=await request('/directory',undefined,patient.cookie);expect(all.status).toBe(200);
 const ids=all.data.doctors.map((d:any)=>d.id);expect(ids).toContain(a.id);expect(ids).toContain(b.id);expect(ids).not.toContain(hidden.id);
 expect((await request('/directory?kind=psychiatrist',undefined,patient.cookie)).data.doctors.every((d:any)=>d.kind==='psychiatrist')).toBe(true);
 expect((await request('/directory/'+hidden.id,undefined,patient.cookie)).status).toBe(404);
 // reviews: rating required, one per patient, shown by first name only, average computed
 expect((await request(`/directory/${a.id}/review`,{rating:0,body:''},patient.cookie,'PUT')).status).toBe(400);
 expect((await request(`/directory/${a.id}/review`,{rating:5,body:'Внимательный врач'},a.cookie,'PUT')).status).toBe(403);
 expect((await request(`/directory/${a.id}/review`,{rating:5,body:'Внимательный врач'},patient.cookie,'PUT')).status).toBe(201);
 expect((await request(`/directory/${a.id}/review`,{rating:3,body:'Нормально'},other.cookie,'PUT')).status).toBe(201);
 // One review per patient and doctor: a repeated publication is refused, the published one is not overwritten.
 expect((await request(`/directory/${a.id}/review`,{rating:4,body:'Обновил'},patient.cookie,'PUT')).status).toBe(409);
 const detail=await request('/directory/'+a.id,undefined,patient.cookie);
 expect(detail.data.reviews).toHaveLength(2);expect(detail.data.doctor.rating).toBe(4);expect(detail.data.doctor.reviewCount).toBe(2);
 expect(detail.data.mine).toEqual({rating:5,body:'Внимательный врач',hidden:false});
 // The review is published under the first name only ("Фамилия Имя" at registration).
 expect(detail.data.reviews.map((r:any)=>r.author).sort()).toEqual(['dir-p','dir-p2']);
 // admin can hide a review; it disappears from patients and the average
 const admin=await register('doctor','dir-admin');await db.binding.prepare("UPDATE users SET totp_enabled_at=1,role='admin' WHERE id=?").bind(admin.id).run();
 const rid=detail.data.reviews[0].id;expect((await request(`/admin/reviews/${rid}/hide`,{hidden:true},patient.cookie)).status).toBe(403);
 expect((await request(`/admin/reviews/${rid}/hide`,{hidden:true},admin.cookie)).status).toBe(200);
 const after=await request('/directory/'+a.id,undefined,patient.cookie);expect(after.data.reviews).toHaveLength(1);expect(after.data.doctor.reviewCount).toBe(1);
 expect((await request(`/directory/${a.id}/review`,undefined,patient.cookie,'DELETE')).status).toBe(200);
},40000);

it('patient connects only via one-time invite, which cannot be reused',async()=>{
 const d=await register('doctor','dir-b'),p=await register('patient','dir-p'),p2=await register('patient','dir-p2');
 await db.binding.prepare('UPDATE users SET email_verified_at=? WHERE id=?').bind(Date.now(),d.id).run();
 expect((await request(`/directory/${d.id}/request`,{message:'Нужна помощь',consent:true,adult:true},p.cookie)).status).toBe(404);
 mail.length=0;
 const inv=await request('/doctor/invites',{},d.cookie);expect(inv.status).toBe(201);expect(inv.data.token).toMatch(/^[a-f0-9]{64}$/i);
 expect((await request('/invites/'+inv.data.token,undefined,p.cookie)).status).toBe(200);
 expect(mail).toHaveLength(0); // invite is link-based, no patient-initiated email
 expect((await request('/patient/accept',{token:inv.data.token,consent:true,adult:true},p.cookie)).status).toBe(200);
 expect((await request('/patient/accept',{token:inv.data.token,consent:true,adult:true},p.cookie)).status).toBe(404);
 expect((await request('/patient/accept',{token:inv.data.token,consent:true,adult:true},p2.cookie)).status).toBe(404);
 expect((await request('/doctor/patients/'+p.id+'/data',undefined,d.cookie)).status).toBe(200);
 expect((await request('/doctor/patients/'+p2.id+'/data',undefined,d.cookie)).status).toBe(403);
},40000);

it('admin sees specialty kind with diploma text and can correct it',async()=>{
 const d=accounts.get('dir-a')!,admin=accounts.get('dir-admin')!,patient=accounts.get('dir-p')!;
 await db.binding.prepare("UPDATE specialist_requests SET specialty='Врач-психиатр' WHERE doctor_id=? AND status='approved'").bind(d.id).run();
 await db.binding.prepare("INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(d.id,JSON.stringify({specialty:'Врач-психиатр'}),Date.now()).run();
 const list=await request('/admin/doctors',undefined,admin.cookie);
 const row=list.data.doctors.find((x:any)=>x.id===d.id);
 expect(row.specialty_kind).toBe('psychiatrist');
 expect(row.profile_specialty).toBe('Врач-психиатр');
 expect((await request(`/admin/doctors/${d.id}/kind`,{kind:'psychologist'},patient.cookie)).status).toBe(403);
 expect((await request(`/admin/doctors/${d.id}/kind`,{kind:'psychologist'},admin.cookie)).status).toBe(200);
 expect((await request('/admin/doctors',undefined,admin.cookie)).data.doctors.find((x:any)=>x.id===d.id).specialty_kind).toBe('psychologist');
 expect((await request('/directory?kind=psychologist',undefined,patient.cookie)).data.doctors.some((x:any)=>x.id===d.id)).toBe(true);
 expect((await request(`/admin/doctors/${d.id}/kind`,{kind:'psychiatrist'},admin.cookie)).status).toBe(200);
},40000);
