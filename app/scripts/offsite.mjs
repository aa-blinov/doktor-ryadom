// Off-site copies of the local daily backups. Each file is encrypted here (AES-256-GCM) before it leaves the server,
// so the bucket provider only ever holds ciphertext. Runs in its own container with network access; the backup
// container itself stays offline. Usage: node scripts/offsite.mjs            (loop, hourly)
//                                        node scripts/offsite.mjs decrypt <in.enc> <out.sqlite>
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const MAGIC=Buffer.from('RYB1'), PREFIX='ryadom/', NAME=/^ryadom-.+\.sqlite$/, REMOTE=/^ryadom\/ryadom-.+\.sqlite\.enc$/;
// Backups are named by time (ryadom-2026-10-16T02-59-36.963Z.sqlite), so the day is the first ten characters after the prefix.
const dayOf=(key)=>key.slice(PREFIX.length+7,PREFIX.length+17);

export function encryptBackup(plain,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([cipher.update(plain),cipher.final()]);
 return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),body]);
}
export function decryptBackup(blob,key){
 if(!blob.subarray(0,4).equals(MAGIC))throw new Error('Not an encrypted backup');
 const decipher=createDecipheriv('aes-256-gcm',key,blob.subarray(4,16));
 decipher.setAuthTag(blob.subarray(16,32));
 return Buffer.concat([decipher.update(blob.subarray(32)),decipher.final()]);
}

const sha256=(d)=>createHash('sha256').update(d).digest('hex');
const hmac=(k,d,enc)=>createHmac('sha256',k).update(d).digest(enc);

// AWS Signature Version 4 for S3 (path-style URLs, as Backblaze B2 and most S3-compatible stores expect).
export function signRequest({method,url,region,accessKey,secretKey,body=Buffer.alloc(0),now=new Date()}){
 const amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,''),date=amzDate.slice(0,8);
 const u=new URL(url),payloadHash=sha256(body);
 const headers={'x-amz-content-sha256':payloadHash,'x-amz-date':amzDate,host:u.host};
 const names=Object.keys(headers).sort();
 const canonicalHeaders=names.map(n=>`${n}:${headers[n]}\n`).join('');
 const signedHeaders=names.join(';');
 const query=[...u.searchParams.entries()].sort(([a],[b])=>(a<b?-1:a>b?1:0)).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
 const canonical=[method,u.pathname,query,canonicalHeaders,signedHeaders,payloadHash].join('\n');
 const scope=`${date}/${region}/s3/aws4_request`;
 const toSign=['AWS4-HMAC-SHA256',amzDate,scope,sha256(canonical)].join('\n');
 const kSigning=hmac(hmac(hmac(hmac('AWS4'+secretKey,date),region),'s3'),'aws4_request');
 const signature=hmac(kSigning,toSign,'hex');
 return {'x-amz-content-sha256':payloadHash,'x-amz-date':amzDate,authorization:`AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`};
}

export function s3Client(config){
 const base=`${config.endpoint.replace(/\/$/,'')}/${config.bucket}`;
 return async function request(method,key='',{body=Buffer.alloc(0),query={}}={}){
  const url=new URL(`${base}/${key?key.split('/').map(encodeURIComponent).join('/'):''}`);
  for(const [k,v] of Object.entries(query))url.searchParams.set(k,v);
  const headers=signRequest({method,url:url.toString(),region:config.region,accessKey:config.keyId,secretKey:config.secretKey,body});
  const res=await fetch(url,{method,headers,body:body.length?body:undefined});
  if(!res.ok)throw new Error(`S3 ${method} ${key||'bucket'} failed: HTTP ${res.status}`);
  return res;
 };
}

async function listKeys(request){
 const keys=[];let token;
 do{
  const query={'list-type':'2',prefix:PREFIX,...(token?{'continuation-token':token}:{})};
  const xml=await (await request('GET','',{query})).text();
  keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]));
  token=xml.includes('<IsTruncated>true</IsTruncated>')?xml.match(/<NextContinuationToken>([^<]+)</)?.[1]:undefined;
 }while(token);
 return keys.filter(k=>REMOTE.test(k)).sort();
}

// One pass: upload what is missing, then keep the newest copy of each of the last `retainDays` days.
export async function syncOnce({request,directory,key,retainDays=14,log=console.log}){
 const remote=await listKeys(request),present=new Set(remote);
 for(const name of readdirSync(directory).filter(n=>NAME.test(n)).sort()){
  const objectKey=`${PREFIX}${name}.enc`;
  if(present.has(objectKey))continue;
  const blob=encryptBackup(readFileSync(join(directory,name)),key);
  await request('PUT',objectKey,{body:blob});
  log(`uploaded ${objectKey} (${blob.length} bytes)`);
 }
 const all=await listKeys(request);
 const newestPerDay=new Map();
 for(const k of all)newestPerDay.set(dayOf(k),k);
 const keepDays=[...newestPerDay.keys()].sort().slice(-retainDays);
 const keep=new Set(keepDays.map(d=>newestPerDay.get(d)));
 for(const old of all.filter(k=>!keep.has(k))){
  await request('DELETE',old);
  log(`removed old copy ${old}`);
 }
 return {days:keepDays.length};
}

function configFromEnv(env){
 const need=['S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_KEY_ID','S3_SECRET_KEY','BACKUP_ENCRYPTION_KEY'].filter(n=>!env[n]);
 if(need.length)throw new Error(`Off-site backup is not configured: missing ${need.join(', ')}`);
 const key=Buffer.from(env.BACKUP_ENCRYPTION_KEY,'base64');
 if(key.length!==32)throw new Error('BACKUP_ENCRYPTION_KEY must be 32 random bytes, base64 encoded');
 return {endpoint:env.S3_ENDPOINT,region:env.S3_REGION,bucket:env.S3_BUCKET,keyId:env.S3_KEY_ID,secretKey:env.S3_SECRET_KEY,encryptionKey:key};
}

const isMain=process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href;
if(isMain&&process.argv[2]==='decrypt'){
 const [,,,input,output]=process.argv;
 writeFileSync(output,decryptBackup(readFileSync(input),Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64')));
 console.log(`decrypted to ${output}`);
}else if(isMain){
 const directory=process.env.BACKUP_DIRECTORY||'/backups';
 const loop=async()=>{
  try{
   const config=configFromEnv(process.env);
   await syncOnce({request:s3Client(config),directory,key:config.encryptionKey});
  }catch(e){console.error('Off-site backup failed:',e instanceof Error?e.message:'unknown error');}
 };
 void loop();
 setInterval(()=>void loop(),60*60*1000);
}
