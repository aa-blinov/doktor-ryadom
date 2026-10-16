import type {Hono} from 'hono';
import {z} from 'zod';
import {getCookie,deleteCookie} from 'hono/cookie';
import type {Env} from './env';
import type {User} from '../src/shared';
import {digest,randomToken,hashPassword,verifyPassword} from './auth';
import {database,one,many,run,logAction} from './db';
import {newTotpSecret,otpauthUri,verifyTotp} from './totp';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
const email=z.string().trim().email().max(200).transform(v=>v.toLowerCase());
const password=z.string().min(12).max(128);
const token=z.string().regex(/^[a-f0-9]{64}$/);
async function limited(db:D1Database,key:string){
 const now=Date.now();await run(db,'INSERT INTO auth_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END',await digest(key),now,now-3600000,now-3600000);
 return (await one<{count:number}>(db,'SELECT count FROM auth_attempts WHERE key=?',await digest(key)))!.count<=5;
}
async function sendToken(env:Env,user:User,purpose:'reset'|'verify',origin:string){
 if(!env.MAIL)throw new Error('Mail unavailable');
 const value=randomToken(),db=database(env);const id=await digest(value);
 await db.batch([db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').bind(user.id,purpose),db.prepare('INSERT INTO account_tokens VALUES (?,?,?,?)').bind(id,user.id,purpose,Date.now()+(purpose==='reset'?1800000:86400000))]);
 try{await env.MAIL.send({to:user.email,subject:purpose==='reset'?'Рядом: восстановление доступа':'Рядом: подтверждение email',text:`${purpose==='reset'?'Установите новый пароль':'Подтвердите ваш email'}:\n${origin}/#/${purpose}?token=${value}\n\nСсылка действует ${purpose==='reset'?'30 минут':'24 часа'} и используется один раз. Если вы не запрашивали письмо, проигнорируйте его.`});}
 catch(e){await run(db,'DELETE FROM account_tokens WHERE token=?',id);throw e;}
}
export function publicAccountRoutes(app:App){
 app.get('/api/auth/capabilities',c=>c.json({email:!!c.env.MAIL,push:!!c.env.PUSH_PUBLIC_KEY}));
 app.post('/api/auth/forgot',async c=>{
  const data=z.object({email}).safeParse(await c.req.json());if(!data.success)return c.json({error:'Проверьте email.'},400);
  const db=database(c.env);if(!await limited(db,'reset-ip:'+c.req.header('CF-Connecting-IP'))||!await limited(db,'reset-email:'+data.data.email))return c.json({error:'Попробуйте снова через час.'},429);
  if(!c.env.MAIL)return c.json({error:'Не удалось отправить письмо. Обратитесь в поддержку сервиса.'},503);
  const user=await one<User>(db,'SELECT id,name,email,role FROM users WHERE email=?',data.data.email);
  if(user)await sendToken(c.env,user,'reset',new URL(c.req.url).origin);
  return c.json({ok:true,message:'Если аккаунт с этим адресом существует, мы отправили ссылку для восстановления.'});
 });
 app.post('/api/auth/reset',async c=>{
  const data=z.object({token,password}).safeParse(await c.req.json());if(!data.success)return c.json({error:'Проверьте ссылку и новый пароль.'},400);
  const db=database(c.env);if(!await limited(db,'reset-token:'+c.req.header('CF-Connecting-IP')))return c.json({error:'Попробуйте снова через час.'},429);
  const key=await digest(data.data.token),record=await one<{user_id:string}>(db,'SELECT user_id FROM account_tokens WHERE token=? AND purpose=? AND expires>?',key,'reset',Date.now());
  if(!record)return c.json({error:'Ссылка недействительна или устарела. Запросите новую.'},400);
  const hashed=await hashPassword(data.data.password);
  // Conditional password update and token consumption execute in one transaction.
  const result=await db.batch([db.prepare('UPDATE users SET password=? WHERE id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(hashed,record.user_id,key,'reset',Date.now()),db.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(record.user_id,key,'reset',Date.now()),db.prepare('DELETE FROM account_tokens WHERE user_id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(record.user_id,key,'reset',Date.now())]);
  return result[0].meta.changes?c.json({ok:true}):c.json({error:'Ссылка уже использована.'},400);
 });
 app.post('/api/auth/recover-code',async c=>{
  const parsed=z.object({email,code:z.string().max(80),password}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте email, код и новый пароль.'},400);
  const db=database(c.env);if(!await limited(db,'recover-ip:'+c.req.header('CF-Connecting-IP'))||!await limited(db,'recover-email:'+parsed.data.email))return c.json({error:'Попробуйте снова через час.'},429);
  const code=parsed.data.code.replaceAll('-','').replaceAll(' ','').toLowerCase();
  if(!/^[a-f0-9]{32}$/.test(code))return c.json({error:'Email или код восстановления неверен.'},400);
  const key=await digest(code),record=await one<{user_id:string}>(db,'SELECT t.user_id FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.purpose=? AND t.expires>? AND u.email=?',key,'recovery',Date.now(),parsed.data.email);
  if(!record)return c.json({error:'Email или код восстановления неверен.'},400);
  // A recovery code is the lost-phone path, so it also turns the second factor off. An emailed reset link does not.
  const result=await db.batch([db.prepare('UPDATE users SET password=? WHERE id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(await hashPassword(parsed.data.password),record.user_id,key,'recovery',Date.now()),db.prepare('UPDATE users SET totp_secret=NULL,totp_enabled_at=NULL,totp_last_step=NULL WHERE id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(record.user_id,key,'recovery',Date.now()),db.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(record.user_id,key,'recovery',Date.now()),db.prepare('DELETE FROM account_tokens WHERE user_id=? AND EXISTS(SELECT 1 FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(record.user_id,key,'recovery',Date.now())]);
  if(!result[0].meta.changes)return c.json({error:'Код уже использован.'},400);
  if(result[1].meta.changes)await logAction(db,record.user_id,'totp_reset',record.user_id);
  return c.json({ok:true});
 });
 app.post('/api/auth/verify',async c=>{
  const data=z.object({token}).safeParse(await c.req.json());if(!data.success)return c.json({error:'Проверьте ссылку.'},400);
  const db=database(c.env),key=await digest(data.data.token);
  const result=await db.batch([db.prepare('UPDATE users SET email_verified_at=? WHERE id=(SELECT user_id FROM account_tokens WHERE token=? AND purpose=? AND expires>?)').bind(Date.now(),key,'verify',Date.now()),db.prepare('DELETE FROM account_tokens WHERE token=?').bind(key)]);
  return result[0].meta.changes?c.json({ok:true}):c.json({error:'Ссылка уже использована или устарела.'},400);
 });
}
export function accountRoutes(app:App){
 app.post('/api/account/verify-email',async c=>{
  if(!c.env.MAIL)return c.json({error:'Не удалось отправить письмо. Обратитесь в поддержку сервиса.'},503);
  if(!await limited(database(c.env),'verify:'+c.get('user').id))return c.json({error:'Попробуйте снова через час.'},429);
  await sendToken(c.env,c.get('user'),'verify',new URL(c.req.url).origin);return c.json({ok:true});
 });
 app.post('/api/account/password',async c=>{
  const data=z.object({currentPassword:z.string().max(128),password}).safeParse(await c.req.json());if(!data.success)return c.json({error:'Проверьте пароли. Новый пароль должен содержать минимум 12 символов.'},400);
  const db=database(c.env),id=c.get('user').id;if(!await limited(db,'password:'+id))return c.json({error:'Попробуйте снова через час.'},429);
  const row=await one<{password:string}>(db,'SELECT password FROM users WHERE id=?',id);if(!row||!await verifyPassword(data.data.currentPassword,row.password))return c.json({error:'Текущий пароль неверен.'},403);
  const current=await digest(getCookie(c,'ryadom_session')||'');await db.batch([db.prepare('UPDATE users SET password=? WHERE id=?').bind(await hashPassword(data.data.password),id),db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').bind(id,current),db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(id)]);await logAction(db,id,'password_change',id);return c.json({ok:true});
 });
 app.post('/api/account/recovery-codes',async c=>{
  const parsed=z.object({password:z.string().max(128)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Введите текущий пароль.'},400);
  const db=database(c.env),id=c.get('user').id;if(!await limited(db,'recovery-codes:'+id))return c.json({error:'Попробуйте снова через час.'},429);
  const row=await one<{password:string}>(db,'SELECT password FROM users WHERE id=?',id);if(!row||!await verifyPassword(parsed.data.password,row.password))return c.json({error:'Пароль неверен.'},403);
  const codes=Array.from({length:5},()=>randomToken().slice(0,32));
  await db.batch([db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').bind(id,'recovery'),...await Promise.all(codes.map(async code=>db.prepare('INSERT INTO account_tokens VALUES (?,?,?,?)').bind(await digest(code),id,'recovery',Date.now()+365*86400000)))]);
  return c.json({codes:codes.map(code=>code.match(/.{8}/g)!.join('-'))});
 });
 app.get('/api/account/totp',async c=>{const row=await one<{totp_enabled_at:number|null}>(database(c.env),'SELECT totp_enabled_at FROM users WHERE id=?',c.get('user').id);return c.json({enabled:!!row?.totp_enabled_at});});
 app.post('/api/account/totp/setup',async c=>{
  const parsed=z.object({password:z.string().max(128)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Введите текущий пароль.'},400);
  const db=database(c.env),user=c.get('user');if(!await limited(db,'totp:'+user.id))return c.json({error:'Попробуйте снова через час.'},429);
  const row=await one<{password:string;totp_enabled_at:number|null}>(db,'SELECT password,totp_enabled_at FROM users WHERE id=?',user.id);
  if(!row||!await verifyPassword(parsed.data.password,row.password))return c.json({error:'Пароль неверен.'},403);
  if(row.totp_enabled_at)return c.json({error:'Вход с кодом уже включён.'},409);
  const secret=newTotpSecret();await run(db,'UPDATE users SET totp_secret=?,totp_last_step=NULL WHERE id=?',secret,user.id);
  return c.json({secret,uri:otpauthUri(user.email,secret)});
 });
 app.post('/api/account/totp/enable',async c=>{
  const parsed=z.object({code:z.string().trim().max(20)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Введите код из приложения.'},400);
  const db=database(c.env),id=c.get('user').id;if(!await limited(db,'totp:'+id))return c.json({error:'Попробуйте снова через час.'},429);
  const row=await one<{totp_secret:string|null;totp_enabled_at:number|null}>(db,'SELECT totp_secret,totp_enabled_at FROM users WHERE id=?',id);
  if(!row?.totp_secret||row.totp_enabled_at)return c.json({error:'Сначала получите новый ключ.'},409);
  const step=await verifyTotp(row.totp_secret,parsed.data.code.replace(/\s/g,''),null);if(step===null)return c.json({error:'Код не подошёл. Проверьте время на телефоне и введите новый код.'},400);
  await run(db,'UPDATE users SET totp_enabled_at=?,totp_last_step=? WHERE id=? AND totp_enabled_at IS NULL',Date.now(),step,id);await logAction(db,id,'totp_enable',id);return c.json({ok:true});
 });
 app.post('/api/account/totp/disable',async c=>{
  const parsed=z.object({password:z.string().max(128),code:z.string().trim().max(20)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Введите пароль и код.'},400);
  const db=database(c.env),id=c.get('user').id;if(!await limited(db,'totp:'+id))return c.json({error:'Попробуйте снова через час.'},429);
  const row=await one<{password:string;totp_secret:string|null;totp_enabled_at:number|null;totp_last_step:number|null}>(db,'SELECT password,totp_secret,totp_enabled_at,totp_last_step FROM users WHERE id=?',id);
  if(!row?.totp_enabled_at||!row.totp_secret)return c.json({error:'Вход с кодом не включён.'},409);
  if(!await verifyPassword(parsed.data.password,row.password)||await verifyTotp(row.totp_secret,parsed.data.code.replace(/\s/g,''),row.totp_last_step)===null)return c.json({error:'Пароль или код неверен.'},403);
  await run(db,'UPDATE users SET totp_secret=NULL,totp_enabled_at=NULL,totp_last_step=NULL WHERE id=?',id);await logAction(db,id,'totp_disable',id);return c.json({ok:true});
 });
 app.post('/api/account/logout-others',async c=>{await run(database(c.env),'DELETE FROM sessions WHERE user_id=? AND token<>?',c.get('user').id,await digest(getCookie(c,'ryadom_session')||''));return c.json({ok:true});});
 app.get('/api/account/export',async c=>{
  const id=c.get('user').id,db=database(c.env),tables=['goals','goal_logs','survey_templates','profile_documents','doctor_codes','profiles','settings','drafts','checkins','checkin_revisions','practices','assessments','followups','medications','medication_logs','experiences','reports','plans'];
  const rows=await Promise.all(tables.map(t=>many(db,`SELECT * FROM ${t} WHERE ${t==='survey_templates'?'doctor_id':['settings','profiles','doctor_codes','profile_documents'].includes(t)?'user_id':'patient_id'}=?`,id)));
  return c.json({schema:1,exportedAt:new Date().toISOString(),account:c.get('user'),data:Object.fromEntries(tables.map((t,i)=>[t,rows[i]]))},200,{'Content-Disposition':'attachment; filename="ryadom-data.json"'});
 });
 app.delete('/api/account',async c=>{
  const data=z.object({password:z.string().max(128),confirm:z.literal('УДАЛИТЬ')}).safeParse(await c.req.json());if(!data.success)return c.json({error:'Подтвердите удаление и введите пароль.'},400);
  const db=database(c.env),id=c.get('user').id;if(!await limited(db,'delete:'+id))return c.json({error:'Попробуйте снова через час.'},429);
  const user=await one<{password:string}>(db,'SELECT password FROM users WHERE id=?',id);if(!user||!await verifyPassword(data.data.password,user.password))return c.json({error:'Пароль неверен.'},403);
  const isDoctor=c.get('user').role==='doctor';
  const statements=[db.prepare('DELETE FROM audit WHERE actor_id=? OR subject_id=? OR subject_id IN(SELECT id FROM reports WHERE patient_id=? OR doctor_id=?)').bind(id,id,id,id)];
  statements.push(db.prepare('DELETE FROM survey_templates WHERE doctor_id=?').bind(id));
  for(const table of ['medication_logs','experiences','assessments','followups','medications','reports'])statements.push(db.prepare(`DELETE FROM ${table} WHERE patient_id=?${!isDoctor&&['assessments','followups','medications','reports'].includes(table)?' OR doctor_id=?':''}`).bind(...(!isDoctor&&['assessments','followups','medications','reports'].includes(table)?[id,id]:[id])));
  // Remove logs referencing this doctor's prescriptions before deleting those prescriptions.
  if(!isDoctor)statements.splice(1,0,db.prepare('DELETE FROM medication_logs WHERE medication_id IN(SELECT id FROM medications WHERE doctor_id=?)').bind(id));
  for(const table of ['goal_logs','goals','checkin_revisions','checkins','practices','drafts','plans'])statements.push(db.prepare(`DELETE FROM ${table} WHERE patient_id=?`).bind(id));
  statements.push(db.prepare('DELETE FROM plans WHERE patient_id IN(SELECT patient_id FROM links WHERE doctor_id=?)').bind(id));
  for(const table of ['links','invites'])statements.push(db.prepare(`DELETE FROM ${table} WHERE ${table==='links'?'patient_id=? OR doctor_id=?':'doctor_id=?'}`).bind(...(table==='links'?[id,id]:[id])));
  for(const table of ['sessions','account_tokens','push_subscriptions','deliveries','settings','profiles','profile_videos','doctor_codes','profile_documents'])statements.push(db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(id));
  statements.push(isDoctor?db.prepare('UPDATE users SET name=?,email=?,password=?,email_verified_at=NULL,specialist_verified_at=NULL WHERE id=?').bind('Удалённый врач',id+'@deleted.invalid','disabled',id):db.prepare('DELETE FROM users WHERE id=?').bind(id));await db.batch(statements);await logAction(db,id,'delete_account',id);deleteCookie(c,'ryadom_session',{path:'/'});return c.json({ok:true});
 });
}
