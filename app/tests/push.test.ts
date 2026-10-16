import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import app from '../server/index';
import {createDatabase} from './db-adapter';
it('push test sends only to an owned device, limits repeats and removes expired subscriptions',async()=>{
 const db=createDatabase(),sent:string[]=[],origin='https://push.test';let status=0;
 const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async(sub:{endpoint:string},body:string)=>{if(status)throw {statusCode:status};sent.push(sub.endpoint+body);}};
 async function request(path:string,body?:unknown,cookie?:string){return app.request(origin+'/api'+path,{method:body?'POST':'GET',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined},env);}
 async function register(email:string){const r=await request('/auth/register',{name:'Тест push',email,password:'push-test-password-long',role:'patient',consent:true,adult:true});expect(r.status).toBe(201);return {cookie:r.headers.get('set-cookie')!.split(';')[0],id:(await r.json() as any).user.id};}
 try{const a=await register('push-a@example.com'),b=await register('push-b@example.com');const endpoint='https://fcm.googleapis.com/fcm/send/owned';const subscription={endpoint,keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};
 expect((await request('/notifications/test',{endpoint})).status).toBe(401);
 expect((await request('/notifications/subscribe',subscription,a.cookie)).status).toBe(200);
 expect((await request('/notifications/test',{endpoint},b.cookie)).status).toBe(404);expect(sent).toHaveLength(0);
 expect((await request('/notifications/test',{endpoint},a.cookie)).status).toBe(200);expect(sent).toHaveLength(1);expect(sent[0]).not.toContain('Тест push');
 expect((await request('/notifications/test',{endpoint},a.cookie)).status).toBe(429);
 await db.binding.prepare("DELETE FROM deliveries WHERE user_id=?").bind(a.id).run();status=410;
 expect((await request('/notifications/test',{endpoint},a.cookie)).status).toBe(410);expect(await db.binding.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint=?').bind(endpoint).first()).toBeNull();
 }finally{db.close();}
},20000);
it('notification click focuses and navigates to the correct same-origin workspace',async()=>{
 const listeners:Record<string,Function>={},notifications:any[]=[],calls:string[]=[];
 const client={url:'https://ryadom.test/#/settings',navigate:async(url:string)=>{calls.push(url);},focus:async()=>{calls.push('focus');}};
 const self={location:{origin:'https://ryadom.test'},addEventListener:(type:string,handler:Function)=>{listeners[type]=handler;},registration:{showNotification:async(title:string,options:unknown)=>{notifications.push({title,options});}},clients:{matchAll:async()=>[client],openWindow:async(url:string)=>{calls.push('open:'+url);}}};
 runInNewContext(readFileSync('public/push-events.js','utf8'),{self,URL});
 let pending:Promise<unknown>=Promise.resolve();const waitUntil=(p:Promise<unknown>)=>{pending=p;};
 listeners.push({data:{json:()=>({title:'Рядом',body:'Новые материалы',url:'/#/patients'})},waitUntil});await pending;
 expect(notifications[0].options.data.url).toBe('https://ryadom.test/#/patients');
 listeners.notificationclick({notification:{data:notifications[0].options.data,close:()=>{}},waitUntil});await pending;expect(calls).toEqual(['https://ryadom.test/#/patients','focus']);
 listeners.push({data:{json:()=>({url:'https://external.test/'})},waitUntil});await pending;expect(notifications[1].options.data.url).toBe('https://ryadom.test/#/today');
 self.clients.matchAll=async()=>[];listeners.notificationclick({notification:{data:{url:'https://external.test'},close:()=>{}},waitUntil});await pending;expect(calls.at(-1)).toBe('open:https://ryadom.test/#/today');
});
