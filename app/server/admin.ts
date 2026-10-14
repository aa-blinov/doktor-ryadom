import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import {specialtyKinds,type User} from '../src/shared';
import {one,many,run,logAction,database} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
const blockSchema=z.object({blocked:z.boolean()});
const kindSchema=z.object({kind:z.enum(specialtyKinds).nullable().or(z.literal('').transform(()=>null))});
export function adminRoutes(app:App){
 app.use('/api/admin/*',async(c,next)=>{if(c.get('user').role!=='admin')return c.json({error:'Раздел доступен только администратору.'},403);await next();});
 // Doctors: name, email and verification state, for the doctor list.
 app.get('/api/admin/doctors',async c=>{
  const q=(c.req.query('q')??'').trim().toLowerCase();
  const rows=await many(database(c.env),`SELECT u.id,u.name,u.email,u.created_at,u.blocked_at,u.specialist_verified_at,u.specialty_kind,
   (SELECT status FROM specialist_requests r WHERE r.doctor_id=u.id ORDER BY r.created_at DESC LIMIT 1) AS request_status,
   (SELECT r.specialty FROM specialist_requests r WHERE r.doctor_id=u.id AND r.status='approved' ORDER BY r.updated_at DESC LIMIT 1) AS request_specialty,
   (SELECT r.kind FROM specialist_requests r WHERE r.doctor_id=u.id AND r.status='approved' ORDER BY r.updated_at DESC LIMIT 1) AS request_kind,
   (SELECT json_extract(p.data,'$.specialty') FROM profiles p WHERE p.user_id=u.id) AS profile_specialty
  FROM users u WHERE u.role='doctor' ORDER BY u.specialist_verified_at IS NULL, u.specialist_verified_at DESC, u.name LIMIT 300`);
  const filtered=q?rows.filter((r:any)=>`${r.name} ${r.email}`.toLowerCase().includes(q)):rows;
  return c.json({doctors:filtered});
 });
 // Patients: no names or emails. Only the account date and block state, so the admin cannot identify a person.
 app.get('/api/admin/patients',async c=>{
  const rows=await many(database(c.env),"SELECT id,created_at,blocked_at FROM users WHERE role='patient' ORDER BY created_at DESC LIMIT 300");
  return c.json({patients:rows.map((r:any)=>({id:r.id,created_at:r.created_at,blocked_at:r.blocked_at}))});
 });
 app.post('/api/admin/doctors/:id/kind',async c=>{
  const db=database(c.env),admin=c.get('user').id,target=c.req.param('id');
  const parsed=kindSchema.safeParse(await c.req.json());
  if(!parsed.success)return c.json({error:'Выберите тип специалиста.'},400);
  const row=await one<{role:string;specialist_verified_at:number|null}>(db,'SELECT role,specialist_verified_at FROM users WHERE id=?',target);
  if(!row)return c.json({error:'Врач не найден.'},404);
  if(row.role!=='doctor')return c.json({error:'Тип специалиста меняется только у врача.'},400);
  // Clearing the type on a confirmed doctor left them verified with nothing verified about,
  // and they dropped out of every catalogue filter. Re-verification is the way back.
  if(!parsed.data.kind&&row.specialist_verified_at)return c.json({error:'У подтверждённого врача нельзя снять тип. Отзовите подтверждение или попросите врача подать заявку заново.'},400);
  const kind=parsed.data.kind,requestId=(await one<{id:string}>(db,"SELECT id FROM specialist_requests WHERE doctor_id=? ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'needs_info' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, updated_at DESC LIMIT 1",target))?.id;
  await db.batch([
   db.prepare('UPDATE users SET specialty_kind=? WHERE id=?').bind(kind,target),
   ...(requestId?[db.prepare("UPDATE specialist_requests SET kind=? WHERE id=?").bind(kind,requestId)]:[]),
  ]);
  await logAction(db,admin,'set_specialty_kind',target);
  return c.json({ok:true,kind});
 });
 app.post('/api/admin/accounts/:id/block',async c=>{
  const db=database(c.env),admin=c.get('user').id,target=c.req.param('id');
  const parsed=blockSchema.safeParse(await c.req.json());
  if(!parsed.success)return c.json({error:'Укажите, блокировать ли аккаунт.'},400);
  if(target===admin)return c.json({error:'Свой аккаунт заблокировать нельзя.'},403);
  const row=await one<{role:string}>(db,'SELECT role FROM users WHERE id=?',target);
  if(!row)return c.json({error:'Аккаунт не найден.'},404);
  if(row.role==='admin')return c.json({error:'Администратора блокирует другой администратор.'},403);
  await run(db,'UPDATE users SET blocked_at=? WHERE id=?',parsed.data.blocked?Date.now():null,target);
  // Sessions survive a block so the next open can say why, and end on unblock so an old cookie cannot resume.
  if(!parsed.data.blocked)await run(db,'DELETE FROM sessions WHERE user_id=?',target);
  await logAction(db,admin,parsed.data.blocked?'block_account':'unblock_account',target);
  return c.json({ok:true});
 });
 const actionLabels:Record<string,string>={login:'Вход в аккаунт',password_change:'Пароль изменён',password_reset:'Пароль восстановлен',delete_account:'Аккаунт удалён',save_checkin:'Отметка сохранена',sos_alert:'Сигнал SOS',create_invite:'Приглашение создано',assign_assessment:'Опросник назначен',complete_assessment:'Опросник пройден',review_assessment:'Опросник просмотрен',create_survey:'Опрос создан',assign_survey:'Опрос назначен',review_doctor:'Отзыв о враче',update_plan:'План наблюдения изменён',registration_consent:'Регистрация',submit_specialist_request:'Врач подал заявку',approve_specialist:'Заявка врача подтверждена',request_specialist_info:'Запрошены уточнения по заявке',reject_specialist:'Заявка врача отклонена',set_specialty_kind:'Тип специалиста изменён',block_account:'Аккаунт заблокирован',unblock_account:'Аккаунт разблокирован',edit_checkin:'Отметка исправлена',review_report:'Сводка просмотрена',view_patient:'Открыта карточка пациента',show_review:'Отзыв опубликован',hide_review:'Отзыв скрыт',update_profile:'Профиль обновлён',update_profile_photo:'Фото профиля обновлено',upload_profile_document:'Документ загружен',share_profile_document:'Видимость документа изменена',grant_access:'Пациент подключился',revoke_access:'Доступ отозван',accept_connection:'Запрос на подключение принят',decline_connection:'Запрос на подключение отклонён',request_doctor:'Запрос врачу',send_report:'Сводка отправлена',revoke_invite:'Приглашение отозвано'};
 app.get('/api/admin/audit',async c=>{
  const limit=Math.min(Math.max(Number(c.req.query('limit')??200)||200,1),500);
  const offset=Math.max(Number(c.req.query('offset')??0)||0,0);
  const action=(c.req.query('action')??'').trim();
  const rows=await many<{action:string;subject_id:string|null;created_at:number;actor_name:string|null;actor_role:string|null;subject_name:string|null}>(database(c.env),`SELECT a.action,a.subject_id,a.created_at,CASE WHEN u.role='patient' THEN NULL ELSE u.name END AS actor_name,CASE WHEN u.role='patient' THEN 'пациент' ELSE u.role END AS actor_role,CASE WHEN s.role='patient' THEN 'пациент' WHEN s.id IS NULL THEN NULL ELSE s.name END AS subject_name FROM audit a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN users s ON s.id=a.subject_id${action?' WHERE a.action=?':''} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,...(action?[action]:[]),limit,offset);
  return c.json({events:rows.map(r=>({...r,action_label:actionLabels[r.action]??r.action})),limit,offset});
 });
}
