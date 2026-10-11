import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
type Value = string | number | null;
export function openDatabase(path:string, migrations=resolve('drizzle')) {
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 db.exec('CREATE TABLE IF NOT EXISTS _ryadom_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
 try{
 for(const name of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync(resolve(migrations,name),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
  const previous=db.prepare('SELECT checksum FROM _ryadom_migrations WHERE name=?').get(name);
  if(previous){if(previous.checksum!==checksum)throw new Error(`Applied migration changed: ${name}`);continue;}
  db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.prepare('INSERT INTO _ryadom_migrations VALUES (?,?)').run(name,checksum);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 }catch(e){db.close();throw e;}
 class Prepared{
  constructor(readonly sql:string,readonly values:Value[]=[]){}
  bind(...values:Value[]){return new Prepared(this.sql,values);}
  async first<T>(column?:string){const row=db.prepare(this.sql).get(...this.values);return (column?row?.[column]:row??null) as T;}
  async all<T>(){const results=db.prepare(this.sql).all(...this.values);return {results:results as T[],success:true,meta:{changes:0}};}
  execute(){const result=db.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
  async run(){return this.execute();}
 }
 const binding={prepare:(sql:string)=>new Prepared(sql),batch:async(statements:Prepared[])=>{
  db.exec('BEGIN IMMEDIATE');try{const results=statements.map(statement=>statement.execute());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}
 }} as unknown as D1Database;
 return {binding,close:()=>db.close()};
}
