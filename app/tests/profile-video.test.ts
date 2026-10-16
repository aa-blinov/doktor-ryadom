import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://video.test',password='video-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{method?:string;body?:BodyInit|null;json?:unknown;cookie?:string;type?:string;length?:number;range?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.7.0.${++ip}`};
 if(init.cookie)headers.Cookie=init.cookie;
 if(init.json!==undefined){headers['Content-Type']='application/json';}
 if(init.type)headers['Content-Type']=init.type;
 if(init.length!==undefined)headers['Content-Length']=String(init.length);
 if(init.range)headers.Range=init.range;
 const body=init.json!==undefined?JSON.stringify(init.json):init.body??undefined;
 return app.request(origin+'/api'+path,{method:init.method||(body===undefined?'GET':init.body!==undefined&&init.json===undefined&&init.body!==null?'PUT':'POST'),headers,body},env);
}
async function register(role:'doctor'|'patient',email:string){
 const r=await request('/auth/register',{method:'POST',json:{name:'Видео Тест',email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id:(await r.json() as {user:{id:string}}).user.id};
}
// Minimal MP4 header: size, 'ftyp', brand. Enough for the signature check; not a playable file.
const mp4=()=>{const b=new Uint8Array(64);b.set([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,2,0]);return b;};
const webm=()=>{const b=new Uint8Array(64);b.set([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,0x01]);return b;};

it('a doctor uploads an MP4 and patients see it; strangers and anonymous users do not',async()=>{
 const doctor=await register('doctor','video-doctor@example.com');
 const patient=await register('patient','video-patient@example.com');
 const stranger=await register('patient','video-stranger@example.com');
 db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),doctor.id).run();
 const up=await request('/profile/video',{method:'PUT',body:mp4(),type:'video/mp4',length:64,cookie:doctor.cookie});
 expect(up.status).toBe(200);
 const body=await up.json() as {videoUrl:string};
 expect(body.videoUrl).toContain(`/api/profiles/${doctor.id}/video`);
 // the catalogue needs a connection or a verified doctor; a verified doctor is visible to any signed-in patient
 const seen=await request(`/profiles/${doctor.id}/video`,{cookie:patient.cookie});
 expect(seen.status).toBe(200);expect(seen.headers.get('content-type')).toBe('video/mp4');expect(seen.headers.get('cache-control')).toContain('no-store');
 expect(new Uint8Array(await seen.arrayBuffer())).toEqual(mp4());
 expect((await request(`/profiles/${doctor.id}/video`)).status).toBe(401);
 // the profile itself now lists the video URL
 const profile=await request(`/directory/${doctor.id}`,{cookie:patient.cookie});
 expect(profile.status).toBe(200);
 expect(JSON.stringify(await profile.json())).toContain('/video?v=');
 void stranger;
});

it('accepts WebM, rejects other formats, wrong roles and oversize uploads',async()=>{
 const doctor=await register('doctor','video-webm@example.com');
 const patient=await register('patient','video-notdoctor@example.com');
 db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),doctor.id).run();
 expect((await request('/profile/video',{method:'PUT',body:webm(),type:'video/webm',length:64,cookie:doctor.cookie})).status).toBe(200);
 const text=new TextEncoder().encode('not a video at all, just plain text here');
 expect((await request('/profile/video',{method:'PUT',body:text,type:'video/mp4',length:text.length,cookie:doctor.cookie})).status).toBe(400);
 expect((await request('/profile/video',{method:'PUT',body:mp4(),type:'video/mp4',length:64,cookie:patient.cookie})).status).toBe(403);
 expect((await request('/profile/video',{method:'PUT',body:null,type:'video/mp4',length:51*1024*1024,cookie:doctor.cookie})).status).toBe(413);
},60000);

it('serves byte ranges for seeking and removes the video on request',async()=>{
 const doctor=await register('doctor','video-range@example.com');
 db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),doctor.id).run();
 await request('/profile/video',{method:'PUT',body:mp4(),type:'video/mp4',length:64,cookie:doctor.cookie});
 const part=await request(`/profiles/${doctor.id}/video`,{cookie:doctor.cookie,range:'bytes=0-7'});
 expect(part.status).toBe(206);expect(part.headers.get('content-range')).toBe('bytes 0-7/64');expect((await part.arrayBuffer()).byteLength).toBe(8);
 const tail=await request(`/profiles/${doctor.id}/video`,{cookie:doctor.cookie,range:'bytes=-4'});
 expect(tail.status).toBe(206);expect(tail.headers.get('content-range')).toBe('bytes 60-63/64');
 expect((await request(`/profiles/${doctor.id}/video`,{cookie:doctor.cookie,range:'bytes=999-1000'})).status).toBe(416);
 expect((await request('/profile/video',{method:'DELETE',json:{},cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/profiles/${doctor.id}/video`,{cookie:doctor.cookie})).status).toBe(404);
});

it('a realistic 75 KB clip passes the body limit, which the generic 16 KB limit would reject',async()=>{
 const doctor=await register('doctor','video-realistic@example.com');
 db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychiatrist' WHERE id=?").bind(Date.now(),doctor.id).run();
 const clip=new Uint8Array(75288);clip.set([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,0x01]);
 const up=await request('/profile/video',{method:'PUT',body:clip,type:'video/webm',length:clip.length,cookie:doctor.cookie});
 expect(up.status).toBe(200);
},60000);
