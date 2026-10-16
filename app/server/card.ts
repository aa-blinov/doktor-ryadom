import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import type {User} from '../src/shared';
import {one,many,run,database} from './db';
import {storedProfile} from './profiles';
import {assessmentContent,standardKind} from '../src/assessments';
import {zoneDateTime,DEFAULT_TIMEZONE} from '../src/timezone';
import {queueNotice,sendNow} from './notices';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

export const CARD_KINDS=['visit_summary','diagnosis','treatment','referral','other'] as const;
const KIND_LABEL:Record<string,string>={visit_summary:'Итоги приёма',diagnosis:'Диагноз',treatment:'Назначение и план лечения',referral:'Направление',other:'Запись'};
const entrySchema=z.object({kind:z.enum(CARD_KINDS),body:z.string().trim().min(1,'Напишите текст записи').max(4000,'Запись длиннее 4000 символов'),occurredOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Укажите дату')});
const withdrawSchema=z.object({reason:z.string().trim().min(1,'Напишите причину отзыва').max(500,'Причина короче 500 символов')});

type EntryRow={id:string;patient_id:string;author_id:string;author_name:string;kind:string;body:string;occurred_on:string;created_at:number;withdrawn_at:number|null;withdraw_reason:string|null};
const entryView=(e:EntryRow,me?:string)=>({id:e.id,kind:e.kind,kindLabel:KIND_LABEL[e.kind]??'Запись',body:e.withdrawn_at?'':e.body,occurredOn:e.occurred_on,createdAt:e.created_at,authorName:e.author_name,mine:e.author_id===me,withdrawn:e.withdrawn_at!==null,withdrawReason:e.withdraw_reason??null});
const ENTRY_SQL='SELECT e.id,e.patient_id,e.author_id,u.name AS author_name,e.kind,e.body,e.occurred_on,e.created_at,e.withdrawn_at,e.withdraw_reason FROM card_entries e JOIN users u ON u.id=e.author_id';

// The patient card: profile, the entries doctors add, and the history built from the records the patient already has.
export function cardRoutes(app:App){
 app.get('/api/patient/card',async c=>{
  const user=c.get('user');
  if(user.role!=='patient')return c.json({error:'Карточка пациента доступна пациенту'},403);
  const db=database(c.env),id=user.id;
  const [{data:profile},goals,meds,assessments,visits,entries]=await Promise.all([
   storedProfile(db,id),
   many<{id:string;title:string;reason:string;created_at:number;closed_at:number|null}>(db,'SELECT id,title,reason,created_at,closed_at FROM goals WHERE patient_id=? ORDER BY created_at DESC LIMIT 100',id),
   many<{id:string;name:string;instructions:string;as_needed:number;start_date:string;end_date:string|null;created_at:number;doctor_name:string}>(db,'SELECT m.id,m.name,m.instructions,m.as_needed,m.start_date,m.end_date,m.created_at,u.name AS doctor_name FROM medications m JOIN users u ON u.id=m.doctor_id WHERE m.patient_id=? ORDER BY m.created_at DESC LIMIT 100',id),
   many<{id:string;kind:string;score:number|null;completed_at:number;definition:string|null;doctor_name:string}>(db,'SELECT a.id,a.kind,a.score,a.completed_at,a.definition,u.name AS doctor_name FROM assessments a JOIN users u ON u.id=a.doctor_id WHERE a.patient_id=? AND a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT 100',id),
   many<{id:string;status:string;reason:string;starts_at:number;minutes:number;patient_tz:string;doctor_name:string}>(db,'SELECT r.id,r.status,r.reason,r.patient_tz,s.starts_at,s.minutes,u.name AS doctor_name FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id JOIN users u ON u.id=r.doctor_id WHERE r.patient_id=? ORDER BY s.starts_at DESC LIMIT 200',id),
   many<EntryRow>(db,`${ENTRY_SQL} WHERE e.patient_id=? ORDER BY e.occurred_on DESC, e.created_at DESC LIMIT 300`,id),
  ]);
  const assessmentTitle=(kind:string,definition:string|null)=>definition?JSON.parse(definition).title??'Авторский опрос':assessmentContent[standardKind(kind as Parameters<typeof standardKind>[0])].title;
  type Event={at:number;type:'visit'|'assessment'|'medication'|'goal'|'entry';title:string;detail:string};
  const history:Event[]=[
   ...visits.map(v=>({at:v.starts_at,type:'visit' as const,title:`Приём у врача: ${v.doctor_name}, ${zoneDateTime(v.starts_at,v.patient_tz)}`,detail:({confirmed:'подтверждён',pending:'ждёт ответа врача',declined:'врач не смог принять',cancelled:'отменён'} as Record<string,string>)[v.status]??v.status})),
   ...assessments.map(a=>({at:a.completed_at,type:'assessment' as const,title:assessmentTitle(a.kind,a.definition),detail:a.score===null?'Ответы сохранены':`Общий балл ${a.score}. Заполнил(а) по назначению: ${a.doctor_name}`})),
   ...meds.map(m=>({at:m.created_at,type:'medication' as const,title:`Назначен препарат: ${m.name}`,detail:`${m.doctor_name}${m.as_needed?', по необходимости':''}. С ${m.start_date}${m.end_date?` по ${m.end_date}`:''}`})),
   ...goals.flatMap(g=>[{at:g.created_at,type:'goal' as const,title:`Цель: ${g.title}`,detail:g.reason},...(g.closed_at?[{at:g.closed_at,type:'goal' as const,title:`Цель закрыта: ${g.title}`,detail:''}]:[])]),
   ...entries.map(e=>({at:Date.parse(`${e.occurred_on}T12:00:00Z`),type:'entry' as const,title:`${KIND_LABEL[e.kind]??'Запись'}, ${e.author_name}`,detail:e.withdrawn_at?`Отозвано: ${e.withdraw_reason??''}`:e.body})),
  ].sort((a,b)=>b.at-a.at).slice(0,400);
  return c.json({
   patient:{name:user.name,birthDate:profile.birthDate??null,about:profile.about??''},
   history,
   entries:entries.map(e=>entryView(e)),
   medications:meds.map(m=>({id:m.id,name:m.name,instructions:m.instructions,asNeeded:!!m.as_needed,startDate:m.start_date,endDate:m.end_date,doctorName:m.doctor_name})),
   goals:goals.map(g=>({id:g.id,title:g.title,reason:g.reason,createdAt:g.created_at,closedAt:g.closed_at})),
   assessments:assessments.map(a=>({id:a.id,title:assessmentTitle(a.kind,a.definition),score:a.score,completedAt:a.completed_at,doctorName:a.doctor_name})),
   note:'Записи в карточку вносят врачи, которые вас ведут. Записи не стираются: ошибочную запись врач отзывает с указанием причины. Личные заметки врача в карточку не входят.',
  });
 });

 // Doctor side: the card of a patient who is linked to this doctor. Entries are appended, never edited or erased.
 const linked=(db:D1Database,patientId:string,doctorId:string)=>one<{patient_id:string}>(db,'SELECT patient_id FROM links WHERE patient_id=? AND doctor_id=? AND revoked_at IS NULL',patientId,doctorId);

 app.get('/api/doctor/patients/:id/card',async c=>{
  const db=database(c.env),doctor=c.get('user').id,patientId=c.req.param('id');
  if(!await linked(db,patientId,doctor))return c.json({error:'Карточка доступна только пациенту, который подключён к вам'},403);
  const patient=await one<{name:string}>(db,'SELECT name FROM users WHERE id=?',patientId);
  const entries=await many<EntryRow>(db,`${ENTRY_SQL} WHERE e.patient_id=? ORDER BY e.occurred_on DESC, e.created_at DESC LIMIT 300`,patientId);
  return c.json({patientName:patient?.name??'',entries:entries.map(e=>entryView(e,doctor))});
 });

 app.post('/api/doctor/patients/:id/card/entries',async c=>{
  const parsed=entrySchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const db=database(c.env),doctor=c.get('user').id,patientId=c.req.param('id'),now=Date.now();
  if(!await linked(db,patientId,doctor))return c.json({error:'Карточка доступна только пациенту, который подключён к вам'},403);
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare('INSERT OR IGNORE INTO patient_cards (patient_id,created_at) VALUES (?,?)').bind(patientId,now),
   db.prepare('INSERT INTO card_entries (id,patient_id,author_id,kind,body,occurred_on,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,patientId,doctor,parsed.data.kind,parsed.data.body,parsed.data.occurredOn,now),
  ]);
  await queueNotice(db,`card:${id}:patient`,patientId,'Врач добавил запись в вашу карточку. Откройте карточку, чтобы прочитать.','/#/card',now);
  await sendNow(db,c.env);
  return c.json({id},201);
 });

 app.post('/api/doctor/card/entries/:id/withdraw',async c=>{
  const parsed=withdrawSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const db=database(c.env),doctor=c.get('user').id;
  // Only the author can withdraw an entry, and only once.
  const r=await run(db,'UPDATE card_entries SET withdrawn_at=?,withdraw_reason=? WHERE id=? AND author_id=? AND withdrawn_at IS NULL',Date.now(),parsed.data.reason,c.req.param('id'),doctor);
  return r.meta.changes?c.json({ok:true}):c.json({error:'Запись нельзя отозвать: её написали не вы или она уже отозвана'},409);
 });
}
