import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import {specialtyKinds,type User} from '../src/shared';
import {one,many,run,logAction,database} from './db';
import {doctorProfile,storedProfile} from './profiles';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

const reviewSchema=z.object({rating:z.number().int().min(1).max(5),body:z.string().trim().max(1000).default('')});

const firstName=(name:string)=>name.trim().split(/\s+/)[0]||'Пациент';
const VERIFIED="u.role='doctor' AND u.specialist_verified_at IS NOT NULL AND u.blocked_at IS NULL";

type Row={id:string;name:string;specialty_kind:string|null;city:string|null;rating:number|null;review_count:number};
async function card(db:D1Database,row:Row){
 const {data,updated}=await storedProfile(db,row.id);
 return {id:row.id,name:row.name,kind:row.specialty_kind,city:row.city??'',specialty:data.specialty??'',clinic:data.clinic??'',experienceYears:data.experienceYears??null,focusAreas:data.focusAreas??'',about:(data.about??'').slice(0,180),photoUrl:data.photo?`/api/profiles/${row.id}/photo?v=${updated}`:null,rating:row.rating===null?null:Math.round(row.rating*10)/10,reviewCount:row.review_count};
}
const SELECT_DOCTOR=`SELECT u.id,u.name,u.specialty_kind,
 (SELECT r.city FROM specialist_requests r WHERE r.doctor_id=u.id AND r.status='approved' ORDER BY r.updated_at DESC LIMIT 1) AS city,
 (SELECT AVG(v.rating) FROM doctor_reviews v WHERE v.doctor_id=u.id AND v.hidden_at IS NULL) AS rating,
 (SELECT COUNT(*) FROM doctor_reviews v WHERE v.doctor_id=u.id AND v.hidden_at IS NULL) AS review_count
 FROM users u WHERE ${VERIFIED}`;

