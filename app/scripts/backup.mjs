import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,rmSync,chmodSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const source=process.env.DATABASE_PATH??'/data/ryadom.sqlite';
const directory=process.env.BACKUP_DIRECTORY??'/backups';
mkdirSync(directory,{recursive:true,mode:0o700});
chmodSync(directory,0o700);
function backup(){
 const stamp=new Date().toISOString().replaceAll(':','-');
 const target=join(directory,`ryadom-${stamp}.sqlite`);
 const partial=target+'.partial';
 try{
  const db=new DatabaseSync(source,{readOnly:true});
  try{db.exec(`VACUUM INTO '${partial.replaceAll("'","''")}'`);}finally{db.close();}
  chmodSync(partial,0o600);
  const restored=new DatabaseSync(partial,{readOnly:true});
  try{
   if(restored.prepare('PRAGMA integrity_check').all().some(r=>Object.values(r)[0]!=='ok')||restored.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup validation failed');
  }finally{restored.close();}
  renameSync(partial,target);
 }catch(error){rmSync(partial,{force:true});throw error;}
 const names=readdirSync(directory).filter(n=>/^ryadom-\d{4}-\d{2}-\d{2}T[\d.-]+Z\.sqlite$/.test(n)).sort().reverse();
 for(const name of names.slice(14))rmSync(join(directory,name));
 console.log(JSON.stringify({backupAt:stamp,integrity:'ok',retained:Math.min(names.length,14)}));
}
if(process.argv.includes('--once'))backup();
else while(true){
 let wait=24*60*60*1000;
 try{backup();}catch(error){console.error('Backup failed:',error.name);wait=30*60*1000;}
 await delay(wait);
}
