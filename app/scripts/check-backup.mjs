import {DatabaseSync} from 'node:sqlite';
import {copyFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/check-backup.mjs /path/to/backup.sqlite');
const directory=mkdtempSync(join(tmpdir(),'ryadom-restore-'));
let db;
try{
 copyFileSync(resolve(source),join(directory,'restored.sqlite'));
 db=new DatabaseSync(join(directory,'restored.sqlite'));
 const integrity=db.prepare('PRAGMA integrity_check').all();
 if(integrity.some(row=>Object.values(row)[0]!=='ok'))throw new Error('Backup integrity check failed');
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup foreign keys check failed');
 const tables=['users','sessions','checkins','practices','reports'];
 for(const table of tables)db.prepare(`SELECT count(*) AS count FROM ${table}`).get();
 db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; CREATE TABLE _restore_probe(value TEXT); INSERT INTO _restore_probe VALUES (\'ok\'); ROLLBACK;');
 if(db.prepare("SELECT name FROM sqlite_master WHERE name='_restore_probe'").get())throw new Error('Restore rollback failed');
 console.log(JSON.stringify({restoredCopy:true,integrity:'ok',foreignKeys:'ok',coreTablesReadable:true,writeTransactionRollback:true}));
}finally{db?.close();rmSync(directory,{recursive:true,force:true});}
