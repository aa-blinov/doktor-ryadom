import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function createDatabase(path=':memory:'){
 const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
 class Prepared{
  values:(string|number|null)[]=[];
  constructor(public sql:string){}
  bind(...values:(string|number|null)[]){const p=new Prepared(this.sql);p.values=values;return p;}
  async first<T>(column?:string){const result=db.prepare(this.sql).get(...this.values);return (column?result?.[column]:result||null) as T;}
  async all<T>(){const results=db.prepare(this.sql).all(...this.values);return {results:results as T[],success:true,meta:{changes:0}};}
  async run(){const result=db.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
 }
 return {binding:{prepare:(sql:string)=>new Prepared(sql),batch:async(statements:Prepared[])=>{db.exec('BEGIN');try{const result=[];for(const statement of statements){const r=db.prepare(statement.sql).run(...statement.values);result.push({success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}});}db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}} as unknown as D1Database,close:()=>db.close()};
}