export function directoryRoutes(app:App){
 // Catalogue is for signed-in patients (and the administrator who moderates reviews).
 app.use('/api/directory/*',async(c,next)=>{const role=c.get('user').role;if(role!=='patient'&&role!=='admin')return c.json({error:'Каталог врачей доступен пациентам.'},403);await next();});
 app.use('/api/directory',async(c,next)=>{const role=c.get('user').role;if(role!=='patient'&&role!=='admin')return c.json({error:'Каталог врачей доступен пациентам.'},403);await next();});

 app.get('/api/directory',async c=>{
  const db=database(c.env),kind=c.req.query('kind')??'',q=(c.req.query('q')??'').trim().toLowerCase(),city=(c.req.query('city')??'').trim().toLowerCase();
  const rows=await many<Row>(db,`${SELECT_DOCTOR} ORDER BY review_count DESC, u.name LIMIT 200`);
  let cards=await Promise.all(rows.map(r=>card(db,r)));
  if((specialtyKinds as readonly string[]).includes(kind))cards=cards.filter(x=>x.kind===kind);
  if(q)cards=cards.filter(x=>[x.name,x.specialty,x.clinic,x.focusAreas].join(' ').toLowerCase().includes(q));
  if(city)cards=cards.filter(x=>x.city.toLowerCase().includes(city));
  const cities=[...new Set(rows.map(r=>r.city).filter((x):x is string=>!!x))].sort();
  return c.json({doctors:cards,cities});
 });

 app.get('/api/directory/:id',async c=>{
  const db=database(c.env),user=c.get('user'),id=c.req.param('id');
  const row=await one<Row>(db,`${SELECT_DOCTOR} AND u.id=?`,id);
  if(!row)return c.json({error:'Врач не найден.'},404);
  const [base,profile,reviews,mine,link,pending]=await Promise.all([
   card(db,row),doctorProfile(db,id,false),
   many<{id:string;rating:number;body:string;created_at:number;hidden_at:number|null;name:string}>(db,'SELECT v.id,v.rating,v.body,v.created_at,v.hidden_at,u.name FROM doctor_reviews v JOIN users u ON u.id=v.patient_id WHERE v.doctor_id=? AND (v.hidden_at IS NULL OR ?) ORDER BY v.created_at DESC LIMIT 100',id,user.role==='admin'?1:0),
   user.role==='patient'?one<{rating:number;body:string;hidden_at:number|null}>(db,'SELECT rating,body,hidden_at FROM doctor_reviews WHERE doctor_id=? AND patient_id=?',id,user.id):null,
   user.role==='patient'?one<{doctor_id:string}>(db,'SELECT doctor_id FROM links WHERE patient_id=? AND revoked_at IS NULL',user.id):null,
   user.role==='patient'?one<{id:string}>(db,"SELECT id FROM connection_requests WHERE patient_id=? AND doctor_id=? AND status='pending'",user.id,id):null,
  ]);
  return c.json({doctor:{...base,about:profile.about,address:profile.address,education:profile.education,courses:profile.courses,workHistory:profile.workHistory},
   reviews:reviews.map(r=>({id:r.id,rating:r.rating,body:r.body,createdAt:r.created_at,author:firstName(r.name),hidden:!!r.hidden_at})),
   mine:mine?{rating:mine.rating,body:mine.body,hidden:!!mine.hidden_at}:null,
   connection:{linkedToThis:link?.doctor_id===id,linkedToOther:!!link&&link.doctor_id!==id,pendingRequestId:pending?.id??null}});
 });

 app.put('/api/directory/:id/review',async c=>{
  const user=c.get('user'),db=database(c.env),id=c.req.param('id');
  if(user.role!=='patient')return c.json({error:'Отзыв может оставить пациент.'},403);
  const parsed=reviewSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Поставьте оценку от 1 до 5. Текст отзыва не длиннее 1000 символов.'},400);
  if(!await one(db,`${SELECT_DOCTOR} AND u.id=?`,id))return c.json({error:'Врач не найден.'},404);
  const now=Date.now();
  await run(db,'INSERT INTO doctor_reviews (id,doctor_id,patient_id,rating,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(doctor_id,patient_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,updated_at=excluded.updated_at',crypto.randomUUID(),id,user.id,parsed.data.rating,parsed.data.body,now,now);
  await logAction(db,user.id,'review_doctor',id);
  return c.json({ok:true});
 });
 app.delete('/api/directory/:id/review',async c=>{
  const user=c.get('user'),db=database(c.env);
  if(user.role!=='patient')return c.json({error:'Отзыв может удалить его автор.'},403);
  await run(db,'DELETE FROM doctor_reviews WHERE doctor_id=? AND patient_id=?',c.req.param('id'),user.id);
  return c.json({ok:true});
 });
 app.get('/api/admin/reviews',async c=>{
  const user=c.get('user'),db=database(c.env);
  if(user.role!=='admin')return c.json({error:'Раздел доступен только администратору.'},403);
  const rows=await many<{id:string;rating:number;body:string;created_at:number;hidden_at:number|null;patient:string;doctor:string}>(db,'SELECT v.id,v.rating,v.body,v.created_at,v.hidden_at,p.name AS patient,d.name AS doctor FROM doctor_reviews v JOIN users p ON p.id=v.patient_id JOIN users d ON d.id=v.doctor_id ORDER BY v.created_at DESC LIMIT 200');
  return c.json({reviews:rows.map((r,i)=>({id:r.id,rating:r.rating,body:r.body,createdAt:r.created_at,hidden:!!r.hidden_at,author:`Пациент ${rows.length-i}`,doctor:r.doctor}))});
 });
 app.post('/api/admin/reviews/:id/hide',async c=>{
  const user=c.get('user'),db=database(c.env);
  if(user.role!=='admin')return c.json({error:'Раздел доступен только администратору.'},403);
  const parsed=z.object({hidden:z.boolean()}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Укажите, скрыть или вернуть отзыв.'},400);
  const r=await run(db,'UPDATE doctor_reviews SET hidden_at=? WHERE id=?',parsed.data.hidden?Date.now():null,c.req.param('id'));
  if(!r.meta.changes)return c.json({error:'Отзыв не найден.'},404);
  await logAction(db,user.id,parsed.data.hidden?'hide_review':'show_review',c.req.param('id'));
  return c.json({ok:true});
 });

}
