import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User,CustomPractice} from '../src/shared';
import {database,one,many,run,logAction} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

// A doctor's own practice. Stock practices stay in code and are read-only; these are written by doctors.
export const practiceCategories=['Внимание вокруг','Мысли и чувства','Забота о себе'] as const;
export const templateSchema=z.object({
 title:z.string().trim().min(3,'Укажите название практики').max(80),
 subtitle:z.string().trim().max(160).default(''),
 minutes:z.number().int().min(1,'Длительность от 1 минуты').max(15,'Длительность до 15 минут'),
 category:z.enum(practiceCategories),
 basis:z.string().trim().max(160).default(''),
 description:z.string().trim().max(600).default(''),
 steps:z.array(z.object({
  title:z.string().trim().min(2,'Назовите шаг').max(80),
  text:z.string().trim().min(3,'Опишите шаг').max(400),
 })).min(1,'Добавьте хотя бы один шаг').max(8,'Шагов не больше 8'),
});
export type TemplateInput=z.infer<typeof templateSchema>;

type Row={id:string;doctor_id:string;title:string;subtitle:string;minutes:number;category:string;basis:string;description:string;steps:string;archived_at:number|null;created_at:number;updated_at:number};

const PHOTO_MAX=5*1024*1024, VIDEO_MAX=50*1024*1024;
export const practiceMediaLimit=(kind:string)=>kind==='video'?VIDEO_MAX:PHOTO_MAX;
// Signatures: JPEG FF D8 FF, PNG 89 50 4E 47 0D 0A 1A 0A, WebP 'RIFF' .... 'WEBP', MP4 'ftyp' at byte 4, WebM EBML 1A 45 DF A3.
export function mediaKind(bytes:Uint8Array){
 const at=(i:number,...v:number[])=>v.every((x,k)=>bytes[i+k]===x);
 if(bytes.length>3&&at(0,0xff,0xd8,0xff))return {kind:'photo',mime:'image/jpeg'};
 if(bytes.length>8&&at(0,0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))return {kind:'photo',mime:'image/png'};
 if(bytes.length>12&&at(0,0x52,0x49,0x46,0x46)&&at(8,0x57,0x45,0x42,0x50))return {kind:'photo',mime:'image/webp'};
 if(bytes.length>12&&at(4,0x66,0x74,0x79,0x70))return {kind:'video',mime:'video/mp4'};
 if(bytes.length>4&&at(0,0x1a,0x45,0xdf,0xa3))return {kind:'video',mime:'video/webm'};
 return null;
}

function publicPractice(row:Row,media:Set<string>):CustomPractice{
 const url=(kind:string)=>media.has(kind)?`/api/practices/${row.id}/media/${kind}?v=${row.updated_at}`:null;
 return {id:`custom:${row.id}`,title:row.title,subtitle:row.subtitle,minutes:row.minutes,category:row.category,basis:row.basis,description:row.description,
  steps:JSON.parse(row.steps),archived:!!row.archived_at,photoUrl:url('photo'),videoUrl:url('video')};
}
async function mediaFor(db:D1Database,ids:string[]){
 const map=new Map<string,Set<string>>();if(!ids.length)return map;
 const placeholders=ids.map(()=> '?').join(',');
 const rows=await many<{practice_id:string;kind:string}>(db,`SELECT practice_id,kind FROM practice_media WHERE practice_id IN (${placeholders})`,...ids);
 for(const r of rows){if(!map.has(r.practice_id))map.set(r.practice_id,new Set());map.get(r.practice_id)!.add(r.kind);}
 return map;
}

// Practices a patient's plan refers to. Archived practices stay visible to patients who already have them.
export async function customPracticesFor(db:D1Database,refs:string[]){
 const ids=refs.filter(r=>r.startsWith('custom:')).map(r=>r.slice(7));
 if(!ids.length)return [] as CustomPractice[];
 const placeholders=ids.map(()=>'?').join(',');
 const rows=await many<Row>(db,`SELECT * FROM practice_templates WHERE id IN (${placeholders})`,...ids);
 const media=await mediaFor(db,rows.map(r=>r.id));
 return rows.map(r=>publicPractice(r,media.get(r.id)??new Set()));
}

// Plans may only reference practices written by the doctor who sets them.
// Refs that cannot go into a plan: someone else's practice, or one that is archived.
export async function foreignCustomRefs(db:D1Database,doctorId:string,refs:string[]){
 const ids=refs.filter(r=>r.startsWith('custom:')).map(r=>r.slice(7));
 if(!ids.length)return [] as string[];
 const placeholders=ids.map(()=>'?').join(',');
 const usable=new Set((await many<{id:string}>(db,`SELECT id FROM practice_templates WHERE doctor_id=? AND archived_at IS NULL AND id IN (${placeholders})`,doctorId,...ids)).map(r=>r.id));
 return ids.filter(id=>!usable.has(id)).map(id=>`custom:${id}`);
}

async function ownTemplate(db:D1Database,id:string,doctorId:string){
 return one<Row>(db,'SELECT * FROM practice_templates WHERE id=? AND doctor_id=?',id,doctorId);
}

