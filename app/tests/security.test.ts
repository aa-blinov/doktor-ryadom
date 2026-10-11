import {afterAll,expect,it} from 'vitest';
import {api,ApiError} from '../src/api';
import app from '../server/index';
import {createDatabase} from './db-adapter';

const db=createDatabase(),origin='https://security.test',env={DB:db.binding,ASSETS:{} as Fetcher,MAIL:{send:async()=>{}}};
const password='test-security-password-long';
afterAll(()=>db.close());

async function request(path:string,body?:unknown,cookie?:string,method?:string,headers:Record<string,string>={}){
 const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,headers:r.headers,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}

it('api() rejects absolute, protocol-relative and traversal paths without calling fetch',async()=>{
 const calls:string[]=[];
 const original=globalThis.fetch;
 globalThis.fetch=(async (input:RequestInfo|URL)=>{calls.push(String(input));return new Response('{}');}) as typeof fetch;
 try{
  for(const bad of ['https://evil.test/x','//evil.test/x','/patient/../../admin','/patient\\x','http:/x']){
   await expect(api(bad)).rejects.toBeInstanceOf(ApiError);
  }
  expect(calls).toEqual([]);
  await api('/me');
  expect(calls).toEqual(['/api/me']);
 }finally{globalThis.fetch=original;}
});

it('sets a strict Content-Security-Policy and security headers on API responses',async()=>{
 const r=await request('/health');
 const csp=r.headers.get('Content-Security-Policy')??'';
 expect(csp).toContain("default-src 'self'");
 expect(csp).toContain("frame-ancestors 'none'");
 expect(csp).not.toContain('unsafe-eval');
 expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
 expect(r.headers.get('X-Frame-Options')).toBe('DENY');
 expect(r.headers.get('Referrer-Policy')).toBe('same-origin');
});

it('rejects cross-origin mutations and non-JSON bodies',async()=>{
 const foreign=await app.request(origin+'/api/auth/login',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({email:'a@b.test',password})},{...env});
 expect(foreign.status).toBe(403);
 const notJson=await app.request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'x'},{...env});
 expect(notJson.status).toBe(415);
});

it('register does not confirm whether an email already exists',async()=>{
 const email='enum-probe@security.test';
 const first=await request('/auth/register',{email,name:'Проба Первая',password,role:'patient',consent:true});
 expect(first.status).toBe(201);
 const second=await request('/auth/register',{email,name:'Проба Вторая',password,role:'patient',consent:true});
 expect(second.status).toBe(409);
 expect(String(second.data.error)).not.toMatch(/уже зарегистрирован/i);
 expect(String(second.data.error)).not.toMatch(/already/i);
});

it('login returns the same error for unknown user and wrong password',async()=>{
 const unknown=await request('/auth/login',{email:'nobody@security.test',password});
 const wrong=await request('/auth/login',{email:'enum-probe@security.test',password:'another-long-password'});
 expect(unknown.status).toBe(401);
 expect(wrong.status).toBe(401);
 expect(unknown.data.error).toBe(wrong.data.error);
});

it('rate-limits invite preview against brute force',async()=>{
 const doctor=await request('/auth/register',{email:'invite-doc@security.test',name:'Врач Приглашения',password,role:'doctor',consent:true});
 await db.binding.prepare('UPDATE users SET specialist_verified_at=?, specialty_kind=? WHERE id=?').bind(Date.now(),'psychiatrist',doctor.data.user.id).run();
 let limited=0;
 for(let i=0;i<20;i++){
  const r=await request('/invites/'+String(i).padStart(12,'A').slice(0,12));
  if(r.status===429){limited++;break;}
 }
 expect(limited).toBe(1);
});
