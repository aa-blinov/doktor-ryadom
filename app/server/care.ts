import {standardKinds,standardKind,standardAnswersValid,standardScore} from '../src/assessments';
import {validSurveyAnswers,type SurveySnapshot,type SurveyAnswer} from '../src/surveys';
import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import {canPrescribe,entrySchema,planSchema,settingsSchema,defaultSettings,followupSchema,goalSchema,goalLogSchema,type User,type Entry,type Assessment,type Followup,type Medication,type MedicationLog,type Experience,type Goal,type GoalLog} from '../src/shared';
import {one,many,run,logAction,database} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
const date=entrySchema.shape.date;
export async function careData(db:D1Database,id:string){
 const [draft,assessments,followups,medications,medicationLogs,experiences,goals,goalLogs]=await Promise.all([
  one<{data:string}>(db,'SELECT data FROM drafts WHERE patient_id=?',id),many<Omit<Assessment,'answers'|'definition'|'safety'>&{answers:string|null;definition:string|null;safety_plan:string|null}>(db,'SELECT * FROM assessments WHERE patient_id=? AND (completed_at IS NOT NULL OR doctor_id=(SELECT doctor_id FROM links WHERE patient_id=? AND revoked_at IS NULL)) ORDER BY due_date DESC,completed_at DESC LIMIT 100',id,id),many<Omit<Followup,'data'>&{data:string}>(db,'SELECT * FROM followups WHERE patient_id=? ORDER BY created_at DESC LIMIT 100',id),many<Medication>(db,'SELECT * FROM medications WHERE patient_id=? ORDER BY created_at DESC',id),many<MedicationLog>(db,'SELECT * FROM medication_logs WHERE patient_id=? ORDER BY date DESC LIMIT 1000',id),many<Experience>(db,'SELECT * FROM experiences WHERE patient_id=? ORDER BY date DESC LIMIT 365',id),many<Goal>(db,'SELECT * FROM goals WHERE patient_id=? ORDER BY created_at DESC LIMIT 100',id),many<GoalLog>(db,'SELECT * FROM goal_logs WHERE patient_id=? ORDER BY created_at DESC LIMIT 1000',id)
 ]);
 return {draft:draft?JSON.parse(draft.data):null,assessments:assessments.map(({safety_plan,...r})=>({...r,safety:safety_plan?JSON.parse(safety_plan):null,answers:r.answers?JSON.parse(r.answers):null,definition:r.definition?JSON.parse(r.definition):null})),followups:followups.map(r=>({...r,data:JSON.parse(r.data)})),medications,medicationLogs,experiences,goals,goalLogs};
}
export function patientCareRoutes(app:App){
 app.post('/api/patient/goals',async c=>{
  const parsed=goalSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Опишите цель: от 3 до 180 символов'},400);
  const db=database(c.env),patient=c.get('user').id;
  const result=await run(db,'INSERT INTO goals(id,patient_id,title,reason,created_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM goals WHERE patient_id=? AND closed_at IS NULL)<3',crypto.randomUUID(),patient,parsed.data.title,parsed.data.reason,Date.now(),patient);
  return result.meta.changes?c.json({ok:true},201):c.json({error:'Можно вести до трёх целей одновременно. Завершите одну, прежде чем добавить новую'},409);
 });
 app.post('/api/patient/goals/:goalId/logs',async c=>{
  const parsed=goalLogSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Выберите, как продвигается цель, и сократите заметку до 1000 символов'},400);
  const id=c.get('user').id,db=database(c.env),goal=c.req.param('goalId');
  const result=await run(db,'INSERT INTO goal_logs(id,patient_id,goal_id,status,note,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM goals WHERE id=? AND patient_id=? AND closed_at IS NULL)',crypto.randomUUID(),id,goal,parsed.data.status,parsed.data.note,Date.now(),goal,id);
  return result.meta.changes?c.json({ok:true},201):c.json({error:'Цель недоступна или уже завершена'},404);
 });
 app.put('/api/patient/goals/:goalId/close',async c=>{
  const result=await run(database(c.env),'UPDATE goals SET closed_at=? WHERE id=? AND patient_id=? AND closed_at IS NULL',Date.now(),c.req.param('goalId'),c.get('user').id);
  return result.meta.changes?c.json({ok:true}):c.json({error:'Цель недоступна или уже завершена'},404);
 });
 app.put('/api/patient/goals/:goalId/restore',async c=>{
  const result=await run(database(c.env),'UPDATE goals SET closed_at=NULL WHERE id=? AND patient_id=? AND closed_at IS NOT NULL',c.req.param('goalId'),c.get('user').id);
  return result.meta.changes?c.json({ok:true}):c.json({error:'Цель недоступна или ещё не завершена'},404);
 });
 app.get('/api/patient/draft',async c=>{
  const row=await one<{data:string}>(database(c.env),'SELECT data FROM drafts WHERE patient_id=?',c.get('user').id);
  if(!row)return c.json({error:'Черновика нет.'},404);
  return c.json({draft:JSON.parse(row.data)});
 });
 app.put('/api/patient/draft',async c=>{
  const parsed=z.object({entry:entrySchema.extend({mood:z.number().int().min(0).max(5)}),plan:planSchema,step:z.number().int().min(0).max(8)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Не удалось сохранить черновик.'},400);
  const db=database(c.env),id=c.get('user').id;if(Math.abs(Date.parse(parsed.data.entry.date)-Date.now())>2*86400000)return c.json({error:'Этот черновик относится к прошедшему дню.'},400);
  if(await one(db,'SELECT id FROM checkins WHERE patient_id=? AND date=?',id,parsed.data.entry.date))return c.json({error:'Отметка уже сохранена.'},409);
  await run(db,'INSERT INTO drafts VALUES (?,?,?) ON CONFLICT(patient_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',id,JSON.stringify(parsed.data),Date.now());return c.json({ok:true});
 });
 app.delete('/api/patient/draft',async c=>{await run(database(c.env),'DELETE FROM drafts WHERE patient_id=?',c.get('user').id);return c.json({ok:true});});
 app.put('/api/patient/checkins/:entryId',async c=>{
  const parsed=entrySchema.extend({expectedVersion:z.number().int().min(1)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте ответы.'},400);
  const db=database(c.env),id=c.get('user').id,entryId=c.req.param('entryId');
  const existing=await one<Entry>(db,'SELECT * FROM checkins WHERE id=? AND patient_id=?',entryId,id);if(!existing)return c.json({error:'Запись не найдена.'},404);
  const e=parsed.data;if(existing.date!==e.date)return c.json({error:'Дата сохранённой записи не меняется.'},400);
  // Правило продукта: правка доступна только за сегодняшний день пациента (его часовой пояс).
  const settings=await one<{data:string}>(db,'SELECT data FROM settings WHERE user_id=?',id);
  if(existing.date!==patientDay(Date.now(),settings?.data))return c.json({error:'Исправить можно только сегодняшнюю запись.'},400);
  const now=Date.now();const results=await db.batch([
   db.prepare('INSERT INTO checkin_revisions SELECT ?,id,patient_id,?,version,? FROM checkins WHERE id=? AND patient_id=? AND version=?').bind(crypto.randomUUID(),JSON.stringify(existing),now,entryId,id,e.expectedVersion),
   db.prepare('UPDATE checkins SET mood=?,sleep=?,anxiety=?,energy=?,functioning=?,sleep_context=?,note=?,habit=?,version=version+1,updated_at=? WHERE id=? AND patient_id=? AND version=?').bind(e.mood,e.sleep,e.anxiety,e.energy,e.functioning,e.sleepContext,e.note,e.habit===null?null:Number(e.habit),now,entryId,id,e.expectedVersion)
  ]);
  if(!results[1].meta.changes)return c.json({error:'Запись уже изменена в другом окне. Обновите историю и откройте её заново.'},409);
  await logAction(db,id,'edit_checkin',id);return c.json({ok:true});
 });
 app.post('/api/patient/assessments/:assessmentId',async c=>{
  const parsed=z.object({answers:z.array(z.union([z.number(),z.string().max(1000),z.null()])).min(1).max(12)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Ответьте на все вопросы.'},400);
  const db=database(c.env),id=c.get('user').id;
  const row=await one<{id:string;kind:string;due_date:string;completed_at:number|null;definition:string|null;safety_plan:string|null}>(db,'SELECT a.* FROM assessments a JOIN links l ON l.patient_id=a.patient_id AND l.doctor_id=a.doctor_id AND l.revoked_at IS NULL WHERE a.id=? AND a.patient_id=?',c.req.param('assessmentId'),id);if(!row)return c.json({error:'Опросник недоступен.'},404);
  const local=dateForTimezone(Date.now(),(await one<{data:string}>(db,'SELECT data FROM settings WHERE user_id=?',id))?.data);
  if(row.due_date>local)return c.json({error:'Опросник будет доступен в назначенный день.'},400);
  const answers=parsed.data.answers;const definition=row.definition?JSON.parse(row.definition) as SurveySnapshot:null;
  if(definition?!validSurveyAnswers(definition,answers):!standardAnswersValid(standardKind(row.kind as Assessment['kind']),answers))return c.json({error:'Проверьте ответы на вопросы'},400);
  const saved=await run(db,'UPDATE assessments SET answers=?,score=?,completed_at=? WHERE id=? AND completed_at IS NULL',JSON.stringify(parsed.data.answers),definition?null:standardScore(standardKind(row.kind as Assessment['kind']),answers as number[]),Date.now(),row.id);if(saved.meta.changes)await logAction(db,id,'complete_assessment',row.id);
  return saved.meta.changes?c.json({ok:true},201):c.json({error:'Ответы уже сохранены.'},409);
 });
 app.post('/api/patient/medication-logs',async c=>{
  const parsed=z.object({medicationId:z.string().uuid(),date,status:z.enum(['taken','missed','not_needed']),note:z.string().trim().max(500)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте отметку приёма.'},400);
  const db=database(c.env),id=c.get('user').id,e=parsed.data;
  const med=await one<{start_date:string;end_date:string|null;as_needed:number}>(db,'SELECT * FROM medications WHERE id=? AND patient_id=?',e.medicationId,id);if(!med)return c.json({error:'Назначение не найдено.'},404);
  if(e.status==='not_needed'&&!med.as_needed)return c.json({error:'Для этого назначения выберите приём по схеме или пропуск.'},400);
  if(e.date<med.start_date||(med.end_date&&e.date>med.end_date)||Math.abs(Date.parse(e.date)-Date.now())>2*86400000)return c.json({error:'Проверьте дату приёма.'},400);
  // За день одна отметка: прежняя не перезаписывается молча, её удаляют явно.
  if(await one(db,'SELECT id FROM medication_logs WHERE patient_id=? AND medication_id=? AND date=?',id,e.medicationId,e.date))return c.json({error:'Отметка за этот день уже сохранена. Удалите прежнюю, чтобы поставить новую.'},409);
  await run(db,'INSERT INTO medication_logs VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),id,e.medicationId,e.date,e.status,e.note,Date.now());return c.json({ok:true});
 });
 app.delete('/api/patient/medication-logs/:logId',async c=>{
  const result=await run(database(c.env),'DELETE FROM medication_logs WHERE id=? AND patient_id=?',c.req.param('logId'),c.get('user').id);
  return result.meta.changes?c.json({ok:true}):c.json({error:'Отметка не найдена.'},404);
 });
 // Смена статуса отметки: атомарно, без удаления и создания заново.
 app.put('/api/patient/medication-logs/:logId',async c=>{
  const parsed=z.object({status:z.enum(['taken','missed','not_needed']),note:z.string().trim().max(500).default('')}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте отметку приёма.'},400);
  const db=database(c.env),id=c.get('user').id;
  const log=await one<{id:string;medication_id:string;date:string;status:string}>(db,'SELECT id,medication_id,date,status FROM medication_logs WHERE id=? AND patient_id=?',c.req.param('logId'),id);
  if(!log)return c.json({error:'Отметка не найдена.'},404);
  const med=await one<{as_needed:number}>(db,'SELECT as_needed FROM medications WHERE id=? AND patient_id=?',log.medication_id,id);if(!med)return c.json({error:'Назначение не найдено.'},404);
  if(parsed.data.status==='not_needed'&&!med.as_needed)return c.json({error:'Для этого назначения выберите приём по схеме или пропуск.'},400);
  await run(db,'UPDATE medication_logs SET status=?,note=? WHERE id=? AND patient_id=?',parsed.data.status,parsed.data.note,log.id,id);
  await logAction(db,id,'update_medication_log',log.id);
  return c.json({ok:true});
 });
 app.post('/api/patient/experiences',async c=>{
  const parsed=z.object({date,note:z.string().trim().min(1).max(1000)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Опишите, что вы заметили.'},400);
  if(Math.abs(Date.parse(parsed.data.date)-Date.now())>2*86400000)return c.json({error:'Проверьте дату.'},400);
  await run(database(c.env),'INSERT INTO experiences VALUES (?,?,?,?,?)',crypto.randomUUID(),c.get('user').id,parsed.data.date,parsed.data.note,Date.now());return c.json({ok:true},201);
 });
}
export function doctorCareRoutes(app:App){
 app.post('/api/doctor/patients/:id/practices/:logId/review',async c=>{
  const result=await run(database(c.env),'UPDATE practices SET reviewed_at=CASE WHEN reviewer_id=? THEN COALESCE(reviewed_at,?) ELSE ? END,reviewer_id=? WHERE id=? AND patient_id=?',c.get('user').id,Date.now(),Date.now(),c.get('user').id,c.req.param('logId'),c.req.param('id'));
  return result.meta.changes?c.json({ok:true}):c.json({error:'Отзыв недоступен'},404);
 });
 app.post('/api/doctor/patients/:id/goal-logs/:logId/review',async c=>{
  const result=await run(database(c.env),'UPDATE goal_logs SET reviewed_at=CASE WHEN reviewer_id=? THEN COALESCE(reviewed_at,?) ELSE ? END,reviewer_id=? WHERE id=? AND patient_id=?',c.get('user').id,Date.now(),Date.now(),c.get('user').id,c.req.param('logId'),c.req.param('id'));
  return result.meta.changes?c.json({ok:true}):c.json({error:'Отметка недоступна'},404);
 });
 app.post('/api/doctor/patients/:id/goals',async c=>{
  const parsed=goalSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Опишите цель: от 3 до 180 символов'},400);
  const db=database(c.env),patient=c.req.param('id');
  // Цель принадлежит пациенту, но создана врачом: пациент видит её в своих целях.
  const result=await run(db,'INSERT INTO goals(id,patient_id,title,reason,created_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM goals WHERE patient_id=? AND closed_at IS NULL)<3',crypto.randomUUID(),patient,parsed.data.title,parsed.data.reason,Date.now(),patient);
  if(!result.meta.changes)return c.json({error:'Можно вести до трёх целей одновременно. Завершите одну, прежде чем добавить новую'},409);
  await logAction(db,c.get('user').id,'create_goal',patient);return c.json({ok:true},201);
 });
 app.post('/api/doctor/patients/:id/assessments',async c=>{
  const parsed=z.object({kind:z.enum(standardKinds),dueDate:date,safety:z.object({contact:z.string().trim().min(5).max(300),reviewNote:z.string().trim().min(5).max(500),confirmed:z.literal(true)}).optional()}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Выберите опросник и дату.'},400);
  if(parsed.data.kind==='phq9'&&!parsed.data.safety)return c.json({error:'Для PHQ-9 укажите согласованный способ связи и порядок реагирования'},400);
  const db=database(c.env),id=c.req.param('id');if(await one(db,'SELECT id FROM assessments WHERE patient_id=? AND doctor_id=? AND kind=? AND due_date=?',id,c.get('user').id,parsed.data.kind,parsed.data.dueDate))return c.json({error:'Этот опросник уже назначен на выбранную дату.'},409);
  await run(db,'INSERT INTO assessments (id,patient_id,doctor_id,kind,due_date,safety_plan) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),id,c.get('user').id,parsed.data.kind,parsed.data.dueDate,parsed.data.kind==='phq9'?JSON.stringify({contact:parsed.data.safety!.contact,reviewNote:parsed.data.safety!.reviewNote}):null);await logAction(db,c.get('user').id,'assign_assessment',id);return c.json({ok:true},201);
 });
 app.delete('/api/doctor/patients/:id/assessments/:assessmentId',async c=>{
  const r=await run(database(c.env),'DELETE FROM assessments WHERE id=? AND patient_id=? AND doctor_id=? AND completed_at IS NULL',c.req.param('assessmentId'),c.req.param('id'),c.get('user').id);return r.meta.changes?c.json({ok:true}):c.json({error:'Завершённый опросник нельзя отменить.'},409);
 });
 app.post('/api/doctor/patients/:id/assessments/:assessmentId/review',async c=>{
  const db=database(c.env);const r=await run(db,'UPDATE assessments SET reviewed_at=COALESCE(reviewed_at,?) WHERE id=? AND patient_id=? AND doctor_id=? AND completed_at IS NOT NULL',Date.now(),c.req.param('assessmentId'),c.req.param('id'),c.get('user').id);if(r.meta.changes)await logAction(db,c.get('user').id,'review_assessment',c.req.param('assessmentId'));return r.meta.changes?c.json({ok:true}):c.json({error:'Результат недоступен.'},404);
 });
 app.post('/api/doctor/patients/:id/followups',async c=>{
  const parsed=followupSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Добавьте рекомендации и проверьте дату.'},400);
  await run(database(c.env),'INSERT INTO followups VALUES (?,?,?,?,?)',crypto.randomUUID(),c.req.param('id'),c.get('user').id,JSON.stringify(parsed.data),Date.now());return c.json({ok:true},201);
 });
 app.post('/api/doctor/patients/:id/medications',async c=>{
  if(!canPrescribe(c.get('user')))return c.json({error:'Назначать препараты может только подтверждённый врач-психиатр.'},403);
  const parsed=z.object({name:z.string().trim().min(1).max(120),instructions:z.string().trim().min(1).max(1000),startDate:date,asNeeded:z.boolean().default(false)}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Добавьте название, схему приёма и дату начала.'},400);
  const e=parsed.data;await run(database(c.env),'INSERT INTO medications (id,patient_id,doctor_id,name,instructions,start_date,created_at,as_needed) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.req.param('id'),c.get('user').id,e.name,e.instructions,e.startDate,Date.now(),Number(e.asNeeded));return c.json({ok:true},201);
 });
 app.put('/api/doctor/patients/:id/medications/:medicationId/end',async c=>{
  const parsed=z.object({date}).safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Проверьте дату завершения.'},400);
  const r=await run(database(c.env),'UPDATE medications SET end_date=? WHERE id=? AND patient_id=? AND doctor_id=? AND start_date<=? AND end_date IS NULL',parsed.data.date,c.req.param('medicationId'),c.req.param('id'),c.get('user').id,parsed.data.date);return r.meta.changes?c.json({ok:true}):c.json({error:'Назначение недоступно или уже завершено.'},409);
 });
}
export function dateForTimezone(now:number,settingsJson?:string){const settings=settingsSchema.parse(settingsJson?JSON.parse(settingsJson):defaultSettings);return new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
// Сегодняшний день пациента по его часовому поясу; испорченные настройки не должны ломать правку записи.
export function patientDay(now:number,settingsJson?:string){try{return dateForTimezone(now,settingsJson);}catch{return dateForTimezone(now);}}
