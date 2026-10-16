import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User} from '../src/shared';
import {one,many,run,logAction,database} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

// Doctors and clinics in Kazakhstan work on Asia/Almaty, UTC+5 without daylight saving.
const TZ='+05:00', DAY=86400000, MAX_GENERATE_DAYS=62, MAX_GENERATED=500, BOOK_AHEAD_DAYS=14, MAX_PENDING_PER_PATIENT=5;
const SLOT_TAKEN='Этот слот уже занят или недоступен. Выберите другое время';
const VERIFIED_DOCTOR="u.role='doctor' AND u.specialist_verified_at IS NOT NULL AND u.blocked_at IS NULL";

const timeOfDay=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Укажите время в формате ЧЧ:ММ');
const dateOnly=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Укажите дату');
const generateSchema=z.object({
 dateFrom:dateOnly,dateTo:dateOnly,
 weekdays:z.array(z.number().int().min(1).max(7)).min(1,'Выберите хотя бы один день недели'),
 from:timeOfDay,to:timeOfDay,
 minutes:z.number().int().min(15,'Слот не короче 15 минут').max(120,'Слот не длиннее 120 минут'),
});
const reasonSchema=z.object({slotId:z.string().uuid(),reason:z.string().trim().max(300,'Причина должна быть короче 300 символов').default('')});

// ISO weekday (1 = Monday) for a calendar date, without touching the server clock zone.
const isoWeekday=(date:string)=>{const d=new Date(`${date}T00:00:00Z`).getUTCDay();return d===0?7:d;};
const minutesOf=(hhmm:string)=>{const [h,m]=hhmm.split(':').map(Number);return h*60+m;};

