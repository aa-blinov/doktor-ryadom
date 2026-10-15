import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://hardening.test',password='hardening-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
async function request(path:string,body?:unknown,cookie?:string,ip='hardening-client'){
 return app.request(origin+'/api'+path,{method:body?'POST':'GET',headers:{Origin:origin,'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined},env);
}
async function register(email:string){
 const r=await request('/auth/register',{name:'Тест защита',email,password,role:'patient',consent:true});
 expect(r.status).toBe(201);
 return {cookie:r.headers.get('set-cookie')!.split(';')[0]};
}
it('one account cannot be guessed by spreading attempts over many addresses',async()=>{
 await register('guess-target@example.com');
 let last=0;
 // The account limit is 30 an hour, so the 31st attempt from a fresh address must be refused.
 for(let i=0;i<31;i++){
  const r=await request('/auth/login',{email:'guess-target@example.com',password:'wrong-password-value'},undefined,`10.0.${i}.7`);
  last=r.status;
 }
 expect(last).toBe(429);
},120000);
