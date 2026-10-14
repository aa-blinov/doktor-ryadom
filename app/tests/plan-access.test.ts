import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://plan-access.test',password='sufficiently-long-test-password';
const env={DB:db.binding,ASSETS:{} as Fetcher,MAIL:{send:async()=>{}},PUSH_PUBLIC_KEY:'test-key'};
async function request(path:string,body?:unknown,cookie?:string,method?:string){const r=await app.request(origin+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'CF-Connecting-IP':'plan-access-client',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);return {status:r.status,data:await r.json().catch(()=>({})) as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
afterAll(()=>db.close());
// A doctor with no link to a patient must not be able to write that patient's plan, nor read its data.
it('a doctor without a link to the patient cannot write or read the patient plan',async()=>{
 const doctor=await request('/auth/register',{name:'Врач Чужой',email:'plan-access-doctor@example.com',password,role:'doctor',consent:true});
 expect(doctor.status).toBe(201);
 const plan={frequency:'daily',sleep:true,anxiety:true,energy:false,functioning:true,practices:[],habit:''};
 const write=await request('/doctor/patients/00000000-0000-4000-8000-000000000000/plan',plan,doctor.cookie,'PUT');
 expect(write.status).toBe(403);
 const read=await request('/doctor/patients/00000000-0000-4000-8000-000000000000/data',undefined,doctor.cookie);
 expect(read.status).toBe(403);
},30000);
