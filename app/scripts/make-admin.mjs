import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),email=args[args.indexOf('--email')+1];
if(!args.includes('--email')||!email){console.error('Usage: node scripts/make-admin.mjs --email admin@example.org [--revoke]');process.exit(1);}
const db=new DatabaseSync(process.env.DATABASE_PATH||'data/ryadom.sqlite');
try{
 const user=db.prepare('SELECT id,role FROM users WHERE email=?').get(email.trim().toLowerCase());
 if(!user)throw new Error('Account not found. Register first, then run this script.');
 if(args.includes('--revoke')){
  if(user.role!=='admin')throw new Error('Account is not an administrator.');
  db.prepare("UPDATE users SET role='doctor' WHERE id=?").run(user.id);
  console.log('Administrator role removed; the account is now a doctor account.');
 }else{
  if(user.role==='patient')throw new Error('Patient accounts cannot become administrators.');
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  console.log('Administrator role granted.');
 }
}catch(error){console.error(error instanceof Error?error.message:'Unknown error');process.exitCode=1;}
finally{db.close();}
