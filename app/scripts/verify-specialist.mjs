import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),email=args[args.indexOf('--email')+1];
if(!args.includes('--email')||!email||(!args.includes('--qualification-checked')&&!args.includes('--revoke'))){console.error('Usage: node scripts/verify-specialist.mjs --email doctor@example.org --qualification-checked | --revoke');process.exit(1);}
const db=new DatabaseSync(process.env.DATABASE_PATH||'data/ryadom.sqlite');
try{const user=db.prepare("SELECT id FROM users WHERE email=? AND role='doctor'").get(email.trim().toLowerCase());if(!user)throw new Error('Doctor account not found');db.prepare('UPDATE users SET specialist_verified_at=? WHERE id=?').run(args.includes('--revoke')?null:Date.now(),user.id);console.log(args.includes('--revoke')?'Specialist verification revoked':'Specialist verification recorded');}finally{db.close();}
