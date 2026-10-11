import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/sqlite';
import app from '../server/index';
it('Docker database retains sessions and records after restart and rolls back failed batches',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ryadom-sqlite-'));const path=join(directory,'database.sqlite');
 const oldMigrations=join(directory,'old-migrations');mkdirSync(oldMigrations);copyFileSync('drizzle/0000_initial_schema.sql',join(oldMigrations,'0000_initial_schema.sql'));
 let database=openDatabase(path,oldMigrations);
 try{
 const origin='https://doktor-ryadom.duckdns.org';
 const registered=await app.request(origin+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'persistent@example.com',name:'Тестовый пациент',password:'test-password-very-long',role:'patient',consent:true})},{DB:database.binding,ASSETS:{} as Fetcher});
 expect(registered.status).toBe(201);expect(registered.headers.get('set-cookie')).toContain('Secure');const cookie=registered.headers.get('set-cookie')!.split(';')[0];
 const identity=await registered.json() as {user:{id:string}};
 await expect(database.binding.batch([
 database.binding.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind('rollback-record',identity.user.id,'test',identity.user.id,Date.now()),
 database.binding.prepare('INSERT INTO missing_table VALUES (?)').bind('fail'),
 ])).rejects.toThrow();
 expect(await database.binding.prepare('SELECT id FROM audit WHERE id=?').bind('rollback-record').first()).toBeNull();
 database.close();database=openDatabase(path);
 const session=await app.request(origin+'/api/me',{headers:{Cookie:cookie}},{DB:database.binding,ASSETS:{} as Fetcher});expect(session.status).toBe(200);
 expect((await session.json() as {user:{id:string}}).user.id).toBe(identity.user.id);
 expect((await database.binding.prepare('SELECT count(*) AS count FROM _ryadom_migrations').first<{count:number}>())?.count).toBeGreaterThanOrEqual(13);
 }finally{database.close();rmSync(directory,{recursive:true,force:true});}
});
