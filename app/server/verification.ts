import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import {specialtyKinds,type User} from '../src/shared';
import {one,many,run,logAction,database} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
const requestSchema=z.object({
 kind:z.enum(specialtyKinds),
 specialty:z.string().trim().min(2).max(80),
 license:z.string().trim().min(3).max(60),
 city:z.string().trim().min(2).max(80),
 note:z.string().trim().max(500).default(''),
});
const decisionSchema=z.object({decision:z.enum(['approve','needs_info','reject']),note:z.string().trim().max(500).default('')});
const isAdminUser=(user:User)=>user.role==='admin';
export function verificationRoutes(app:App){
 app.get('/api/doctor/verification',async c=>{
  const user=c.get('user'),db=database(c.env);
  const request=await one(db,'SELECT id,kind,specialty,license,city,note,status,admin_note,created_at,updated_at FROM specialist_requests WHERE doctor_id=? ORDER BY created_at DESC LIMIT 1',user.id);
  return c.json({verified:!!user.specialist_verified_at,request});
 });
 app.post('/api/doctor/verification',async c=>{
  const user=c.get('user'),db=database(c.env);
  if(user.role!=='doctor')return c.json({error:'Заявка доступна только врачам.'},403);
  if(user.specialist_verified_at)return c.json({error:'Профиль уже подтверждён.'},409);
  const parsed=requestSchema.safeParse(await c.req.json());
  if(!parsed.success)return c.json({error:'Проверьте специальность, номер лицензии и город.'},400);
  const e=parsed.data,now=Date.now();
  const open=await one<{id:string}>(db,"SELECT id FROM specialist_requests WHERE doctor_id=? AND status IN ('pending','needs_info') ORDER BY created_at DESC LIMIT 1",user.id);
  if(open){await run(db,"UPDATE specialist_requests SET kind=?,specialty=?,license=?,city=?,note=?,status='pending',updated_at=? WHERE id=?",e.kind,e.specialty,e.license,e.city,e.note,now,open.id);}
  else{await run(db,"INSERT INTO specialist_requests (id,doctor_id,kind,specialty,license,city,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?)",crypto.randomUUID(),user.id,e.kind,e.specialty,e.license,e.city,e.note,now,now);}
  await logAction(db,user.id,'submit_specialist_request',user.id);
  return c.json({ok:true});
 });
 app.get('/api/admin/verifications',async c=>{
  const db=database(c.env);
  if(!isAdminUser(c.get('user')))return c.json({error:'Раздел доступен только администратору.'},403);
  const rows=await many(db,"SELECT r.id,r.kind,r.specialty,r.license,r.city,r.note,r.status,r.admin_note,r.created_at,r.updated_at,u.name,u.email,u.specialist_verified_at FROM specialist_requests r JOIN users u ON u.id=r.doctor_id ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'needs_info' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 200");
  return c.json({requests:rows});
 });
 app.post('/api/admin/verifications/:id/decision',async c=>{
  const db=database(c.env),admin=c.get('user').id;
  if(!isAdminUser(c.get('user')))return c.json({error:'Раздел доступен только администратору.'},403);
  const parsed=decisionSchema.safeParse(await c.req.json());
  if(!parsed.success)return c.json({error:'Выберите решение.'},400);
  const {decision,note}=parsed.data;
  const cleanNote=String(note??'').trim();
  if((decision==='reject'||decision==='needs_info')&&!cleanNote)return c.json({error:'Напишите комментарий врачу, чтобы запросить уточнение или отклонить заявку.'},400);
  const now=Date.now();
  const req=await one<{doctor_id:string;status:string;kind:string|null;admin_note:string}>(db,'SELECT doctor_id,status,kind,admin_note FROM specialist_requests WHERE id=?',c.req.param('id'));
  if(!req)return c.json({error:'Заявка не найдена.'},404);
  if(req.doctor_id===admin)return c.json({error:'Свою заявку решает другой администратор.'},403);
  if(req.status!=='pending'&&req.status!=='needs_info')return c.json({error:'Заявка уже решена.'},409);
  if(decision==='approve'&&!req.kind)return c.json({error:'Укажите тип специалиста (психолог, психотерапевт или психиатр) до подтверждения.'},400);
  const status=decision==='approve'?'approved':decision==='needs_info'?'needs_info':'rejected';
  const noteOut=decision==='approve'&&!cleanNote?req.admin_note??'':cleanNote;
  await run(db,'UPDATE specialist_requests SET status=?,admin_note=?,reviewer_id=?,updated_at=? WHERE id=?',status,noteOut,admin,now,c.req.param('id'));
  if(decision==='approve')await run(db,'UPDATE users SET specialist_verified_at=?,specialty_kind=? WHERE id=?',now,req.kind,req.doctor_id);
  await logAction(db,admin,'review_specialist_request',c.req.param('id'));
  const doctor=await one<{email:string;email_verified_at:number|null}>(db,'SELECT email,email_verified_at FROM users WHERE id=?',req.doctor_id);
  const mail=c.env.MAIL;
  if(mail&&doctor?.email_verified_at){
   const text=decision==='approve'?'Заявка на подключение к Рядом подтверждена. Войдите в кабинет, чтобы приглашать пациентов.':decision==='needs_info'?`Администратор просит уточнить данные заявки${cleanNote?`: ${cleanNote}`:'.'} Войдите в кабинет и отправьте заявку снова.`:`Заявка на подключение к Рядом отклонена${cleanNote?`: ${cleanNote}`:'.'} Войдите в кабинет, чтобы посмотреть комментарий.`;
   try{await mail.send({to:doctor.email,subject:'Рядом: заявка рассмотрена',text});}catch{console.error('Verification email failed');}
  }
  return c.json({ok:true});
 });
}
