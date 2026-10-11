import {expect,it} from 'vitest';
import {mkdtempSync,readdirSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {openDatabase} from '../server/sqlite';
it('backup creates a valid private copy, restore check leaves live data intact',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ryadom-backup-test-')),path=join(directory,'live.sqlite'),backups=join(directory,'backups');
 const db=openDatabase(path);
 try{
  await db.binding.prepare('INSERT INTO users(id,email,name,role,password,created_at) VALUES(?,?,?,?,?,?)').bind('fixture','fixture@example.com','Fixture','patient','not-a-real-password',0).run();
  const result=spawnSync(process.execPath,['scripts/backup.mjs','--once'],{encoding:'utf8',env:{...process.env,DATABASE_PATH:path,BACKUP_DIRECTORY:backups}});
  expect(result.status,result.stderr).toBe(0);const files=readdirSync(backups);expect(files).toHaveLength(1);
  const backup=join(backups,files[0]);expect(statSync(backup).mode&0o777).toBe(0o600);
  const restore=spawnSync(process.execPath,['scripts/check-backup.mjs',backup],{encoding:'utf8'});expect(restore.status,restore.stderr).toBe(0);expect(JSON.parse(restore.stdout).restoredCopy).toBe(true);
  expect(await db.binding.prepare('SELECT id FROM users WHERE id=?').bind('fixture').first()).toEqual({id:'fixture'});
  await db.binding.prepare('PRAGMA foreign_keys=OFF').run();
  await db.binding.prepare('INSERT INTO goals VALUES(?,?,?,?,?,NULL)').bind('invalid','missing-user','Invalid fixture','',0).run();
  const invalid=spawnSync(process.execPath,['scripts/backup.mjs','--once'],{encoding:'utf8',env:{...process.env,DATABASE_PATH:path,BACKUP_DIRECTORY:backups}});
  expect(invalid.status).not.toBe(0);expect(readdirSync(backups)).toEqual(files);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
