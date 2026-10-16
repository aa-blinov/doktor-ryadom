import type {Hono} from 'hono';
import type {Env} from './env';
import type {User} from '../src/shared';
import {many,database} from './db';
import {storedProfile} from './profiles';
import {assessmentContent,standardKind} from '../src/assessments';
import {zoneDateTime} from '../src/timezone';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;

type Event={at:number;type:'visit'|'assessment'|'medication'|'goal';title:string;detail:string};

// The patient card is a read model over the records a patient already has. Doctors' own notes never enter it.
export function cardRoutes(app:App){
 app.get('/api/patient/card',async c=>{
  const user=c.get('user');
  if(user.role!=='patient')return c.json({error:'Карточка пациента доступна пациенту'},403);
  const db=database(c.env),id=user.id;
  const [{data:profile},goals,meds,assessments,visits]=await Promise.all([
   storedProfile(db,id),
   many<{id:string;title:string;reason:string;created_at:number;closed_at:number|null}>(db,'SELECT id,title,reason,created_at,closed_at FROM goals WHERE patient_id=? ORDER BY created_at DESC LIMIT 100',id),
   many<{id:string;name:string;instructions:string;as_needed:number;start_date:string;end_date:string|null;created_at:number;doctor_name:string}>(db,'SELECT m.id,m.name,m.instructions,m.as_needed,m.start_date,m.end_date,m.created_at,u.name AS doctor_name FROM medications m JOIN users u ON u.id=m.doctor_id WHERE m.patient_id=? ORDER BY m.created_at DESC LIMIT 100',id),
   many<{id:string;kind:string;score:number|null;completed_at:number;definition:string|null;doctor_name:string}>(db,'SELECT a.id,a.kind,a.score,a.completed_at,a.definition,u.name AS doctor_name FROM assessments a JOIN users u ON u.id=a.doctor_id WHERE a.patient_id=? AND a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT 100',id),
   many<{id:string;status:string;reason:string;starts_at:number;minutes:number;patient_tz:string;doctor_name:string}>(db,'SELECT r.id,r.status,r.reason,r.patient_tz,s.starts_at,s.minutes,u.name AS doctor_name FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id JOIN users u ON u.id=r.doctor_id WHERE r.patient_id=? ORDER BY s.starts_at DESC LIMIT 200',id),
  ]);
  const assessmentTitle=(kind:string,definition:string|null)=>definition?JSON.parse(definition).title??'Авторский опрос':assessmentContent[standardKind(kind as Parameters<typeof standardKind>[0])].title;
  const history:Event[]=[
   ...visits.map(v=>({at:v.starts_at,type:'visit' as const,title:`Приём у врача: ${v.doctor_name}, ${zoneDateTime(v.starts_at,v.patient_tz)}`,detail:({confirmed:'подтверждён',pending:'ждёт ответа врача',declined:'врач не смог принять',cancelled:'отменён'} as Record<string,string>)[v.status]??v.status})),
   ...assessments.map(a=>({at:a.completed_at,type:'assessment' as const,title:assessmentTitle(a.kind,a.definition),detail:a.score===null?'Ответы сохранены':`Общий балл ${a.score}. Заполнил(а) по назначению: ${a.doctor_name}`})),
   ...meds.map(m=>({at:m.created_at,type:'medication' as const,title:`Назначен препарат: ${m.name}`,detail:`${m.doctor_name}${m.as_needed?', по необходимости':''}. С ${m.start_date}${m.end_date?` по ${m.end_date}`:''}`})),
   ...goals.flatMap(g=>[{at:g.created_at,type:'goal' as const,title:`Цель: ${g.title}`,detail:g.reason},...(g.closed_at?[{at:g.closed_at,type:'goal' as const,title:`Цель закрыта: ${g.title}`,detail:''}]:[])]),
  ].sort((a,b)=>b.at-a.at).slice(0,300);
  return c.json({
   patient:{name:user.name,birthDate:profile.birthDate??null,about:profile.about??''},
   history,
   medications:meds.map(m=>({id:m.id,name:m.name,instructions:m.instructions,asNeeded:!!m.as_needed,startDate:m.start_date,endDate:m.end_date,doctorName:m.doctor_name})),
   goals:goals.map(g=>({id:g.id,title:g.title,reason:g.reason,createdAt:g.created_at,closedAt:g.closed_at})),
   assessments:assessments.map(a=>({id:a.id,title:assessmentTitle(a.kind,a.definition),score:a.score,completedAt:a.completed_at,doctorName:a.doctor_name})),
   note:'Заметки врача в карточку не входят. Врач видит карточку только с вашего согласия.',
  });
 });
}
