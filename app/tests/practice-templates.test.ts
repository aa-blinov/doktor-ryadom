import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://practice.test',password='practice-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{method?:string;json?:unknown;body?:Uint8Array;type?:string;length?:number;cookie?:string;range?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.8.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:any;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 if(init.body){headers['Content-Type']=init.type!;body=init.body;}
 if(init.length!==undefined)headers['Content-Length']=String(init.length);
 if(init.range)headers.Range=init.range;
 const method=init.method||(init.json!==undefined||init.body?'POST':'GET');
 return app.request(origin+'/api'+path,{method,headers,body},env);
}
async function register(role:'doctor'|'patient',email:string,verify=true){
 const r=await request('/auth/register',{json:{name:'Практика Тест',email,password,role,consent:true}});
 expect(r.status).toBe(201);
 const id=(await r.json() as {user:{id:string}}).user.id;
 if(role==='doctor'&&verify)db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),id).run();
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id};
}
const good={title:'Дыхание у окна',subtitle:'Короткая пауза на выдохе',minutes:2,category:'Забота о себе',basis:'Авторская практика врача',description:'Встаньте у окна и сделайте три выдоха подольше.',steps:[{title:'Встаньте',text:'Подойдите к окну и встаньте ровно.'},{title:'Выдох',text:'Выдохните медленно, считая до четырёх.'}]};
const jpeg=()=>{const b=new Uint8Array(64);b.set([0xff,0xd8,0xff,0xe0,0,0x10,0x4a,0x46,0x49,0x46]);return b;};
const png=()=>{const b=new Uint8Array(64);b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);return b;};

it('a doctor writes a practice and validation names the problem',async()=>{
 const doctor=await register('doctor','prac-doctor@example.com');
 expect((await request('/doctor/practices',{json:{...good,title:'ab'},cookie:doctor.cookie})).status).toBe(400);
 expect((await request('/doctor/practices',{json:{...good,minutes:16},cookie:doctor.cookie})).status).toBe(400);
 expect((await request('/doctor/practices',{json:{...good,steps:[]},cookie:doctor.cookie})).status).toBe(400);
 const made=await request('/doctor/practices',{json:good,cookie:doctor.cookie});
 expect(made.status).toBe(201);
 const {practice}=await made.json() as {practice:{id:string;steps:unknown[]}};
 expect(practice.id.startsWith('custom:')).toBe(true);expect(practice.steps).toHaveLength(2);
 const list=await (await request('/doctor/practices',{cookie:doctor.cookie})).json() as {practices:unknown[]};
 expect(list.practices).toHaveLength(1);
});

it('photos and videos are checked by signature and size, only by the owner',async()=>{
 const doctor=await register('doctor','prac-media@example.com');
 const other=await register('doctor','prac-other@example.com');
 const {practice}=await (await request('/doctor/practices',{json:good,cookie:doctor.cookie})).json() as {practice:{id:string}};
 const id=practice.id.slice(7);
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'PUT',body:jpeg(),type:'image/jpeg',length:64,cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'PUT',body:png(),type:'image/png',length:64,cookie:doctor.cookie})).status).toBe(200);
 const text=new TextEncoder().encode('just text, not an image at all here');
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'PUT',body:text,type:'image/jpeg',length:text.length,cookie:doctor.cookie})).status).toBe(400);
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'PUT',body:jpeg(),type:'image/jpeg',length:64,cookie:other.cookie})).status).toBe(404);
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'PUT',body:jpeg(),type:'image/jpeg',length:6*1024*1024,cookie:doctor.cookie})).status).toBe(413);
 expect((await request(`/practices/${id}/media/photo`,{cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/practices/${id}/media/photo`,{cookie:other.cookie})).status).toBe(403);
 expect((await request(`/doctor/practices/${id}/media/photo`,{method:'DELETE',json:{},cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/practices/${id}/media/photo`,{cookie:doctor.cookie})).status).toBe(404);
},60000);

it('a plan takes only own, unarchived practices; the patient sees and logs them',async()=>{
 const doctor=await register('doctor','prac-plan@example.com');
 const stranger=await register('doctor','prac-stranger@example.com');
 const patient=await register('patient','prac-patient@example.com');
 const mineRef=(await (await request('/doctor/practices',{json:good,cookie:doctor.cookie})).json() as {practice:{id:string}}).practice.id;
 const mine=mineRef.slice(7);
 const theirs=(await (await request('/doctor/practices',{json:good,cookie:stranger.cookie})).json() as {practice:{id:string}}).practice.id;
 // the patient must be linked to the doctor before a plan can be written
 const inv=await (await request('/doctor/invites',{json:{},cookie:doctor.cookie})).json() as {token:string};
 expect((await request('/patient/accept',{json:{token:inv.token,consent:true},cookie:patient.cookie})).status).toBe(200);
 const plan=(practices:string[])=>({frequency:'daily',sleep:true,anxiety:true,energy:false,functioning:true,practices,habit:''});
 expect((await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:plan(['ground',mineRef]),cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:plan([theirs]),cookie:doctor.cookie})).status).toBe(400);
 expect((await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:plan(['custom:not-a-uuid']),cookie:doctor.cookie})).status).toBe(400);
 expect((await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:plan(['ground',mineRef]),cookie:doctor.cookie})).status).toBe(200);
 const data=await (await request('/patient/data',{cookie:patient.cookie})).json() as {customPractices:{id:string;title:string}[];plan:{practices:string[]}};
 expect(data.customPractices.map(p=>p.id)).toEqual([mineRef]);
 expect(data.plan.practices).toContain(mineRef);
 const log=await request('/patient/practices',{json:{practiceId:mineRef,feedback:'comfortable',note:''},cookie:patient.cookie});
 expect(log.status).toBe(201);
 // archived: patient keeps it, new plans may not include it
 expect((await request(`/doctor/practices/${mine}/archive`,{json:{},cookie:doctor.cookie})).status).toBe(200);
 const kept=await (await request('/patient/data',{cookie:patient.cookie})).json() as {customPractices:{archived:boolean}[]};
 expect(kept.customPractices[0].archived).toBe(true);
 expect((await request(`/doctor/patients/${patient.id}/plan`,{method:'PUT',json:plan(['ground',mineRef]),cookie:doctor.cookie})).status).toBe(400);
 expect((await request(`/doctor/practices/${mine}`,{method:'PUT',json:good,cookie:doctor.cookie})).status).toBe(409);
});

it('a practice video can be sought with byte ranges',async()=>{
 const doctor=await register('doctor','prac-range@example.com');
 const {practice}=await (await request('/doctor/practices',{json:good,cookie:doctor.cookie})).json() as {practice:{id:string}};
 const id=practice.id.slice(7);
 const clip=new Uint8Array(64);clip.set([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,0x01]);
 expect((await request(`/doctor/practices/${id}/media/video`,{method:'PUT',body:clip,type:'video/webm',length:64,cookie:doctor.cookie})).status).toBe(200);
 const part=await request(`/practices/${id}/media/video`,{cookie:doctor.cookie,range:'bytes=0-7'});
 expect(part.status).toBe(206);expect(part.headers.get('content-range')).toBe('bytes 0-7/64');
 expect((await part.arrayBuffer()).byteLength).toBe(8);
 expect((await request(`/practices/${id}/media/video`,{cookie:doctor.cookie,range:'bytes=500-600'})).status).toBe(416);
},60000);
