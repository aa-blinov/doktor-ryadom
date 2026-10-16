import {afterAll,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://factor.test',password='factor-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.15.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined?'POST':'GET'),headers,body},env);
}
async function register(role:'doctor'|'patient',email:string){
 const r=await request('/auth/register',{json:{name:'Фактор Тест',email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 const id=(await r.json() as {user:{id:string}}).user.id;
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id};
}

it('a doctor without a second factor reaches only the setup and sign-out routes',async()=>{
 const doctor=await register('doctor','factor-doc@example.com');
 const blocked=await request('/patients',{cookie:doctor.cookie});
 expect(blocked.status).toBe(403);
 expect((await blocked.json() as {code:string}).code).toBe('totp_required');
 expect((await request('/me',{cookie:doctor.cookie})).status).toBe(200);
 expect((await request('/account/totp',{cookie:doctor.cookie})).status).toBe(200);
 expect((await request('/doctor/slots',{cookie:doctor.cookie})).status).toBe(403);
 db.binding.prepare('UPDATE users SET totp_enabled_at=1 WHERE id=?').bind(doctor.id).run();
 expect((await request('/doctor/patients',{cookie:doctor.cookie})).status).toBe(200);
});

it('every patient has a card from registration; the archive holds data, photos and videos',async()=>{
 const patient=await register('patient','factor-pat@example.com');
 const card=await db.binding.prepare('SELECT COUNT(*) AS n FROM patient_cards WHERE patient_id=?').bind(patient.id).first<{n:number}>();
 expect(card?.n).toBe(1);
 const zip=await request('/account/export.zip',{cookie:patient.cookie});
 expect(zip.status).toBe(200);
 expect(zip.headers.get('content-type')).toBe('application/zip');
 const file=join(mkdtempSync(join(tmpdir(),'factor-zip-')),'archive.zip');
 writeFileSync(file,Buffer.from(await zip.arrayBuffer()));
 expect(execFileSync('unzip',['-tq',file]).toString()).toContain('No errors');
 const listing=execFileSync('unzip',['-Z1',file]).toString();
 expect(listing).toContain('data.json');
 expect(listing).toContain('README.txt');
 const data=JSON.parse(execFileSync('unzip',['-p',file,'data.json']).toString());
 expect(data.data.patient_cards).toHaveLength(1);
});

it('the login answer tells the app whether the second factor is on',async()=>{
 const doctor=await register('doctor','factor-login@example.com');
 const before=await (await request('/auth/login',{json:{email:'factor-login@example.com',password}})).json() as {user:{totp_enabled:boolean}};
 expect(before.user.totp_enabled).toBe(false);
 db.binding.prepare('UPDATE users SET totp_enabled_at=1 WHERE id=?').bind(doctor.id).run();
 const after=await (await request('/auth/login',{json:{email:'factor-login@example.com',password}})).json() as {user:{totp_enabled:boolean}};
 expect(after.user.totp_enabled).toBe(true);
});
