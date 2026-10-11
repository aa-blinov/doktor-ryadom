import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync,writeFileSync,unlinkSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import {many,one,run} from './db';
import {settingsSchema,defaultPlan,defaultSettings,type User,type Settings} from '../src/shared';
import type {Env} from './env';
import {allowedPushEndpoint} from './notifications';
export function createServices(path:string,origin:string){
 const directory=dirname(path),keyPath=join(directory,'vapid.json');
 mkdirSync(directory,{recursive:true});
 if(!readdirSync(directory).includes('vapid.json'))writeFileSync(keyPath,JSON.stringify(webpush.generateVAPIDKeys()),{mode:0o600,flag:'wx'});
 const keys=JSON.parse(readFileSync(keyPath,'utf8')) as {publicKey:string;privateKey:string};
 const smtp=process.env.SMTP_HOST&&process.env.MAIL_FROM?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='false',requireTLS:process.env.SMTP_SECURE==='false',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000}):null;
 const mail:Env['MAIL']=smtp?{send:async m=>{await smtp.sendMail({...m,from:process.env.MAIL_FROM});}}:process.env.RESEND_API_KEY&&process.env.MAIL_FROM?{send:async m=>{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({...m,from:process.env.MAIL_FROM}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Mail delivery failed');}}:undefined;
 return {publicKey:keys.publicKey,mail,push:async(subscription:webpush.PushSubscription,body:string,url='/#/today')=>{await webpush.sendNotification(subscription,JSON.stringify({title:'Рядом',body,url}),{vapidDetails:{subject:process.env.VAPID_SUBJECT||origin,publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:3600,timeout:10000});}};
}
export function localClock(now:number,timezone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {date:`${get('year')}-${get('month')}-${get('day')}`,minute:Number(get('hour'))*60+Number(get('minute'))};
}
export function reminderDue(now:number,settings:Settings,frequency:string,lastDate:string|null){
 if(settings.paused)return false;const local=localClock(now,settings.timezone),target=Number(settings.reminderTime.slice(0,2))*60+Number(settings.reminderTime.slice(3));
 if(local.minute<target||local.minute>=target+30||lastDate===local.date)return false;
 const day=new Date(local.date+'T12:00:00Z').getUTCDay();if(frequency==='three'&&![1,3,5].includes(day))return false;
 return frequency!=='weekly'||!lastDate||Date.parse(local.date)-Date.parse(lastDate)>=7*86400000;
}
export async function deliverNotifications(db:D1Database,services:ReturnType<typeof createServices>,now=Date.now()){
 // SOS goes to every linked doctor, push and email, regardless of patient reminder settings.
 const sos=await many<{id:string;doctor_id:string;email:string;email_verified_at:string|null}>(db,'SELECT s.id,l.doctor_id,d.email,d.email_verified_at FROM sos_events s JOIN links l ON l.patient_id=s.patient_id AND l.revoked_at IS NULL JOIN users d ON d.id=l.doctor_id WHERE s.notified_at IS NULL');
 const sosEvents=[...new Set(sos.map(row=>row.id))];
 for(const eventId of sosEvents){
  for(const row of sos.filter(item=>item.id===eventId)){
   const subscriptions=await many<{endpoint:string;data:string}>(db,'SELECT endpoint,data FROM push_subscriptions WHERE user_id=?',row.doctor_id);
   for(const sub of subscriptions){try{await services.push(JSON.parse(sub.data),'Пациенту сейчас плохо. Откройте дашборд.','/#/patients');}catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await run(db,'DELETE FROM push_subscriptions WHERE endpoint=?',sub.endpoint);}}
   if(row.email_verified_at&&services.mail){try{await services.mail.send({to:row.email,subject:'Рядом: сигнал от пациента',text:`Пациенту сейчас плохо. Откройте дашборд, чтобы увидеть список и отреагировать.\n${process.env.PUBLIC_ORIGIN||'https://doktor-ryadom.duckdns.org'}/`});}catch{console.error('SOS email failed');}}
  }
  await run(db,'UPDATE sos_events SET notified_at=? WHERE id=?',now,eventId);
 }
 const users=await many<User&{settings:string|null;plan:string|null;last_date:string|null}>(db,'SELECT u.*,s.data AS settings,p.data AS plan,(SELECT max(date) FROM checkins WHERE patient_id=u.id) AS last_date FROM users u LEFT JOIN settings s ON s.user_id=u.id LEFT JOIN plans p ON p.patient_id=u.id WHERE EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id=u.id) OR u.email_verified_at IS NOT NULL');
 for(const user of users){
  const settings=settingsSchema.parse(user.settings?JSON.parse(user.settings):defaultSettings),local=localClock(now,settings.timezone);
  let kind='reminder',body='Можно добавить запись о сегодняшнем дне.';
  if(user.role==='doctor'){
   if(settings.paused||!settings.reportNotifications||!reminderDue(now,settings,'daily',null))continue;
   const count=await one<{count:number}>(db,'SELECT count(*) AS count FROM reports r JOIN links l ON l.patient_id=r.patient_id AND l.doctor_id=r.doctor_id AND l.revoked_at IS NULL WHERE r.doctor_id=? AND r.reviewed_at IS NULL',user.id);
   const assessments=await one<{count:number}>(db,'SELECT count(*) AS count FROM assessments a JOIN links l ON l.patient_id=a.patient_id AND l.doctor_id=a.doctor_id AND l.revoked_at IS NULL WHERE a.doctor_id=? AND a.completed_at IS NOT NULL AND a.reviewed_at IS NULL',user.id);
   const feedback=await one<{count:number}>(db,'SELECT EXISTS(SELECT 1 FROM practices p JOIN links l ON l.patient_id=p.patient_id AND l.revoked_at IS NULL WHERE l.doctor_id=? AND (p.reviewed_at IS NULL OR p.reviewer_id IS NULL OR p.reviewer_id!=l.doctor_id)) OR EXISTS(SELECT 1 FROM goal_logs g JOIN links l ON l.patient_id=g.patient_id AND l.revoked_at IS NULL WHERE l.doctor_id=? AND (g.reviewed_at IS NULL OR g.reviewer_id IS NULL OR g.reviewer_id!=l.doctor_id)) AS count',user.id,user.id);
   if(!(count?.count||assessments?.count||feedback?.count))continue;kind='reports';body='В кабинете есть новые материалы для просмотра.';
  }else if(!reminderDue(now,settings,user.plan?JSON.parse(user.plan).frequency:defaultPlan.frequency,user.last_date))continue;
  // Claim before delivery; release on total failure. No duplicate sends on overlapping runs.
  const key=`${user.id}:${kind}:${local.date}`;
  const claimed=await run(db,'INSERT OR IGNORE INTO deliveries VALUES (?,?,?,?)',key,user.id,kind,now);if(!claimed.meta.changes)continue;
  let delivered=false;
  if(settings.reminderPush){const subscriptions=await many<{endpoint:string;data:string}>(db,'SELECT endpoint,data FROM push_subscriptions WHERE user_id=?',user.id);
   for(const sub of subscriptions){if(!allowedPushEndpoint(sub.endpoint))continue;try{await services.push(JSON.parse(sub.data),body,user.role==='doctor'?'/#/patients':'/#/today');delivered=true;}catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await run(db,'DELETE FROM push_subscriptions WHERE endpoint=?',sub.endpoint);}}
  }
  if(settings.reminderEmail&&user.email_verified_at&&services.mail){try{await services.mail.send({to:user.email,subject:'Рядом: напоминание',text:`${body}\n${process.env.PUBLIC_ORIGIN||'https://doktor-ryadom.duckdns.org'}/\n\nИзменить расписание или отключить напоминания можно в настройках.`});delivered=true;}catch{console.error('Reminder email failed');}}
  if(!delivered)await run(db,'DELETE FROM deliveries WHERE key=?',key);
 }
 await run(db,'DELETE FROM account_tokens WHERE expires<?',now);await run(db,'DELETE FROM sessions WHERE expires<?',now);await run(db,'DELETE FROM deliveries WHERE sent_at<?',now-35*86400000);await run(db,'DELETE FROM auth_attempts WHERE window_start<?',now-86400000);
}
export async function dailyBackup(path:string,now=Date.now()){
 const directory=join(dirname(path),'backups');mkdirSync(directory,{recursive:true});
 const date=new Date(now).toISOString().slice(0,10),target=join(directory,`ryadom-${date}.sqlite`);
 if(!readdirSync(directory).includes(`ryadom-${date}.sqlite`)){
  const source=new DatabaseSync(path,{readOnly:true}),partial=target+'.partial';
  try{await backup(source,partial);const check=new DatabaseSync(partial);try{check.exec('PRAGMA journal_mode=DELETE');const row=check.prepare('PRAGMA integrity_check').get();if(row?.integrity_check!=='ok')throw new Error('Backup integrity failed');}finally{check.close();}const {renameSync,chmodSync}=await import('node:fs');chmodSync(partial,0o600);renameSync(partial,target);}finally{source.close();}
 }
 for(const name of readdirSync(directory))if(/^ryadom-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)&&statSync(join(directory,name)).mtimeMs<now-7*86400000)unlinkSync(join(directory,name));
}
