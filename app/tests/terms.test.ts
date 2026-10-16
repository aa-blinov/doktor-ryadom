import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {TERMS_VERSION} from '../src/shared';
const db=createDatabase(),origin='https://terms.test',password='terms-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.9.0.${++ip}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined?'POST':'GET'),headers,body},env);
}
const termsOf=async(cookie:string)=>(await (await request('/me',{cookie})).json() as {user:{terms_version:string|null}}).user.terms_version;

it('registration needs 18+, records the agreement version, and a new version must be confirmed',async()=>{
 const base={name:'Соглашение Тест',email:'terms-adult@example.com',password,role:'patient',consent:true};
 expect((await request('/auth/register',{json:base})).status).toBe(400);
 const ok=await request('/auth/register',{json:{...base,adult:true}});
 expect(ok.status).toBe(201);
 const cookie=ok.headers.get('set-cookie')!.split(';')[0];
 expect(await termsOf(cookie)).toBe(TERMS_VERSION);
 db.binding.prepare('UPDATE users SET terms_version=NULL WHERE email=?').bind(base.email).run();
 expect(await termsOf(cookie)).toBeNull();
 expect((await request('/account/terms',{json:{},cookie})).status).toBe(200);
 expect(await termsOf(cookie)).toBe(TERMS_VERSION);
});
