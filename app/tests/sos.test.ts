import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://sos.test',env={DB:db.binding,ASSETS:{} as Fetcher};
async function request(path:string,body?:unknown,cookie?:string){
 const r=await app.request(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
 return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
afterAll(()=>db.close());
it('a second SOS tap within a minute is the same signal',async()=>{
 const p=await request('/auth/register',{name:'Тест SOS',email:'sos-patient@example.com',password:'test-sos-password-long',role:'patient',consent:true,adult:true});
 const count=async()=>(await db.binding.prepare('SELECT count(*) AS n FROM sos_events WHERE patient_id=?').bind(p.data.user.id).first<{n:number}>())!.n;
 expect((await request('/patient/sos',{},p.cookie)).status).toBe(200);
 expect((await request('/patient/sos',{},p.cookie)).status).toBe(200);
 expect(await count()).toBe(1);
 await db.binding.prepare('UPDATE sos_events SET created_at=? WHERE patient_id=?').bind(Date.now()-120000,p.data.user.id).run();
 expect((await request('/patient/sos',{},p.cookie)).status).toBe(200);
 expect(await count()).toBe(2);
});
