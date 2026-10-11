import {expect,it} from 'vitest';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDatabase} from './db-adapter';
import {openDatabase} from '../server/sqlite';
import {dailyBackup,deliverNotifications,reminderDue,localClock,type createServices} from '../server/jobs';
import {defaultSettings} from '../src/shared';
it('reminders honor timezone, pause, frequency and existing entries',()=>{
 const now=Date.parse('2026-10-07T17:05:00Z'),settings={...defaultSettings,timezone:'Europe/Moscow',reminderTime:'20:00'};
 expect(localClock(now,settings.timezone)).toEqual({date:'2026-10-07',minute:1205});
 expect(reminderDue(now,settings,'daily',null)).toBe(true);expect(reminderDue(now,{...settings,paused:true},'daily',null)).toBe(false);
 expect(reminderDue(now,settings,'daily','2026-10-07')).toBe(false);expect(reminderDue(now,settings,'weekly','2026-10-03')).toBe(false);
 expect(reminderDue(Date.parse('2026-10-08T17:05:00Z'),settings,'three',null)).toBe(false);
});
it('background reminders deduplicate and remove expired push endpoints without exposing health data',async()=>{
 const db=createDatabase(),sent:string[]=[],now=Date.parse('2026-10-07T17:05:00Z');
 try{
 await db.binding.prepare('INSERT INTO users (id,email,name,role,password,created_at) VALUES (?,?,?,?,?,?)').bind('synthetic-user','synthetic@example.com','Synthetic','patient','unused',now).run();
 await db.binding.prepare('INSERT INTO settings VALUES (?,?)').bind('synthetic-user',JSON.stringify({...defaultSettings,timezone:'Europe/Moscow',reminderPush:true})).run();
 await db.binding.prepare('INSERT INTO push_subscriptions VALUES (?,?,?,?)').bind('synthetic-endpoint','synthetic-user',JSON.stringify({endpoint:'synthetic-endpoint'}),now).run();
 const services={push:async(_:unknown,body:string)=>{sent.push(body);},mail:undefined,publicKey:'test'} as unknown as ReturnType<typeof createServices>;
 await deliverNotifications(db.binding,services,now);await deliverNotifications(db.binding,services,now);expect(sent).toEqual(['Можно добавить запись о сегодняшнем дне.']);
 await db.binding.prepare('DELETE FROM deliveries').run();services.push=async()=>{throw Object.assign(new Error('expired'),{statusCode:410});};
 await deliverNotifications(db.binding,services,now);expect(await db.binding.prepare('SELECT * FROM push_subscriptions').first()).toBeNull();expect(await db.binding.prepare('SELECT * FROM deliveries').first()).toBeNull();
 }finally{db.close();}
});
it('daily SQLite backup restores real data and validates integrity',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ryadom-backup-')),path=join(directory,'db.sqlite'),db=openDatabase(path);
 try{await db.binding.prepare('INSERT INTO users (id,email,name,role,password,created_at) VALUES (?,?,?,?,?,?)').bind('backup-user','backup@example.com','Synthetic','patient','unused',Date.now()).run();await dailyBackup(path);await dailyBackup(path);const files=readdirSync(join(directory,'backups'));expect(files).toHaveLength(1);const restored=new DatabaseSync(join(directory,'backups',files[0]),{readOnly:true});try{expect(restored.prepare('SELECT name FROM users WHERE id=?').get('backup-user')?.name).toBe('Synthetic');expect(restored.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');}finally{restored.close();}}finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
it('clinician digest includes goal feedback, deduplicates and stops after review or revoked access',async()=>{
 const db=createDatabase(),sent:string[]=[],now=Date.parse('2026-10-07T17:05:00Z');
 try{
  for(const [id,role] of [['doctor','doctor'],['patient','patient']])await db.binding.prepare('INSERT INTO users(id,email,name,role,password,created_at) VALUES(?,?,?,?,?,?)').bind(id,id+'@example.com',id,role,'unused',now).run();
  await db.binding.prepare('INSERT INTO links VALUES(?,?,?,NULL)').bind('patient','doctor',now).run();
  await db.binding.prepare('INSERT INTO settings VALUES(?,?)').bind('doctor',JSON.stringify({...defaultSettings,timezone:'Europe/Moscow',reminderPush:true,reportNotifications:true})).run();
  await db.binding.prepare('INSERT INTO push_subscriptions VALUES(?,?,?,?)').bind('endpoint','doctor',JSON.stringify({endpoint:'endpoint'}),now).run();
  await db.binding.prepare('INSERT INTO goals VALUES(?,?,?,?,?,NULL)').bind('goal','patient','Вернуться к прогулкам','',now).run();
  await db.binding.prepare('INSERT INTO goal_logs(id,patient_id,goal_id,status,note,created_at) VALUES(?,?,?,?,?,?)').bind('log','patient','goal','step','Не должно попасть в уведомление',now).run();
  const services={push:async(_:unknown,body:string)=>{sent.push(body);},mail:undefined,publicKey:'test'} as unknown as ReturnType<typeof createServices>;
  await deliverNotifications(db.binding,services,now);await deliverNotifications(db.binding,services,now);expect(sent).toEqual(['В кабинете есть новые материалы для просмотра.']);
  await db.binding.prepare('DELETE FROM deliveries').run();await db.binding.prepare('UPDATE goal_logs SET reviewed_at=?,reviewer_id=?').bind(now,'doctor').run();
  await deliverNotifications(db.binding,services,now);expect(sent).toHaveLength(1);
  await db.binding.prepare('UPDATE goal_logs SET reviewed_at=NULL').run();await db.binding.prepare('UPDATE links SET revoked_at=?').bind(now).run();await deliverNotifications(db.binding,services,now);expect(sent).toHaveLength(1);
 }finally{db.close();}
});
