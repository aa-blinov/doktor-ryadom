import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User} from '../src/shared';
import {database,one,run,logAction} from './db';
import {storedProfile} from './profiles';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
const category=z.enum(['education','courses','workHistory']);
const change=z.object({shared:z.boolean()}).strict();
const upload=z.object({category,entry:z.string().trim().min(1).max(2000),filename:z.string().trim().min(1).max(160),data:z.string().max(6990508).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
function decode(s:string){return Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));}
function mime(bytes:Uint8Array){const head=new TextDecoder().decode(bytes.slice(0,12));if(head.startsWith('%PDF-'))return 'application/pdf';if(bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';if(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP')return 'image/webp';return null;}
export function profileDocumentRoutes(app:App){
 app.post('/api/profile/documents',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Документы профиля доступны для врача'},403);
  const parsed=upload.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Выберите PDF, JPG, PNG или WebP размером до 5 МБ'},400);
  let bytes:Uint8Array;try{bytes=decode(parsed.data.data);}catch{return c.json({error:'Не удалось прочитать файл'},400);}const type=mime(bytes);if(!type||bytes.length>5242880)return c.json({error:'Выберите PDF, JPG, PNG или WebP размером до 5 МБ'},400);
  const db=database(c.env),profile=await storedProfile(db,user.id);if(!(profile.data[parsed.data.category]??'').split('\n').map(s=>s.trim()).includes(parsed.data.entry))return c.json({error:'Сначала сохраните запись об образовании, курсе или опыте работы'},409);
  const count=await one<{count:number}>(db,'SELECT count(*) AS count FROM profile_documents WHERE user_id=?',user.id);if((count?.count??0)>=20)return c.json({error:'Можно прикрепить до 20 документов. Удалите ненужный файл'},409);
  const id=crypto.randomUUID(),filename=parsed.data.filename.replace(/[\r\n\x00-\x1f/\\]/g,'_');await run(db,'INSERT INTO profile_documents VALUES (?,?,?,?,?,?,?,0,?)',id,user.id,parsed.data.category,parsed.data.entry,filename,type,parsed.data.data,Date.now());await logAction(db,user.id,'upload_profile_document',id);return c.json({id},201);
 });
 app.put('/api/profile/documents/:id',async c=>{const user=c.get('user'),parsed=change.safeParse(await c.req.json());if(user.role!=='doctor')return c.json({error:'Этот раздел доступен врачу'},403);if(!parsed.success)return c.json({error:'Укажите видимость документа'},400);const result=await run(database(c.env),'UPDATE profile_documents SET shared=? WHERE id=? AND user_id=?',parsed.data.shared?1:0,c.req.param('id'),user.id);if(!result.meta.changes)return c.notFound();await logAction(database(c.env),user.id,'share_profile_document',c.req.param('id'));return c.json({ok:true});});
 app.delete('/api/profile/documents/:id',async c=>{const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Этот раздел доступен врачу'},403);const result=await run(database(c.env),'DELETE FROM profile_documents WHERE id=? AND user_id=?',c.req.param('id'),user.id);return result.meta.changes?c.json({ok:true}):c.notFound();});
 app.get('/api/profile/documents/:id',async c=>{
  const user=c.get('user'),db=database(c.env),doc=await one<{user_id:string;category:'education'|'courses'|'workHistory';entry:string;filename:string;mime:string;data:string;shared:number}>(db,'SELECT * FROM profile_documents WHERE id=?',c.req.param('id'));if(!doc)return c.notFound();
  if(doc.user_id!==user.id){const p=await storedProfile(db,doc.user_id),visibility=('show'+doc.category[0].toUpperCase()+doc.category.slice(1)) as 'showEducation';if(!doc.shared||p.data[visibility]===false||!(p.data[doc.category]??'').split('\n').map(x=>x.trim()).includes(doc.entry)||!await one(db,'SELECT patient_id FROM links WHERE doctor_id=? AND patient_id=? AND revoked_at IS NULL',doc.user_id,user.id))return c.json({error:'Документ недоступен'},403);}
  return c.body(decode(doc.data),200,{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox"});
 });
}
