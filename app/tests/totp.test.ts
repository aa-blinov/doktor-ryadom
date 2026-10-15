import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {base32Encode,totpCode} from '../server/totp';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://totp.test',password='totp-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,body?:unknown,cookie?:string){
 return app.request(origin+'/api'+path,{method:body?'POST':'GET',headers:{Origin:origin,'CF-Connecting-IP':`10.9.0.${++ip}`,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined},env);
}
async function register(email:string){
 const r=await request('/auth/register',{name:'Тест код',email,password,role:'doctor',consent:true});
 expect(r.status).toBe(201);
 return r.headers.get('set-cookie')!.split(';')[0];
}
const step=()=>Math.floor(Date.now()/30000);
async function enable(cookie:string){
 const setup=await request('/account/totp/setup',{password},cookie);expect(setup.status).toBe(200);
 const {secret,uri}=await setup.json() as {secret:string;uri:string};
 expect(uri).toContain('otpauth://totp/');
 const s=step();
 expect((await request('/account/totp/enable',{code:await totpCode(secret,s)},cookie)).status).toBe(200);
 return {secret,s};
}

it('matches the RFC 6238 reference codes',async()=>{
 const secret=base32Encode(new TextEncoder().encode('12345678901234567890'));
 expect(await totpCode(secret,1)).toBe('287082');
 expect(await totpCode(secret,37037036)).toBe('081804');
});

it('asks for the code after the password, rejects wrong and replayed codes',async()=>{
 const email='totp-login@example.com',cookie=await register(email);
 const {secret,s}=await enable(cookie);
 expect(await (await request('/account/totp',undefined,cookie)).json()).toEqual({enabled:true});
 const noCode=await request('/auth/login',{email,password});
 expect(noCode.status).toBe(428);expect(noCode.headers.get('set-cookie')).toBeNull();
 expect((await request('/auth/login',{email,password,code:'000000'})).status).toBe(401);
 const code=await totpCode(secret,s+1);
 const ok=await request('/auth/login',{email,password,code});
 expect(ok.status).toBe(200);expect(ok.headers.get('set-cookie')).toContain('ryadom_session=');
 expect(Object.keys((await ok.json() as {user:object}).user)).not.toContain('totp_secret');
 expect((await request('/auth/login',{email,password,code})).status).toBe(401);
 expect((await request('/auth/login',{email,password:'wrong-password-value',code:await totpCode(secret,s+1)})).status).toBe(401);
},60000);

it('turns off only with the password and a fresh code',async()=>{
 const email='totp-off@example.com',cookie=await register(email);
 const {secret,s}=await enable(cookie);
 expect((await request('/account/totp/disable',{password:'wrong-password-value',code:await totpCode(secret,s+1)},cookie)).status).toBe(403);
 expect((await request('/account/totp/disable',{password,code:await totpCode(secret,s)},cookie)).status).toBe(403);
 expect((await request('/account/totp/disable',{password,code:await totpCode(secret,s+1)},cookie)).status).toBe(200);
 expect((await request('/auth/login',{email,password})).status).toBe(200);
},60000);

it('a recovery code, the lost-phone path, turns the second factor off',async()=>{
 const email='totp-lost@example.com',cookie=await register(email);
 await enable(cookie);
 const codes=await (await request('/account/recovery-codes',{password},cookie)).json() as {codes:string[]};
 const newPassword='new-totp-password-long';
 expect((await request('/auth/recover-code',{email,code:codes.codes[0],password:newPassword})).status).toBe(200);
 expect((await request('/auth/login',{email,password:newPassword})).status).toBe(200);
},60000);
