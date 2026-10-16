import {many,one,run} from './db';
import {settingsSchema,defaultSettings} from '../src/shared';
import {zoneDateTime} from '../src/timezone';
import {allowedPushEndpoint} from './notifications';
import type {createServices} from './jobs';
import type {Env} from './env';

const HOUR=3600000, HOLD_MS=24*HOUR;

// Any event that a person should see in their inbox goes through here. Keys are unique per event and person.
export async function queueNotice(db:D1Database,key:string,userId:string,body:string,url='/#/today',now=Date.now()){
 await run(db,'INSERT OR IGNORE INTO notices (key,user_id,body,url,created_at) VALUES (?,?,?,?,?)',key,userId,body,url,now);
}

// Delivers what is queued right away, after a change. The minute job stays as the retry path.
export async function sendNow(db:D1Database,env:Pick<Env,'MAIL'|'PUSH_SEND'>){
 try{await deliverQueued(db,{publicKey:'',mail:env.MAIL,push:env.PUSH_SEND??(async()=>{})} as unknown as Parameters<typeof deliverQueued>[1],Date.now());}
 catch{console.error('Notice delivery failed');}
}
export type VisitEvent='requested'|'confirmed'|'declined'|'cancelled_by_doctor'|'cancelled_by_patient'|'expired'|'remind24'|'remind1';

// Each visit event produces a message for one or both sides. Texts carry no diagnosis, no reason and no patient name.
export async function queueVisitEvent(db:D1Database,requestId:string,event:VisitEvent,now=Date.now()){
 const row=await one<{patient_id:string;doctor_id:string;patient_tz:string;clinic_tz:string;starts_at:number}>(db,'SELECT r.patient_id,r.doctor_id,r.patient_tz,s.tz AS clinic_tz,s.starts_at FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id WHERE r.id=?',requestId);
 if(!row)return;
 // The patient reads the visit in their own zone, the doctor in the clinic zone the slot was entered in.
 const whenPatient=zoneDateTime(row.starts_at,row.patient_tz),whenDoctor=zoneDateTime(row.starts_at,row.clinic_tz);
 const messages:Partial<Record<VisitEvent,{to:'patient'|'doctor'|'both';patient?:string;doctor?:string;url?:string}>>={
  requested:{to:'doctor',doctor:'Новая заявка на приём. Ответьте в расписании.',url:'/#/schedule'},
  confirmed:{to:'patient',patient:`Врач подтвердил приём: ${whenPatient} по времени клиники.`,url:'/#/doctors'},
  declined:{to:'patient',patient:`Врач не смог принять заявку на ${whenPatient}. Выберите другое время.`,url:'/#/doctors'},
  cancelled_by_doctor:{to:'patient',patient:`Врач отменил приём: ${whenPatient}.`,url:'/#/doctors'},
  cancelled_by_patient:{to:'doctor',doctor:`Пациент отменил приём: ${whenDoctor}.`,url:'/#/schedule'},
  expired:{to:'patient',patient:`Заявка на ${whenPatient} истекла: врач не ответил за 24 часа. Выберите другое время.`,url:'/#/doctors'},
  remind24:{to:'both',patient:`Напоминание: приём ${whenPatient} по времени клиники.`,doctor:`Напоминание: приём ${whenDoctor}.`,url:'/#/schedule'},
  remind1:{to:'both',patient:`Через час приём: ${whenPatient} по времени клиники.`,doctor:`Через час приём: ${whenDoctor}.`,url:'/#/schedule'},
 };
 const m=messages[event];if(!m)return;
 const recipients:{userId:string;body:string;url:string;who:string}[]=[];
 if(m.to!=='doctor'&&m.patient)recipients.push({userId:row.patient_id,body:m.patient,url:m.url??'/#/today',who:'patient'});
 if(m.to!=='patient'&&m.doctor)recipients.push({userId:row.doctor_id,body:m.doctor,url:m.url??'/#/schedule',who:'doctor'});
 for(const r of recipients)await run(db,'INSERT OR IGNORE INTO notices (key,user_id,body,url,created_at) VALUES (?,?,?,?,?)',`visit:${requestId}:${event}:${r.who}`,r.userId,r.body,r.url,now);
}

// Pending requests expire after 24 hours; confirmed visits get reminders at 24 hours and at one hour.
export async function sweepVisits(db:D1Database,now=Date.now()){
 const stale=await many<{id:string}>(db,"SELECT id FROM appointment_requests WHERE status='pending' AND created_at<?",now-HOLD_MS);
 for(const r of stale){
  const done=await run(db,"UPDATE appointment_requests SET status='cancelled',decided_at=? WHERE id=? AND status='pending'",now,r.id);
  if(done.meta.changes)await queueVisitEvent(db,r.id,'expired',now);
 }
 const soon=await many<{id:string;starts_at:number}>(db,"SELECT r.id,s.starts_at FROM appointment_requests r JOIN doctor_slots s ON s.id=r.slot_id WHERE r.status='confirmed' AND s.starts_at>? AND s.starts_at<=?",now,now+24*HOUR);
 for(const v of soon)await queueVisitEvent(db,v.id,v.starts_at-now<=HOUR?'remind1':'remind24',now);
}

// Sends queued notices. Channels follow the user's visit setting: push to subscribed browsers, email to verified addresses.
export async function deliverQueued(db:D1Database,services:ReturnType<typeof createServices>,now=Date.now()){
 const queued=await many<{key:string;user_id:string;body:string;url:string}>(db,'SELECT key,user_id,body,url FROM notices WHERE sent_at IS NULL ORDER BY created_at LIMIT 200');
 for(const n of queued){
  const claimed=await run(db,'UPDATE notices SET sent_at=? WHERE key=? AND sent_at IS NULL',now,n.key);
  if(!claimed.meta.changes)continue;
  const settingsRow=await one<{data:string}>(db,'SELECT data FROM settings WHERE user_id=?',n.user_id);
  const settings=settingsSchema.parse(settingsRow?JSON.parse(settingsRow.data):defaultSettings);
  const isVisit=n.key.startsWith('visit:');
  if(isVisit&&!settings.visitNotifications)continue;
  const subscriptions=await many<{endpoint:string;data:string}>(db,'SELECT endpoint,data FROM push_subscriptions WHERE user_id=?',n.user_id);
  for(const sub of subscriptions){
   if(!allowedPushEndpoint(sub.endpoint))continue;
   try{await services.push(JSON.parse(sub.data),n.body,n.url);}
   catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await run(db,'DELETE FROM push_subscriptions WHERE endpoint=?',sub.endpoint);}
  }
  const user=await one<{email:string;email_verified_at:string|null}>(db,'SELECT email,email_verified_at FROM users WHERE id=?',n.user_id);
  if(user?.email_verified_at&&services.mail){try{await services.mail.send({to:user.email,subject:'Рядом: новое уведомление',text:`У вас новое уведомление в Рядом. Откройте приложение, чтобы его прочитать. Письмо не содержит сведений о приёме или здоровье.\n${process.env.PUBLIC_ORIGIN||'https://doktor-ryadom.duckdns.org'}/`});}catch{console.error('Visit email failed');}}
 }
}
