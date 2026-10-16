import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User} from '../src/shared';
import {one,many,run,database} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

// Each person's own inbox. The same table feeds the push and email queue; read marks live on the row.
export function inboxRoutes(app:App){
 app.get('/api/inbox',async c=>{
  const db=database(c.env),id=c.get('user').id;
  const items=await many<{key:string;body:string;url:string;created_at:number;read_at:number|null}>(db,'SELECT key,body,url,created_at,read_at FROM notices WHERE user_id=? ORDER BY created_at DESC LIMIT 100',id);
  const unread=await one<{n:number}>(db,'SELECT COUNT(*) AS n FROM notices WHERE user_id=? AND read_at IS NULL',id);
  return c.json({unread:unread?.n??0,items:items.map(i=>({id:i.key,body:i.body,url:i.url,createdAt:i.created_at,read:i.read_at!==null}))});
 });
 app.post('/api/inbox/read',async c=>{
  const parsed=z.object({ids:z.array(z.string().min(1).max(200)).max(200).optional(),all:z.boolean().optional()}).safeParse(await c.req.json());
  if(!parsed.success)return c.json({error:'Укажите, какие уведомления отметить'},400);
  const db=database(c.env),id=c.get('user').id,now=Date.now();
  if(parsed.data.all)await run(db,'UPDATE notices SET read_at=? WHERE user_id=? AND read_at IS NULL',now,id);
  else if(parsed.data.ids?.length){
   // Only the signed-in person's own notices can be marked, whatever ids they send.
   const ids=parsed.data.ids;
   await db.batch(ids.map(key=>db.prepare('UPDATE notices SET read_at=? WHERE user_id=? AND key=? AND read_at IS NULL').bind(now,id,key)));
  }
  return c.json({ok:true});
 });
}
