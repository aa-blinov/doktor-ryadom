import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../server/sqlite';

const sql='CREATE TABLE example (id TEXT PRIMARY KEY);';

function scratch(){
 const directory=mkdtempSync(join(tmpdir(),'ryadom-checksum-'));
 const migrations=join(directory,'drizzle');
 const path=join(directory,'database.sqlite');
 mkdirSync(migrations);
 writeFileSync(join(migrations,'0001_example.sql'),sql);
 return {directory,migrations,path};
}
// The checksum the runner stored before it learned to ignore the whitespace.
const rawHash=(content:string)=>createHash('sha256').update(content).digest('hex');
const stored=(path:string,name:string)=>new DatabaseSync(path,{readOnly:true}).prepare('SELECT checksum FROM _ryadom_migrations WHERE name=?').get(name) as {checksum:string};

it('a migration that only gained a trailing newline still opens',()=>{
 const {directory,migrations,path}=scratch();
 try{
  openDatabase(path,migrations).close();
  // Put the checksum back the way the old runner wrote it: the hash of the
  // file as it was, without the newline it has now.
  const raw=new DatabaseSync(path);
  raw.prepare('UPDATE _ryadom_migrations SET checksum=? WHERE name=?').run(rawHash(sql),'0001_example.sql');
  raw.close();
  writeFileSync(join(migrations,'0001_example.sql'),sql+'\n');
  expect(()=>openDatabase(path,migrations)).not.toThrow();
 }finally{rmSync(directory,{recursive:true,force:true});}
});

it('the row is brought to the canonical checksum, so the check works both ways',()=>{
 const {directory,migrations,path}=scratch();
 try{
  openDatabase(path,migrations).close();
  const raw=new DatabaseSync(path);
  raw.prepare('UPDATE _ryadom_migrations SET checksum=? WHERE name=?').run(rawHash(sql+'\n'),'0001_example.sql');
  raw.close();
  // The file still ends with a newline, so the row is the old one and the
  // runner rewrites it.
  writeFileSync(join(migrations,'0001_example.sql'),sql+'\n');
  openDatabase(path,migrations).close();
  expect(stored(path,'0001_example.sql').checksum).toBe(rawHash(sql));
  // Now the newline goes away, and the migration is still the same one.
  writeFileSync(join(migrations,'0001_example.sql'),sql);
  expect(()=>openDatabase(path,migrations)).not.toThrow();
 }finally{rmSync(directory,{recursive:true,force:true});}
});

it('a migration whose SQL changed still refuses to open',()=>{
 const {directory,migrations,path}=scratch();
 try{
  openDatabase(path,migrations).close();
  writeFileSync(join(migrations,'0001_example.sql'),'CREATE TABLE example (id TEXT PRIMARY KEY, name TEXT);');
  expect(()=>openDatabase(path,migrations)).toThrow(/Applied migration changed/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