export function practiceTemplateRoutes(app:App){
 app.get('/api/doctor/practices',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const rows=await many<Row>(database(c.env),'SELECT * FROM practice_templates WHERE doctor_id=? ORDER BY archived_at IS NOT NULL, updated_at DESC',user.id);
  const media=await mediaFor(database(c.env),rows.map(r=>r.id));
  return c.json({practices:rows.map(r=>publicPractice(r,media.get(r.id)??new Set()))});
 });
 app.post('/api/doctor/practices',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const parsed=templateSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const db=database(c.env),id=crypto.randomUUID(),now=Date.now(),d=parsed.data;
  await run(db,'INSERT INTO practice_templates (id,doctor_id,title,subtitle,minutes,category,basis,description,steps,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id,user.id,d.title,d.subtitle,d.minutes,d.category,d.basis,d.description,JSON.stringify(d.steps),now,now);
  await logAction(db,user.id,'create_practice',id);
  return c.json({practice:publicPractice({id,doctor_id:user.id,title:d.title,subtitle:d.subtitle,minutes:d.minutes,category:d.category,basis:d.basis,description:d.description,steps:JSON.stringify(d.steps),archived_at:null,created_at:now,updated_at:now},new Set())},201);
 });
 app.put('/api/doctor/practices/:id',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const db=database(c.env),id=c.req.param('id');
  const row=await ownTemplate(db,id,user.id);if(!row)return c.json({error:'Практика не найдена'},404);
  if(row.archived_at)return c.json({error:'Архивную практику нельзя менять. Создайте новую.'},409);
  const parsed=templateSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const d=parsed.data,now=Date.now();
  await run(db,'UPDATE practice_templates SET title=?,subtitle=?,minutes=?,category=?,basis=?,description=?,steps=?,updated_at=? WHERE id=? AND doctor_id=?',d.title,d.subtitle,d.minutes,d.category,d.basis,d.description,JSON.stringify(d.steps),now,id,user.id);
  await logAction(db,user.id,'update_practice',id);
  const media=await mediaFor(db,[id]);
  return c.json({practice:publicPractice({...row,title:d.title,subtitle:d.subtitle,minutes:d.minutes,category:d.category,basis:d.basis,description:d.description,steps:JSON.stringify(d.steps),updated_at:now},media.get(id)??new Set())});
 });
 // Archiving keeps the practice for patients who already have it in a plan, and removes it from new plans.
 app.post('/api/doctor/practices/:id/archive',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const db=database(c.env),id=c.req.param('id');
  if(!await ownTemplate(db,id,user.id))return c.json({error:'Практика не найдена'},404);
  await run(db,'UPDATE practice_templates SET archived_at=COALESCE(archived_at,?) WHERE id=? AND doctor_id=?',Date.now(),id,user.id);
  await logAction(db,user.id,'archive_practice',id);
  return c.json({ok:true});
 });
 app.put('/api/doctor/practices/:id/media/:kind',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const kind=c.req.param('kind');if(kind!=='photo'&&kind!=='video')return c.json({error:'Неизвестный тип файла'},400);
  const db=database(c.env),id=c.req.param('id');
  const row=await ownTemplate(db,id,user.id);if(!row)return c.json({error:'Практика не найдена'},404);
  if(row.archived_at)return c.json({error:'Архивную практику нельзя менять'},409);
  const declared=Number(c.req.header('Content-Length')||0);if(!declared||declared>practiceMediaLimit(kind))return c.json({error:kind==='video'?'Видео должно быть не больше 50 МБ':'Фото должно быть не больше 5 МБ'},413);
  const bytes=new Uint8Array(await c.req.arrayBuffer());if(bytes.length>practiceMediaLimit(kind))return c.json({error:kind==='video'?'Видео должно быть не больше 50 МБ':'Фото должно быть не больше 5 МБ'},413);
  const found=mediaKind(bytes);
  if(!found||found.kind!==kind)return c.json({error:kind==='video'?'Загрузите видео в формате MP4 или WebM':'Загрузите фото в формате JPG, PNG или WebP'},400);
  const now=Date.now();
  await db.batch([
   db.prepare('INSERT INTO practice_media (practice_id,kind,mime,size,data) VALUES (?,?,?,?,?) ON CONFLICT(practice_id,kind) DO UPDATE SET mime=excluded.mime,size=excluded.size,data=excluded.data').bind(id,kind,found.mime,bytes.length,bytes),
   db.prepare('UPDATE practice_templates SET updated_at=? WHERE id=?').bind(now,id),
  ]);
  await logAction(db,user.id,'update_practice_media',id);
  return c.json({ok:true,url:`/api/practices/${id}/media/${kind}?v=${now}`});
 });
 app.delete('/api/doctor/practices/:id/media/:kind',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Практики доступны врачу'},403);
  const kind=c.req.param('kind');const db=database(c.env),id=c.req.param('id');
  if(!await ownTemplate(db,id,user.id))return c.json({error:'Практика не найдена'},404);
  await db.batch([db.prepare('DELETE FROM practice_media WHERE practice_id=? AND kind=?').bind(id,kind),db.prepare('UPDATE practice_templates SET updated_at=? WHERE id=?').bind(Date.now(),id)]);
  await logAction(db,user.id,'delete_practice_media',id);
  return c.json({ok:true});
 });
 // The file is served to the doctor who wrote it, and to patients who have the practice in their plan.
 app.get('/api/practices/:id/media/:kind',async c=>{
  const user=c.get('user'),db=database(c.env),id=c.req.param('id'),kind=c.req.param('kind');
  const allowed=await one(db,'SELECT id FROM practice_templates WHERE id=? AND doctor_id=?',id,user.id)
   ||(user.role==='patient'&&await one(db,'SELECT patient_id FROM plans WHERE patient_id=? AND data LIKE ?',user.id,`%"custom:${id}"%`));
  if(!allowed)return c.json({error:'Файл недоступен'},403);
  const row=await one<{mime:string;size:number;data:ArrayBuffer}>(db,'SELECT mime,size,data FROM practice_media WHERE practice_id=? AND kind=?',id,kind);
  if(!row)return c.notFound();
  const bytes=new Uint8Array(row.data);
  return c.body(bytes,200,{'Content-Type':row.mime,'Content-Length':String(row.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 });
}