export function bookingRoutes(app:App){
 // Doctor side: the slot calendar and incoming requests.
 app.use('/api/doctor/slots/*',async(c,next)=>doctorGuard(c,next));
 app.use('/api/doctor/slots',async(c,next)=>doctorGuard(c,next));
 app.use('/api/doctor/appointments/*',async(c,next)=>doctorGuard(c,next));
 app.use('/api/doctor/appointments',async(c,next)=>doctorGuard(c,next));
 app.use('/api/patient/appointments/*',async(c,next)=>patientGuard(c,next));
 app.use('/api/patient/appointments',async(c,next)=>patientGuard(c,next));

 app.get('/api/doctor/slots',async c=>{
  const db=database(c.env),doctor=c.get('user').id;
  const from=Number(c.req.query('from'))||Date.now(),to=Number(c.req.query('to'))||from+30*DAY;
  if(!(to>from)||to-from>MAX_GENERATE_DAYS*DAY)return c.json({error:'Выберите период не длиннее двух месяцев'},400);
  const slots=await many<{id:string;starts_at:number;minutes:number;status:string;request_id:string|null;request_status:string|null;reason:string|null;patient_name:string|null}>(db,
   `SELECT s.id,s.starts_at,s.minutes,s.status,r.id AS request_id,r.status AS request_status,r.reason,u.name AS patient_name
    FROM doctor_slots s
    LEFT JOIN appointment_requests r ON r.slot_id=s.id AND r.status IN ('pending','confirmed')
    LEFT JOIN users u ON u.id=r.patient_id
    WHERE s.doctor_id=? AND s.starts_at>=? AND s.starts_at<? ORDER BY s.starts_at LIMIT 1000`,doctor,from,to);
  return c.json({slots:slots.map(s=>({id:s.id,startsAt:s.starts_at,minutes:s.minutes,status:s.status,request:s.request_id?{id:s.request_id,status:s.request_status,reason:s.reason??'',patientName:s.patient_name??''}:null}))});
 });

 app.post('/api/doctor/slots/generate',async c=>{
  const parsed=generateSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const p=parsed.data,db=database(c.env),doctor=c.get('user').id;
  const start=Date.parse(`${p.dateFrom}T00:00:00Z`),end=Date.parse(`${p.dateTo}T00:00:00Z`);
  if(!(end>=start)||(end-start)/DAY+1>MAX_GENERATE_DAYS)return c.json({error:'Выберите период не длиннее 62 дней'},400);
  if(minutesOf(p.to)-minutesOf(p.from)<p.minutes)return c.json({error:'Окно короче одного слота'},400);
  const rows:{starts:number}[]=[];
  for(let day=start;day<=end;day+=DAY){
   const date=new Date(day).toISOString().slice(0,10);
   if(!p.weekdays.includes(isoWeekday(date)))continue;
   for(let t=minutesOf(p.from);t+p.minutes<=minutesOf(p.to);t+=p.minutes){
    const hh=String(Math.floor(t/60)).padStart(2,'0'),mm=String(t%60).padStart(2,'0');
    const starts=Date.parse(`${date}T${hh}:${mm}:00${TZ}`);
    if(starts>Date.now())rows.push({starts});
   }
  }
  if(rows.length>MAX_GENERATED)return c.json({error:`За раз можно создать не больше ${MAX_GENERATED} слотов. Сократите период`},400);
  let created=0;
  for(let i=0;i<rows.length;i+=50){
   const results=await db.batch(rows.slice(i,i+50).map(r=>db.prepare('INSERT OR IGNORE INTO doctor_slots (id,doctor_id,starts_at,minutes) VALUES (?,?,?,?)').bind(crypto.randomUUID(),doctor,r.starts,p.minutes)));
   created+=results.reduce((sum,r)=>sum+(r.meta.changes??0),0);
  }
  await logAction(db,doctor,'generate_slots',doctor);
  return c.json({created,skipped:rows.length-created},201);
 });

 app.put('/api/doctor/slots/:id',async c=>{
  const body=z.object({closed:z.boolean()}).safeParse(await c.req.json());if(!body.success)return c.json({error:'Укажите, открыть или закрыть слот'},400);
  const db=database(c.env),doctor=c.get('user').id,id=c.req.param('id');
  const r=await run(db,`UPDATE doctor_slots SET status=? WHERE id=? AND doctor_id=? AND (?=0 OR NOT EXISTS(SELECT 1 FROM appointment_requests r WHERE r.slot_id=doctor_slots.id AND r.status IN ('pending','confirmed')))`,body.data.closed?'closed':'open',id,doctor,body.data.closed?1:0);
  return r.meta.changes?c.json({ok:true}):c.json({error:'Нельзя закрыть слот, на который есть заявка. Сначала ответьте на заявку'},409);
 });

 app.delete('/api/doctor/slots/:id',async c=>{
  const db=database(c.env),doctor=c.get('user').id;
  const r=await run(db,"DELETE FROM doctor_slots WHERE id=? AND doctor_id=? AND NOT EXISTS(SELECT 1 FROM appointment_requests r WHERE r.slot_id=doctor_slots.id AND r.status IN ('pending','confirmed'))",c.req.param('id'),doctor);
  return r.meta.changes?c.json({ok:true}):c.json({error:'Слот не найден или на него есть заявка'},409);
 });

 app.get('/api/doctor/appointments',async c=>{
  const db=database(c.env),doctor=c.get('user').id;
  const rows=await many<{id:string;status:string;reason:string;created_at:number;starts_at:number;minutes:number;patient_name:string}>(db,
   `SELECT r.id,r.status,r.reason,r.created_at,s.starts_at,s.minutes,u.name AS patient_name
    FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id JOIN users u ON u.id=r.patient_id
    WHERE r.doctor_id=? AND r.status IN ('pending','confirmed') ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, s.starts_at LIMIT 200`,doctor);
  return c.json({appointments:rows.map(r=>({id:r.id,status:r.status,reason:r.reason,startsAt:r.starts_at,minutes:r.minutes,patientName:r.patient_name,createdAt:r.created_at}))});
 });

 for(const action of ['confirm','decline','cancel'] as const){
  const from=action==='cancel'?'confirmed':'pending', to=action==='confirm'?'confirmed':action==='decline'?'declined':'cancelled';
  app.post(`/api/doctor/appointments/:id/${action}`,async c=>{
   const db=database(c.env),doctor=c.get('user').id,id=c.req.param('id');
   const r=await run(db,'UPDATE appointment_requests SET status=?,decided_at=? WHERE id=? AND doctor_id=? AND status=?',to,Date.now(),id,doctor,from);
   if(!r.meta.changes)return c.json({error:'Заявка уже обработана или не найдена'},409);
   await logAction(db,doctor,`appointment_${action}`,id);
   return c.json({ok:true});
  });
 }

 // Patient side: free slots of a verified doctor, own requests.
 app.get('/api/directory/:id/slots',async c=>{
  const db=database(c.env),doctorId=c.req.param('id');
  const doctor=await one(db,`SELECT u.id FROM users u WHERE u.id=? AND ${VERIFIED_DOCTOR}`,doctorId);
  if(!doctor)return c.json({error:'Врач не найден'},404);
  const now=Date.now();
  const slots=await many<{id:string;starts_at:number;minutes:number}>(db,
   `SELECT s.id,s.starts_at,s.minutes FROM doctor_slots s
    WHERE s.doctor_id=? AND s.status='open' AND s.starts_at>? AND s.starts_at<?
    AND NOT EXISTS(SELECT 1 FROM appointment_requests r WHERE r.slot_id=s.id AND r.status IN ('pending','confirmed'))
    ORDER BY s.starts_at LIMIT 500`,doctorId,now+30*60000,now+BOOK_AHEAD_DAYS*DAY);
  return c.json({slots:slots.map(s=>({id:s.id,startsAt:s.starts_at,minutes:s.minutes}))});
 });

 app.post('/api/patient/appointments',async c=>{
  const parsed=reasonSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const db=database(c.env),patient=c.get('user').id,{slotId,reason}=parsed.data;
  const pending=await one<{count:number}>(db,"SELECT COUNT(*) AS count FROM appointment_requests WHERE patient_id=? AND status='pending'",patient);
  if((pending?.count??0)>=MAX_PENDING_PER_PATIENT)return c.json({error:'У вас уже несколько заявок без ответа. Дождитесь решения врачей'},409);
  const id=crypto.randomUUID();
  let r;
  try{
   r=await run(db,
    `INSERT INTO appointment_requests (id,slot_id,patient_id,doctor_id,reason,status,created_at)
     SELECT ?,s.id,?,s.doctor_id,?,'pending',? FROM doctor_slots s
     WHERE s.id=? AND s.status='open' AND s.starts_at>?
     AND EXISTS(SELECT 1 FROM users u WHERE u.id=s.doctor_id AND ${VERIFIED_DOCTOR})`,
    id,patient,reason,Date.now(),slotId,Date.now());
  }catch(e){
   // The partial unique index refuses a second active request for the same slot.
   if(String(e).includes('UNIQUE'))return c.json({error:SLOT_TAKEN},409);
   throw e;
  }
  if(!r.meta.changes)return c.json({error:SLOT_TAKEN},409);
  await logAction(db,patient,'appointment_request',id);
  return c.json({id,status:'pending'},201);
 });

 app.get('/api/patient/appointments',async c=>{
  const db=database(c.env),patient=c.get('user').id;
  const rows=await many<{id:string;status:string;reason:string;starts_at:number;minutes:number;doctor_name:string;created_at:number}>(db,
   `SELECT r.id,r.status,r.reason,r.created_at,s.starts_at,s.minutes,u.name AS doctor_name
    FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id JOIN users u ON u.id=r.doctor_id
    WHERE r.patient_id=? ORDER BY s.starts_at DESC LIMIT 100`,patient);
  return c.json({appointments:rows.map(r=>({id:r.id,status:r.status,reason:r.reason,startsAt:r.starts_at,minutes:r.minutes,doctorName:r.doctor_name}))});
 });

 app.post('/api/patient/appointments/:id/cancel',async c=>{
  const db=database(c.env),patient=c.get('user').id;
  const r=await run(db,"UPDATE appointment_requests SET status='cancelled',decided_at=? WHERE id=? AND patient_id=? AND status IN ('pending','confirmed')",Date.now(),c.req.param('id'),patient);
  return r.meta.changes?c.json({ok:true}):c.json({error:'Запись уже отменена или не найдена'},409);
 });
}

async function doctorGuard(c:{get:(k:'user')=>User;json:(b:unknown,s?:number)=>Response},next:()=>Promise<void>){
 const user=c.get('user');
 if(user.role!=='doctor')return c.json({error:'Расписание доступно врачам'},403);
 if(!user.specialist_verified_at)return c.json({error:'Расписание появится после подтверждения профиля администратором'},403);
 await next();
}
async function patientGuard(c:{get:(k:'user')=>User;json:(b:unknown,s?:number)=>Response},next:()=>Promise<void>){
 if(c.get('user').role!=='patient')return c.json({error:'Записаться могут пациенты'},403);
 await next();
}
