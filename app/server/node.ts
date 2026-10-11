import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import app from './index';
import { openDatabase } from './sqlite';
import {createServices,deliverNotifications,dailyBackup} from './jobs';
const port=Number(process.env.PORT||3000);
const origin=new URL(process.env.PUBLIC_ORIGIN||'http://localhost:3000').origin;
const client=resolve(process.env.CLIENT_DIR||'dist/client');
const databasePath=process.env.DATABASE_PATH||'data/ryadom.sqlite';
const database=openDatabase(databasePath);
const services=createServices(databasePath,origin);
let running=false;
async function jobs(){if(running)return;running=true;try{await deliverNotifications(database.binding,services);await dailyBackup(databasePath);}catch(e){console.error('Background job failed',e instanceof Error?e.name:'Unknown');}finally{running=false;}}
const jobsTimer=setInterval(jobs,60000);jobsTimer.unref();
void jobs();
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
const assets={fetch:async(request:Request)=>{
 let pathname:string;try{pathname=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Invalid path',{status:400});}
 let path=resolve(client,'.'+pathname);
 if(path!==client&&!path.startsWith(client+sep))return new Response('Not found',{status:404});
  // Avoid stat+read TOCTOU: read the file, SPA-fallback only for extensionless routes.
  let body:Buffer;
  try{body=await readFile(path);}
  catch{if(extname(pathname))return new Response('Not found',{status:404});path=resolve(client,'index.html');body=await readFile(path);}
  return new Response(new Uint8Array(body),{headers:{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}} as unknown as Fetcher;
const server=createServer(async(incoming,outgoing)=>{
 try{
  const chunks:Buffer[]=[];let length=0;
  for await(const chunk of incoming){const bytes=Buffer.from(chunk);length+=bytes.length;if(length>(incoming.method==='POST'&&/^\/api\/patient\/assessments\/[^/?]+(?:\?.*)?$/.test(incoming.url??'')?65536:incoming.method==='POST'&&incoming.url==='/api/profile/documents'?7340032:incoming.method==='PUT'&&incoming.url==='/api/profile/photo'?200000:16000)){outgoing.writeHead(413,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:'Слишком большой запрос'}));return;}chunks.push(bytes);}
  const headers=new Headers();for(const [name,value] of Object.entries(incoming.headers)){if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);}
  // The service has no host port. Caddy sets X-Real-IP; never trust a free-form value.
  const clientIp=(headers.get('X-Real-IP')||incoming.socket.remoteAddress||'local').trim();
  headers.set('CF-Connecting-IP',/^[0-9a-fA-F:.]+$/.test(clientIp)?clientIp:'local');
  const method=incoming.method||'GET';const pathname=new URL(incoming.url||'/',origin).pathname;
  const request=new Request(origin+pathname+new URL(incoming.url||'/',origin).search,{method,headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});
  const response=await app.fetch(request,{DB:database.binding,ASSETS:assets,MAIL:services.mail,PUSH_PUBLIC_KEY:services.publicKey,PUSH_SEND:services.push});
  outgoing.statusCode=response.status;response.headers.forEach((value,name)=>{if(name!=='set-cookie')outgoing.setHeader(name,value);});
  const cookies=response.headers.getSetCookie();if(cookies.length)outgoing.setHeader('Set-Cookie',cookies);
  outgoing.end(method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Request failed',error instanceof Error?error.name:'Unknown');if(!outgoing.headersSent)outgoing.writeHead(503,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'}));}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port,'0.0.0.0',()=>console.log(`Ryadom listening on ${port}`));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{server.close(()=>{database.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
