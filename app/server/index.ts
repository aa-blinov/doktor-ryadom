import {surveyRoutes} from './surveys';
import { verificationRoutes } from './verification';
import { directoryRoutes } from './directory';
import { bookingRoutes } from './booking';
import { adminRoutes } from './admin';
import {profileDocumentRoutes} from './profile-documents';
import {profileRoutes,profileVideoRoutes,doctorProfile,patientProfile} from './profiles';
import {practiceTemplateRoutes,customPracticesFor,foreignCustomRefs} from './practice-templates';
import {binaryUploadLimit} from './upload-limits';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { database, one, many, run, logAction } from './db';
import { digest, randomToken, hashPassword, verifyPassword } from './auth';
import { verifyTotp } from './totp';
import { defaultPlan, defaultSettings, entrySchema, planSchema, settingsSchema, practiceRef, TERMS_VERSION, type User, type Entry, type PracticeLog, type Report } from '../src/shared';
import type { Env } from './env';
import {publicAccountRoutes,accountRoutes} from './account';
import {careData,patientCareRoutes,doctorCareRoutes} from './care';
import {notificationRoutes} from './notifications';
const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();
const sessionName = 'ryadom_session';
const authSchema = z.object({ email: z.string().trim().email().max(200).transform(v => v.toLowerCase()), password: z.string().min(12, 'Пароль должен содержать минимум 12 символов').max(128) });
const loginSchema = authSchema.extend({ code: z.string().trim().max(20).optional() });
const registerSchema = authSchema.extend({ name: z.string().trim().min(2).max(80), role: z.enum(['patient','doctor']), consent: z.literal(true), adult: z.literal(true, { message: 'Регистрация доступна с 18 лет' }) });
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
app.use('*', async (c,next) => { await next(); c.header('X-Content-Type-Options','nosniff'); c.header('Referrer-Policy','same-origin'); c.header('X-Frame-Options','DENY'); c.header('Content-Security-Policy',CSP); });
app.use('/api/*', async(c,next)=>bodyLimit({maxSize:binaryUploadLimit(c.req.method,c.req.path,c.req.header('Content-Type')||'')||(c.req.method==='POST'&&/^\/api\/patient\/assessments\/[^/]+$/.test(c.req.path)?65536:c.req.path==='/api/profile/documents'&&c.req.method==='POST'?7340032:c.req.path==='/api/profile/photo'&&c.req.method==='PUT'?200000:16000),onError:c=>c.json({error:'Слишком большой запрос'},413)})(c,next));
app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'same-origin');
  if (['POST','PUT','PATCH','DELETE'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    if (!origin || origin !== new URL(c.req.url).origin) return c.json({ error: 'Запрос из другого источника отклонён. Обновите страницу.' }, 403);
    // Binary uploads only on the routes listed in upload-limits; Origin and session checks still apply.
    const ct = c.req.header('Content-Type') || '';
    const binaryLimit = binaryUploadLimit(c.req.method, c.req.path, ct);
    if (!ct.includes('application/json') && binaryLimit === null) return c.json({ error: 'Ожидается JSON' }, 415);
    const length = Number(c.req.header('Content-Length') || 0); if (length > (binaryLimit ?? (c.req.method==='POST'&&/^\/api\/patient\/assessments\/[^/]+$/.test(c.req.path)?65536:c.req.path==='/api/profile/documents'&&c.req.method==='POST'?7340032:c.req.path==='/api/profile/photo'&&c.req.method==='PUT'?200000:16000))) return c.json({ error: 'Слишком большой запрос' }, 413);
  }
  await next();
});
app.onError((err, c) => { console.error('API failure', err.name); return c.json({ error: 'Не удалось выполнить запрос. Данные формы сохранены на экране; попробуйте ещё раз.' }, 503); });
app.get('/api/health', async c => {await one(database(c.env),'SELECT 1 AS ok');return c.json({ok:true});});
app.get('/api/invites/:token', async c => {
  if (!await limit(database(c.env), await digest('invite:'+(c.req.header('CF-Connecting-IP') || 'local')))) return c.json({ error: 'Слишком много попыток. Попробуйте позже.' }, 429);
  const token=c.req.param('token');
  if(!/^[a-f0-9]{64}$/i.test(token))return c.json({error:'Приглашение уже использовано или срок истёк. Попросите врача создать новое.'},404);
  const row = await one<{ name: string;id:string }>(database(c.env), 'SELECT u.name,u.id FROM invites i JOIN users u ON u.id=i.doctor_id WHERE u.specialist_verified_at IS NOT NULL AND i.token=? AND i.used=0 AND i.expires>?', await digest(token), Date.now());
  return row ? c.json({doctorName:row.name,doctorProfile:{...await doctorProfile(database(c.env),row.id),photoUrl:null,documents:[]}}) : c.json({ error:'Приглашение уже использовано или срок истёк. Попросите врача создать новое.' }, 404);
});
async function limit(db: D1Database, key: string, max = 12, windowMs = 600000) {
  const now = Date.now();
  await run(db, 'INSERT INTO auth_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END, window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END', key, now, now-windowMs, now-windowMs);
  const row = await one<{ count: number }>(db, 'SELECT count FROM auth_attempts WHERE key=?', key); return (row?.count || 0) <= max;
}
async function newSession(c: Context<{ Bindings: Env; Variables: { user: User } }>, user: User) {
  const token = randomToken();
  await run(database(c.env), 'INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)', await digest(token), user.id, Date.now()+7*86400000);
  setCookie(c, sessionName, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: 7*86400 });
}
app.post('/api/auth/register', async c => {
  const db = database(c.env); const data = registerSchema.safeParse(await c.req.json()); if (!data.success) return c.json({ error: data.error.issues[0].message }, 400);
  if (!await limit(db, await digest('register:'+(c.req.header('CF-Connecting-IP') || 'local')))) return c.json({ error: 'Слишком много попыток. Попробуйте через 10 минут.' }, 429);
  const { email, password, name, role } = data.data;
  if (await one(db, 'SELECT id FROM users WHERE email=?', email)) return c.json({ error: 'Не удалось создать аккаунт. Проверьте данные или войдите, если аккаунт уже есть.' }, 409);
  const user = { id: crypto.randomUUID(), email, name, role, terms_version: TERMS_VERSION };
  await db.batch([db.prepare('INSERT INTO users (id,email,name,role,password,created_at,terms_version) VALUES (?,?,?,?,?,?,?)').bind(user.id,email,name,role,await hashPassword(password),Date.now(),TERMS_VERSION), db.prepare('INSERT INTO settings (user_id,data) VALUES (?,?)').bind(user.id,JSON.stringify(defaultSettings))]);
  await logAction(db,user.id,'registration_consent',user.id); await newSession(c,user); return c.json({ user }, 201);
});
app.post('/api/auth/login', async c => {
  const db = database(c.env); const data = loginSchema.safeParse(await c.req.json()); if (!data.success) return c.json({ error: 'Проверьте email и пароль (минимум 12 символов).' }, 400);
  const key = await digest(`login:${data.data.email}:${c.req.header('CF-Connecting-IP') || 'local'}`);
  if (!await limit(db,key) || !await limit(db,await digest(`login-ip:${c.req.header('CF-Connecting-IP') || 'local'}`)) || !await limit(db,await digest(`login-account:${data.data.email}`),30,3600000)) return c.json({ error: 'Слишком много попыток. Попробуйте через 10 минут.' }, 429);
  const row = await one<User & { password: string; blocked_at?: number | null; totp_secret: string | null; totp_enabled_at: number | null; totp_last_step: number | null }>(db, 'SELECT id,email,name,role,password,email_verified_at,specialist_verified_at,specialty_kind,blocked_at,totp_secret,totp_enabled_at,totp_last_step,terms_version FROM users WHERE email=?', data.data.email);
  const ok=row?await verifyPassword(data.data.password,row.password):await verifyPassword(data.data.password,'scrypt:16384:8:5:'+('0'.repeat(64))+':'+'0'.repeat(64));
  if (!row || !ok) return c.json({ error: 'Неверный email или пароль.' }, 401);
  if (row.blocked_at) return c.json({ error: 'Аккаунт заблокирован. Обратитесь к администратору.' }, 403);
  if (row.totp_enabled_at && row.totp_secret) {
    // Second factor: 428 asks the client for the code; a used time step is rejected so a seen code cannot be replayed.
    const code = (data.data.code || '').replace(/\s/g, '');
    if (!code) return c.json({ error: 'Введите код из приложения-аутентификатора.' }, 428);
    const step = await verifyTotp(row.totp_secret, code, row.totp_last_step);
    if (step === null || !(await run(db, 'UPDATE users SET totp_last_step=? WHERE id=? AND (totp_last_step IS NULL OR totp_last_step<?)', step, row.id, step)).meta.changes) return c.json({ error: 'Код неверный или уже использован. Введите новый код.' }, 401);
  }
  const { password: _, totp_secret: _secret, totp_enabled_at: _enabled, totp_last_step: _step, ...user } = row; await newSession(c,user); await logAction(db,user.id,'login',user.id); return c.json({user:user.role==='doctor'?{...user,photoUrl:(await doctorProfile(db,user.id)).photoUrl}:user});
});
publicAccountRoutes(app);
app.use('/api/*', async (c,next) => {
  const token = getCookie(c,sessionName); if (!token) return c.json({ error: 'Войдите, чтобы продолжить.' }, 401);
  const row = await one<User & { blocked_at: number | null }>(database(c.env),'SELECT u.id,u.email,u.name,u.role,u.email_verified_at,u.specialist_verified_at,u.specialty_kind,u.blocked_at,u.terms_version FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',await digest(token),Date.now());
  if (!row) return c.json({ error: 'Сеанс завершён. Войдите снова.' }, 401);
  // A blocked account keeps its session row, so the next open says why it cannot enter instead of showing a silent login form.
  if (row.blocked_at) return c.json({ error: 'Аккаунт заблокирован. Обратитесь к администратору.' }, 403);
  const { blocked_at: _blocked, ...user } = row; c.set('user',user as User); await next();
});
app.post('/api/account/terms',async c=>{const db=database(c.env),user=c.get('user');await run(db,'UPDATE users SET terms_version=? WHERE id=?',TERMS_VERSION,user.id);await logAction(db,user.id,'terms_accept',user.id);return c.json({ok:true});});
app.get('/api/me',async c=>{const user=c.get('user');return c.json({user:user.role==='doctor'?{...user,photoUrl:(await doctorProfile(database(c.env),user.id)).photoUrl}:user});});
app.post('/api/auth/logout', async c => { const body=await c.req.json().catch(()=>({}));if(typeof body.endpoint==='string')await run(database(c.env),'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?',body.endpoint,c.get('user').id); await run(database(c.env),'DELETE FROM sessions WHERE token=?',await digest(getCookie(c,sessionName) || '')); deleteCookie(c,sessionName,{ path:'/' }); return c.json({ ok:true }); });
accountRoutes(app);
notificationRoutes(app);
profileRoutes(app);profileVideoRoutes(app);practiceTemplateRoutes(app);profileDocumentRoutes(app);
app.get('/api/settings', async c => { const row = await one<{ data: string }>(database(c.env),'SELECT data FROM settings WHERE user_id=?',c.get('user').id); return c.json({ settings: settingsSchema.parse(row ? JSON.parse(row.data) : defaultSettings) }); });
app.put('/api/settings', async c => { const data = settingsSchema.safeParse(await c.req.json()); if (!data.success) return c.json({ error:'Проверьте настройки.' },400); const user=c.get('user'); const settings={...data.data,reminderEmail:data.data.reminderEmail&&!!user.email_verified_at}; await run(database(c.env),'INSERT INTO settings (user_id,data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data',user.id,JSON.stringify(settings)); return c.json({ settings }); });
app.use('/api/patient/*', async(c,next) => { if(c.get('user').role!=='patient') return c.json({ error:'Этот раздел доступен пациенту.' },403); await next(); });
async function patientData(db: D1Database, id: string) {
  const [entries,practices,plan,settings,doctor,reports,lastSos,count] = await Promise.all([
    many<Entry>(db,'SELECT * FROM checkins WHERE patient_id=? ORDER BY date DESC LIMIT 365',id), many<PracticeLog>(db,'SELECT * FROM practices WHERE patient_id=? ORDER BY completed_at DESC LIMIT 100',id), one<{ data:string }>(db,'SELECT data FROM plans WHERE patient_id=?',id), one<{ data:string }>(db,'SELECT data FROM settings WHERE user_id=?',id), one<{ id:string;name:string }>(db,'SELECT u.id,u.name FROM links l JOIN users u ON u.id=l.doctor_id WHERE l.patient_id=? AND l.revoked_at IS NULL',id), many<{id:string;doctor_id:string;from_date:string;to_date:string;payload:string;created_at:number;reviewed_at:number|null}>(db,'SELECT * FROM reports WHERE patient_id=? ORDER BY created_at DESC LIMIT 30',id),
    // The sent state lives on the server, so a new tab does not offer to send the same signal again.
    one<{created_at:number}>(db,'SELECT created_at FROM sos_events WHERE patient_id=? ORDER BY created_at DESC LIMIT 1',id),
    // the list is capped; say so instead of pretending the older days do not exist
    one<{total:number}>(db,'SELECT count(*) AS total FROM checkins WHERE patient_id=?',id)
  ]);
  const customPractices=await customPracticesFor(db,plan?(JSON.parse(plan.data).practices as string[]):[]);
  return { ...await careData(db,id),customPractices,reports:reports.map(({payload,...row})=>({...row,...JSON.parse(payload)})) as Report[], entries: entries.map(e=>({...e,sleepContext:(e as unknown as {sleep_context:string}).sleep_context,habit:e.habit===null?null:Boolean(e.habit)})),practices,plan:plan?JSON.parse(plan.data):defaultPlan,settings:settingsSchema.parse(settings?JSON.parse(settings.data):defaultSettings),doctor:doctor?{...doctor,profile:await doctorProfile(db,doctor.id)}:null,lastSosAt:lastSos?.created_at??null,entriesTruncated:(count?.total??0)>entries.length };
}
patientCareRoutes(app);
app.get('/api/patient/data', async c => c.json(await patientData(database(c.env),c.get('user').id)));
app.post('/api/patient/checkins', async c => {
  const data=entrySchema.safeParse(await c.req.json()); if(!data.success) return c.json({ error:'Проверьте ответы и дату.' },400);
  if (Math.abs(Date.parse(data.data.date)-Date.now()) > 2*86400000) return c.json({ error:'Можно отметить только текущий день.' },400);
  const db=database(c.env),id=c.get('user').id,e=data.data;
  if(await one(db,'SELECT id FROM checkins WHERE patient_id=? AND date=?',id,e.date)) return c.json({ error:'Сегодняшняя отметка уже сохранена. Она доступна в истории.' },409);
  await db.batch([db.prepare('INSERT INTO checkins (id,patient_id,date,mood,sleep,anxiety,energy,functioning,sleep_context,note,habit,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,e.date,e.mood,e.sleep,e.anxiety,e.energy,e.functioning,e.sleepContext,e.note,e.habit===null?null:Number(e.habit),Date.now()),db.prepare('DELETE FROM drafts WHERE patient_id=?').bind(id)]);await logAction(db,id,'save_checkin',e.date);
  return c.json({ ok:true },201);
});
app.post('/api/patient/sos', async c => { const db=database(c.env),id=c.get('user').id;
  // A second tap within a minute is the same signal: one event, one notification to the doctor.
  if(!await one(db,'SELECT id FROM sos_events WHERE patient_id=? AND created_at>?',id,Date.now()-60000)){await run(db,'INSERT INTO sos_events (id,patient_id,created_at) VALUES (?,?,?)',crypto.randomUUID(),id,Date.now());await logAction(db,id,'sos_alert',id);}
  return c.json({ ok:true }); });
app.post('/api/patient/practices', async c => {
  const data=z.object({ practiceId:practiceRef,feedback:z.enum(['comfortable','same','unpleasant']),note:z.string().trim().max(1000).default('') }).safeParse(await c.req.json()); if(!data.success) return c.json({ error:'Проверьте оценку практики.' },400);
  const db=database(c.env),id=c.get('user').id; const current=await patientData(db,id);
  if(!current.plan.practices.includes(data.data.practiceId)||current.settings.blockedPractices.includes(data.data.practiceId)) return c.json({ error:'Практика отключена в вашем плане.' },403);
  const statements=[db.prepare('INSERT INTO practices (id,patient_id,practice_id,feedback,completed_at,note) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,data.data.practiceId,data.data.feedback,Date.now(),data.data.note)];
  if(data.data.feedback==='unpleasant') { const settings={...current.settings,blockedPractices:[...new Set([...current.settings.blockedPractices,data.data.practiceId])]}; statements.push(db.prepare('INSERT INTO settings (user_id,data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').bind(id,JSON.stringify(settings))); }
  await db.batch(statements); return c.json({ ok:true },201);
});
app.post('/api/patient/reports', async c => {
  const parsed=z.object({days:z.union([z.literal(14),z.literal(30)]).optional(),fromDate:entrySchema.shape.date.optional(),endDate:entrySchema.shape.date}).safeParse(await c.req.json());
  if(!parsed.success||Math.abs(Date.parse(parsed.data.endDate)-Date.now())>2*86400000)return c.json({error:'Проверьте период сводки.'},400);
  const db=database(c.env),patientId=c.get('user').id,current=await patientData(db,patientId);
  if(!current.doctor)return c.json({error:'Сначала подключите врача в настройках.'},403);
  const toDate=parsed.data.endDate;
  const fromDate=parsed.data.fromDate??new Date(Date.parse(toDate)-((parsed.data.days??14)-1)*86400000).toISOString().slice(0,10);
  if(fromDate>toDate)return c.json({error:'Проверьте период сводки.'},400);
  const entries=current.entries.filter(e=>e.date>=fromDate&&e.date<=toDate);
  if(!entries.length)return c.json({error:'В выбранном периоде нет отметок.'},400);
  const practices=current.practices.filter(p=>p.completed_at>=Date.parse(fromDate)&&p.completed_at<Date.parse(toDate)+86400000);
  const payload=JSON.stringify({entries,practices,plan:current.plan,assessments:current.assessments.filter(a=>a.completed_at&&a.completed_at>=Date.parse(fromDate)&&a.completed_at<Date.parse(toDate)+86400000),medications:current.medications.filter(m=>m.start_date<=toDate&&(!m.end_date||m.end_date>=fromDate)),medicationLogs:current.medicationLogs.filter(l=>l.date>=fromDate&&l.date<=toDate),experiences:current.experiences.filter(e=>e.date>=fromDate&&e.date<=toDate),goals:current.goals,goalLogs:(current.goalLogs??[]).filter(g=>g.created_at>=Date.parse(fromDate)&&g.created_at<Date.parse(toDate)+86400000),followups:current.followups.filter(f=>f.created_at>=Date.parse(fromDate)&&f.created_at<Date.parse(toDate)+86400000)});
  const id=await digest(JSON.stringify([patientId,current.doctor.id,fromDate,toDate,payload]));
  const inserted=await run(db,'INSERT OR IGNORE INTO reports (id,patient_id,doctor_id,from_date,to_date,payload,created_at) VALUES (?,?,?,?,?,?,?)',id,patientId,current.doctor.id,fromDate,toDate,payload,Date.now());
  if(!inserted.meta.changes)return c.json({ok:true,id,duplicate:true});
  await logAction(db,patientId,'send_report',current.doctor.id);
  return c.json({ok:true,id},201);
});
app.post('/api/patient/accept', async c => {
  const data=z.object({ token:z.string().refine(t=>/^[a-f0-9]{64}$/i.test(t)),consent:z.literal(true) }).safeParse(await c.req.json()); if(!data.success) return c.json({ error:'Ссылка-приглашение недействительна. Попросите врача создать новое.' },400);
  const db=database(c.env),id=c.get('user').id,token=await digest(data.data.token);
  const invite=await one<{doctor_id:string}>(db,'SELECT i.doctor_id FROM invites i JOIN users u ON u.id=i.doctor_id WHERE u.specialist_verified_at IS NOT NULL AND i.token=? AND i.used=0 AND i.expires>?',token,Date.now()); if(!invite) return c.json({ error:'Приглашение недействительно или уже использовано.' },404);
  const link=await one(db,'SELECT patient_id FROM links WHERE patient_id=? AND revoked_at IS NULL',id); if(link) return c.json({ error:'У вас уже подключён врач. Сначала отзовите предыдущий доступ.' },409);
  const acceptedAt=Date.now();
  const source='SELECT i.doctor_id FROM invites i JOIN users u ON u.id=i.doctor_id WHERE i.token=? AND i.used=0 AND i.expires>? AND u.specialist_verified_at IS NOT NULL';
  const insert=db.prepare(`INSERT INTO links(patient_id,doctor_id,accepted_at,revoked_at) SELECT ?,doctor_id,?,NULL FROM (${source}) WHERE 1 ON CONFLICT(patient_id) DO UPDATE SET doctor_id=excluded.doctor_id,accepted_at=excluded.accepted_at,revoked_at=NULL WHERE links.revoked_at IS NOT NULL`);
  const statements=[insert.bind(id,acceptedAt,token,Date.now()),db.prepare('DELETE FROM plans WHERE patient_id=? AND changes()=1').bind(id),db.prepare('DELETE FROM drafts WHERE patient_id=? AND EXISTS(SELECT 1 FROM links WHERE patient_id=? AND doctor_id=? AND accepted_at=? AND revoked_at IS NULL)').bind(id,id,invite.doctor_id,acceptedAt),db.prepare('UPDATE invites SET used=1,raw=NULL WHERE token=? AND used=0 AND EXISTS(SELECT 1 FROM links WHERE patient_id=? AND doctor_id=? AND accepted_at=? AND revoked_at IS NULL)').bind(token,id,invite.doctor_id,acceptedAt)];
  const result=await db.batch(statements);
  if(!result[0].meta.changes)return c.json({error:'Приглашение уже использовано. Попросите врача создать новое.'},409);
  await logAction(db,id,'grant_access',invite.doctor_id); return c.json({ ok:true });
});
app.post('/api/patient/revoke', async c => { const db=database(c.env),id=c.get('user').id; await db.batch([db.prepare('UPDATE links SET revoked_at=? WHERE patient_id=? AND revoked_at IS NULL').bind(Date.now(),id),db.prepare('DELETE FROM plans WHERE patient_id=?').bind(id)]); await logAction(db,id,'revoke_access',id); return c.json({ ok:true }); });
app.use('/api/doctor/*', async(c,next) => { if(c.get('user').role!=='doctor') return c.json({ error:'Этот раздел доступен врачу.' },403); await next(); });
app.get('/api/doctor/patients', async c => c.json({ patients:await many(database(c.env),'SELECT u.id,u.name,(SELECT date FROM checkins WHERE patient_id=u.id ORDER BY date DESC LIMIT 1) AS last_date,(SELECT mood FROM checkins WHERE patient_id=u.id ORDER BY date DESC LIMIT 1) AS last_mood,(SELECT count(*) FROM checkins WHERE patient_id=u.id) AS count,(SELECT count(*) FROM reports WHERE patient_id=u.id AND doctor_id=l.doctor_id AND reviewed_at IS NULL) AS pending_reports,(SELECT count(*) FROM assessments WHERE patient_id=u.id AND doctor_id=l.doctor_id AND completed_at IS NOT NULL AND reviewed_at IS NULL) AS pending_assessments,(SELECT count(*) FROM assessments WHERE patient_id=u.id AND doctor_id=l.doctor_id AND kind=\'phq9\' AND completed_at IS NOT NULL AND reviewed_at IS NULL AND json_extract(answers,\'$[8]\')>0) AS pending_safety,(SELECT count(*) FROM practices WHERE patient_id=u.id AND (reviewed_at IS NULL OR reviewer_id IS NULL OR reviewer_id!=l.doctor_id)) AS pending_practices,(SELECT count(*) FROM goal_logs WHERE patient_id=u.id AND (reviewed_at IS NULL OR reviewer_id IS NULL OR reviewer_id!=l.doctor_id)) AS pending_goals ,(SELECT count(*) FROM sos_events WHERE patient_id=u.id AND acknowledged_at IS NULL) AS open_sos FROM links l JOIN users u ON u.id=l.patient_id WHERE l.doctor_id=? AND l.revoked_at IS NULL ORDER BY open_sos DESC,pending_safety DESC,(pending_reports+pending_assessments+pending_practices+pending_goals) DESC,u.name',c.get('user').id) }));
app.get('/api/doctor/invites', async c => {
  const db=database(c.env),user=c.get('user');
  // The token is shown once, when the invite is created. Only its digest is kept, so a listing cannot hand it out again.
  const rows=await many<{rowid:number;expires:number}>(db,'SELECT rowid AS rowid,expires FROM invites WHERE doctor_id=? AND used=0 AND expires>? ORDER BY expires DESC LIMIT 50',user.id,Date.now());
  return c.json({invites:rows.map(r=>({id:r.rowid,expires:r.expires,token:null}))});
});
app.post('/api/doctor/invites', async c => {
  if(!c.get('user').specialist_verified_at)return c.json({error:'Подтвердите профиль специалиста у администратора, чтобы приглашать пациентов.'},403);
  const db=database(c.env),token=randomToken(),expires=Date.now()+7*86400000;
  const inserted=await run(db,'INSERT INTO invites (token,doctor_id,expires,used) VALUES (?,?,?,0)',await digest(token),c.get('user').id,expires);
  await logAction(db,c.get('user').id,'create_invite',String(inserted.meta.last_row_id));
  return c.json({ id:inserted.meta.last_row_id, token, expires },201);
});
app.delete('/api/doctor/invites/:id', async c => {
  const db=database(c.env),id=Number(c.req.param('id'));
  if(!Number.isInteger(id)||id<=0)return c.json({error:'Приглашение не найдено.'},404);
  const result=await run(db,'UPDATE invites SET used=1,raw=NULL WHERE rowid=? AND doctor_id=? AND used=0',id,c.get('user').id);
  if(!result.meta.changes)return c.json({error:'Приглашение уже использовано или отозвано.'},404);
  await logAction(db,c.get('user').id,'revoke_invite',String(id));
  return c.json({ok:true});
});
app.use('/api/doctor/patients/:id/*', async(c,next) => { const link=await one(database(c.env),'SELECT patient_id FROM links WHERE patient_id=? AND doctor_id=? AND revoked_at IS NULL',c.req.param('id'),c.get('user').id); if(!link) return c.json({ error:'Доступ к пациенту отсутствует или отозван.' },403); await next(); });
doctorCareRoutes(app);
surveyRoutes(app);
verificationRoutes(app);directoryRoutes(app);bookingRoutes(app);
adminRoutes(app);
app.get('/api/doctor/patients/:id/data', async c => { const id=c.req.param('id'),db=database(c.env); await logAction(db,c.get('user').id,'view_patient',id); await run(db,'UPDATE sos_events SET acknowledged_at=?,acknowledged_by=? WHERE patient_id=? AND acknowledged_at IS NULL',Date.now(),c.get('user').id,id); const data=await patientData(db,id); const patient=await one<{id:string;name:string}>(db,'SELECT id,name FROM users WHERE id=?',id); const reports=await many<{payload:string}>(db,'SELECT * FROM reports WHERE patient_id=? AND doctor_id=? ORDER BY (reviewed_at IS NULL) DESC,created_at DESC LIMIT 30',id,c.get('user').id); return c.json({ ...data,draft:null,reports:reports.map(({payload,...row})=>({...row,...JSON.parse(payload)})),patient:{...patient,profile:await patientProfile(db,id)} }); });
app.post('/api/doctor/patients/:id/reports/:reportId/review', async c => {
 const db=database(c.env),report=await one<{id:string}>(db,'SELECT id FROM reports WHERE id=? AND patient_id=? AND doctor_id=?',c.req.param('reportId'),c.req.param('id'),c.get('user').id);
 if(!report)return c.json({error:'Сводка недоступна.'},404);
 await run(db,'UPDATE reports SET reviewed_at=COALESCE(reviewed_at,?) WHERE id=?',Date.now(),report.id);
 await logAction(db,c.get('user').id,'review_report',report.id);
 return c.json({ok:true});
});
app.put('/api/doctor/patients/:id/plan', async c => { const data=planSchema.safeParse(await c.req.json()); if(!data.success) return c.json({ error:'Проверьте план наблюдения.' },400);
  const foreign=await foreignCustomRefs(database(c.env),c.get('user').id,data.data.practices); if(foreign.length) return c.json({ error:'В план можно поставить только действующие практики из вашей библиотеки. Уберите архивные.' },400); await run(database(c.env),'INSERT INTO plans (patient_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(patient_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',c.req.param('id'),JSON.stringify(data.data),Date.now()); await logAction(database(c.env),c.get('user').id,'update_plan',c.req.param('id')); return c.json({ plan:data.data }); });
app.all('/api/*', c=>c.json({ error:'Неизвестный запрос.' },404));
app.get('*', c=>c.env.ASSETS.fetch(c.req.raw));
export default app;
