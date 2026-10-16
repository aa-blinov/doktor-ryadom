import type {SurveySnapshot,SurveyAnswer} from './surveys';
import { z } from 'zod';
export const practiceIds = ['ground', 'notice', 'action', 'senses', 'sounds', 'observe', 'walk', 'breath', 'unhook', 'kind', 'values', 'space'] as const;
export type PracticeId = typeof practiceIds[number];
// Порядок просмотра записей из плана убран: на главной пациента он читался как текст
// приложения без подписи, а содержание расходилось с тем, что врач писал на самом деле.
// Способ связи и время ответа врач указывает в записи приёма, а режим просмотра —
// в рекомендациях пациенту; оба места пациент читает осознанно.
export const planSchema = z.object({ frequency: z.enum(['daily', 'three', 'weekly']), sleep: z.boolean(), anxiety: z.boolean(), energy: z.boolean(), functioning: z.boolean(), practices: z.array(z.enum(practiceIds)).max(practiceIds.length), habit: z.string().trim().max(180) });
export const defaultPlan = { frequency: 'daily' as const, sleep: true, anxiety: true, energy: false, functioning: true, practices: [] as PracticeId[], habit: '' };
export type Plan = z.infer<typeof planSchema>;
export const settingsSchema = z.object({ reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), paused: z.boolean(), blockedPractices: z.array(z.enum(practiceIds)).max(practiceIds.length), timezone:z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Проверьте часовой пояс').default('Asia/Almaty'), reminderEmail:z.boolean().default(false), reminderPush:z.boolean().default(false), reportNotifications:z.boolean().default(false) });
export const defaultSettings = { reminderTime: '20:00', paused: false, blockedPractices: [] as PracticeId[], timezone:'Asia/Almaty',reminderEmail:false,reminderPush:false,reportNotifications:false };
export type Settings = z.infer<typeof settingsSchema>;
export const entrySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Некорректная дата'), mood: z.number().int().min(1).max(5), sleep: z.number().min(0).max(24).nullable(), anxiety: z.number().int().min(0).max(4).nullable(), energy: z.number().int().min(1).max(5).nullable(), functioning: z.number().int().min(1).max(3).nullable(), sleepContext: z.enum(['tired', 'usual', 'active']).nullable(), note: z.string().trim().max(2000), habit: z.boolean().nullable() });
export type EntryInput = z.infer<typeof entrySchema>;
export type Entry = EntryInput & { id: string; created_at: number; version?:number;updated_at?:number|null };
export const specialtyKinds=['psychologist','psychotherapist','psychiatrist'] as const;
export type SpecialtyKind=typeof specialtyKinds[number];
export const specialtyLabels:Record<SpecialtyKind,string>={psychologist:'Психолог',psychotherapist:'Психотерапевт',psychiatrist:'Психиатр'};
export type User = { id: string; name: string; email: string; role: 'patient' | 'doctor' | 'admin';email_verified_at?:number|null;specialist_verified_at?:number|null;specialty_kind?:SpecialtyKind|null;photoUrl?:string|null };
// Only a verified psychiatrist may prescribe medication.
export const canPrescribe=(user:Pick<User,'role'|'specialist_verified_at'|'specialty_kind'>)=>user.role==='doctor'&&!!user.specialist_verified_at&&user.specialty_kind==='psychiatrist';
export type PracticeLog = { id: string; practice_id: string; feedback: 'comfortable' | 'same' | 'unpleasant'; completed_at: number;note?:string;reviewed_at?:number|null;reviewer_id?:string|null };
export const goalSchema=z.object({title:z.string().trim().min(3).max(180),reason:z.string().trim().max(500)});
export const goalLogSchema=z.object({status:z.enum(['step','difficult','reached']),note:z.string().trim().max(1000)});
export type Goal={id:string;title:string;reason:string;created_at:number;closed_at:number|null};
export type GoalLog={id:string;goal_id:string;status:'step'|'difficult'|'reached';note:string;created_at:number;reviewed_at:number|null;reviewer_id:string|null};
export type Report = { id: string; doctor_id: string; from_date: string; to_date: string; created_at: number; reviewed_at: number | null; entries: Entry[]; practices: PracticeLog[]; plan: Plan;assessments?:Assessment[];medications?:Medication[];medicationLogs?:MedicationLog[];experiences?:Experience[];followups?:Followup[];goals?:Goal[];goalLogs?:GoalLog[] };
export type PatientData = { lastSosAt?: number | null; entriesTruncated?: boolean; reports: Report[]; entries: Entry[]; practices: PracticeLog[]; plan: Plan; settings: Settings; doctor: { id: string; name: string;profile?:DoctorProfile } | null;draft:CheckinDraft|null;assessments:Assessment[];followups:Followup[];medications:Medication[];medicationLogs:MedicationLog[];experiences:Experience[];goals?:Goal[];goalLogs?:GoalLog[] };
export type PatientRow = { id: string; name: string; last_date: string | null; last_mood: number | null; count: number; pending_reports: number;pending_assessments:number;pending_safety?:number;pending_practices?:number;pending_goals?:number;open_sos?:number };
// ponytail: рабочие пороги, утверждает психиатр. Настроение 1-2 это «Очень тяжело» и «Тяжело».
export const attentionRules={silentDays:3,lowMood:2};
export function attentionFlags(p:PatientRow,todayDate:string){
 const flags:{key:string;label:string}[]=[];
 if(p.open_sos)flags.push({key:'sos',label:'Сигнал: «Мне сейчас плохо»'});
 if(p.pending_safety)flags.push({key:'safety',label:'PHQ-9, нужен просмотр пункта 9'});
 if(!p.last_date){if(p.count===0)flags.push({key:'silent',label:'Нет отметок'});}
 else if((Date.parse(todayDate)-Date.parse(p.last_date))/86400000>=attentionRules.silentDays)flags.push({key:'silent',label:`Нет отметок ${Math.floor((Date.parse(todayDate)-Date.parse(p.last_date))/86400000)} дн.`});
 if(p.last_mood!==null&&p.last_mood<=attentionRules.lowMood)flags.push({key:'mood',label:'Низкое самочувствие'});
 return flags;
}
export const moods = ['Очень тяжело', 'Тяжело', 'Нейтрально', 'Хорошо', 'Очень хорошо'];
/** Given name. Registration stores «Фамилия Имя»; a single word is the name itself. */
export function firstNameOf(name:string){
 const parts=name.trim().split(/\s+/).filter(Boolean);
 if(parts.length<=1)return parts[0]||name;
 return parts[1];
}
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function signals(entries: Entry[]) { const latest = entries.slice(0, 3); const shortSleep = latest.filter(e => e.sleep !== null && e.sleep < 6); const difficult = latest.filter(e => e.functioning === 1); return [shortSleep.length >= 2 ? `${shortSleep.length} из последних ${latest.length} отметок: сон менее 6 часов` : '', difficult.length >= 2 ? `${difficult.length} из последних ${latest.length} отметок: обычные дела даются очень трудно` : ''].filter(Boolean); }

export type CheckinDraft={entry:EntryInput;plan:Plan;step:number};
export type Assessment={id:string;doctor_id:string;kind:'gad7'|'phq2'|'who5'|'phq9'|`custom:${string}`;due_date:string;answers:SurveyAnswer[]|null;definition?:SurveySnapshot|null;safety?:{contact:string;reviewNote:string}|null;score:number|null;completed_at:number|null;reviewed_at:number|null};
export const followupSchema=z.object({notes:z.string().trim().min(1).max(3000),goal:z.string().trim().max(300),nextDate:entrySchema.shape.date.nullable(),contact:z.string().trim().max(500)});
export type Followup={id:string;doctor_id:string;created_at:number;data:z.infer<typeof followupSchema>};
export type Medication={id:string;doctor_id:string;name:string;instructions:string;as_needed:number;start_date:string;end_date:string|null;created_at:number};
export type MedicationLog={id:string;medication_id:string;date:string;status:'taken'|'missed'|'not_needed';note:string;created_at:number};
export type Experience={id:string;date:string;note:string;created_at:number};

export function todayInTimezone(timezone:string) { return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }

const profileDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=todayInTimezone('Asia/Almaty')&&v>='1900-01-01','Проверьте дату рождения');
const profileName=z.string().trim().min(2,'Укажите имя, минимум 2 символа').max(80,'Имя должно быть короче 80 символов');
export const patientProfileSchema=z.object({name:profileName,birthDate:profileDate.nullable(),about:z.string().trim().max(1000,'Заметка должна быть короче 1000 символов')}).strict();
export const doctorProfileSchema=z.object({name:profileName,specialty:z.string().trim().max(120,'Специальность должна быть короче 120 символов'),address:z.string().trim().max(500,'Сократите адрес до 500 символов').default(''),clinic:z.string().trim().max(160,'Название места работы должно быть короче 160 символов'),experienceYears:z.number().int('Укажите стаж целым числом').min(0,'Стаж не может быть отрицательным').max(80,'Проверьте стаж: не больше 80 лет').nullable(),about:z.string().trim().max(1000,'Описание должно быть короче 1000 символов'),education:z.string().trim().max(2000,'Сократите запись до 2000 символов').default(''),courses:z.string().trim().max(2000,'Сократите запись до 2000 символов').default(''),workHistory:z.string().trim().max(2000,'Сократите запись до 2000 символов').default(''),focusAreas:z.string().trim().max(1000,'Сократите список до 1000 символов').default(''),showEducation:z.boolean().default(true),showCourses:z.boolean().default(true),showWorkHistory:z.boolean().default(true)}).strict();
export type PatientProfile=Omit<z.infer<typeof patientProfileSchema>,'name'>;
export type DoctorProfile=Omit<z.infer<typeof doctorProfileSchema>,'name'>&{photoUrl:string|null;videoUrl:string|null;documents:ProfileDocument[]};
export type ProfileDocument={id:string;category:'education'|'courses'|'workHistory';entry:string;filename:string;mime:string;shared:boolean;createdAt:number};
// "2 вопроса", "5 вопросов": the case comes from the last digits, not from the number alone.
export const plural=(n:number,one:string,few:string,many:string)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?few:many;
// Same wording the patient sees on the scale, so the diary never shows a bare "2/5"
export const energyWords=['Очень мало','Мало','Как обычно','Много','Необычно много'];
