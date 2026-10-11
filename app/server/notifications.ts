import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User} from '../src/shared';
import {database,one,many,run} from './db';
export function allowedPushEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.push.apple.com'));}catch{return false;}}
const subscription=z.object({endpoint:z.string().max(2048).refine(allowedPushEndpoint),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[\w-]{87}$/),auth:z.string().regex(/^[\w-]{22}$/)})});
export function notificationRoutes(app:Hono<{Bindings:Env;Variables:{user:User}}>){
 app.get('/api/notifications',async c=>c.json({publicKey:c.env.PUSH_PUBLIC_KEY??null,email:!!c.env.MAIL,endpoints:(await many<{endpoint:string}>(database(c.env),'SELECT endpoint FROM push_subscriptions WHERE user_id=?',c.get('user').id)).map(r=>r.endpoint)}));
 app.post('/api/notifications/subscribe',async c=>{
  if(!c.env.PUSH_PUBLIC_KEY)return c.json({error:'Не удалось подключить уведомления. Попробуйте позже.'},503);
  const parsed=subscription.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Не удалось подключить уведомления этого браузера.'},400);
  const db=database(c.env),id=c.get('user').id;
  if(!await one(db,'SELECT endpoint FROM push_subscriptions WHERE endpoint=? AND user_id=?',parsed.data.endpoint,id)){
   const count=await one<{count:number}>(db,'SELECT count(*) AS count FROM push_subscriptions WHERE user_id=?',id);if((count?.count??0)>=10)return c.json({error:'Подключено слишком много устройств. Отключите уведомления на старых устройствах.'},400);
  }
  // Shared browser: the account that just enabled push owns this endpoint.
  await run(db,'INSERT INTO push_subscriptions VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,data=excluded.data,created_at=excluded.created_at',parsed.data.endpoint,id,JSON.stringify(parsed.data),Date.now());return c.json({ok:true});
 });
 app.post('/api/notifications/test',async c=>{
  if(!c.env.PUSH_SEND)return c.json({error:'Уведомления временно недоступны.'},503);
  const parsed=z.object({endpoint:z.string().max(2048)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Выберите подключённое устройство.'},400);
  const db=database(c.env),id=c.get('user').id;
  const sub=await one<{data:string}>(db,'SELECT data FROM push_subscriptions WHERE endpoint=? AND user_id=?',parsed.data.endpoint,id);if(!sub)return c.json({error:'Устройство не подключено. Включите уведомления снова.'},404);
  const claim=await run(db,'INSERT OR IGNORE INTO deliveries VALUES (?,?,?,?)',`test:${id}:${Math.floor(Date.now()/60000)}`,id,'test',Date.now());if(!claim.meta.changes)return c.json({error:'Подождите минуту перед повторной проверкой.'},429);
  try{await c.env.PUSH_SEND(JSON.parse(sub.data),'Это проверка уведомлений. Напоминания будут приходить по вашему расписанию.',c.get('user').role==='doctor'?'/#/patients':'/#/today');return c.json({ok:true});}catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410){await run(db,'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?',parsed.data.endpoint,id);return c.json({error:'Подписка больше не действует. Подключите устройство снова.'},410);}return c.json({error:'Не удалось отправить уведомление. Попробуйте позже.'},502);}
 });
 app.post('/api/notifications/unsubscribe',async c=>{
  const parsed=z.object({endpoint:z.string().max(2048)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте устройство.'},400);
  await run(database(c.env),'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?',parsed.data.endpoint,c.get('user').id);return c.json({ok:true});
 });
}
