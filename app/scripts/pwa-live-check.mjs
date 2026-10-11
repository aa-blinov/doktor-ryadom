import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
const origin=process.env.PWA_ORIGIN||'https://doktor-ryadom.duckdns.org';
const profile=mkdtempSync('/tmp/ryadom-pwa-profile-');
const context=await chromium.launchPersistentContext(profile,{viewport:{width:390,height:844},permissions:['notifications'],executablePath:process.env.CHROME_EXECUTABLE||'/opt/google/chrome/chrome',headless:true,ignoreDefaultArgs:['--disable-background-networking'],args:['--no-sandbox','--disable-dev-shm-usage']});
const results={checkedAt:new Date().toISOString()},errors=[];mkdirSync('../.impeccable/review',{recursive:true});
try{
 let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(origin,{waitUntil:'networkidle',timeout:30000});if(response.status()!==200)throw new Error('Homepage HTTP '+response.status());
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload({waitUntil:'networkidle'});
 results.worker=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,active:r.active?.state,controlled:!!navigator.serviceWorker.controller};});
 const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');results.manifest=await cdp.send('Page.getAppManifest');results.installability=await cdp.send('Page.getInstallabilityErrors');
 results.assets=await page.evaluate(async()=>{const manifest=await fetch('/manifest.webmanifest').then(r=>r.json());const icons=await Promise.all(manifest.icons.map(async i=>({src:i.src,status:(await fetch(i.src)).status})));return {manifest,icons};});
 const registrations=new Map();cdp.on('ServiceWorker.workerRegistrationUpdated',({registrations:r})=>r.forEach(x=>registrations.set(x.scopeURL,x.registrationId)));await cdp.send('ServiceWorker.enable');
 await page.waitForTimeout(500);const registrationId=registrations.get(origin+'/');if(!registrationId)throw new Error('CDP registration missing');
 await cdp.send('ServiceWorker.deliverPushMessage',{origin,registrationId,data:JSON.stringify({title:'Рядом: проверка PWA',body:'Синтетическая проверка обработчика push.',url:'/#/today'})});
 await page.waitForTimeout(500);results.notification=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).map(n=>({title:n.title,body:n.body,url:n.data.url}));});
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;for(const n of await r.getNotifications())n.close();});
 if(process.env.PWA_REAL_PUSH==='1'){
  const email=`pwa-check-${Date.now()}@example.invalid`,password=crypto.randomUUID();
  const registered=await page.evaluate(async({email,password})=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Проверка PWA',email,password,role:'patient',consent:true})});return r.status;},{email,password});
  if(registered!==201)throw new Error('Test account registration failed');
  try{await page.reload({waitUntil:'networkidle'});if(await page.getByRole('button',{name:'Пропустить',exact:true}).count())await page.getByRole('button',{name:'Пропустить',exact:true}).click();await page.goto(origin+'/#/settings');await page.getByRole('heading',{name:'Аккаунт и безопасность',exact:true}).waitFor();await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'../.impeccable/review/pwa-patient-settings-desktop.png',fullPage:true});await page.setViewportSize({width:320,height:760});await page.getByRole('textbox',{name:'Часовой пояс',exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'../.impeccable/review/pwa-patient-settings-320.png'});
  results.realPush=process.env.PWA_SKIP_PROVIDER==='1'?{subscribed:false,error:'Provider registration previously timed out; not retried'}:await page.evaluate(async()=>{
   try{const config=await fetch('/api/notifications').then(r=>r.json()),r=await navigator.serviceWorker.ready,key=Uint8Array.from(atob(config.publicKey.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
    const sub=await Promise.race([r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Push provider registration timeout')),15000))]);
    const saved=await fetch('/api/notifications/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});if(saved.status!==200)throw new Error('Subscription save HTTP '+saved.status);
    const sent=await fetch('/api/notifications/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
    return {subscribed:true,gatewayStatus:sent.status};
   }catch(e){return {subscribed:false,error:e.message};}
  });if(results.realPush.subscribed){await page.waitForTimeout(2500);results.realPush.displayed=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).length>0;});}
  if(!results.realPush.subscribed){
   await page.evaluate(async()=>{const sub={endpoint:'https://fcm.googleapis.com/fcm/send/ryadom-ui-fixture',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};const r=await fetch('/api/notifications/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});if(r.status!==200)throw new Error('UI fixture subscription failed');window.originalSubscription=PushManager.prototype.getSubscription;PushManager.prototype.getSubscription=async()=>({...sub,toJSON:()=>sub,unsubscribe:async()=>true});});
   await page.goto(origin+'/#/history');await page.goto(origin+'/#/settings');await page.getByRole('button',{name:'Проверить уведомление',exact:true}).waitFor();await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Проверить уведомление',exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'../.impeccable/review/pwa-patient-connected-fixture-desktop.png'});await page.setViewportSize({width:320,height:760});await page.getByRole('button',{name:'Проверить уведомление',exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'../.impeccable/review/pwa-patient-connected-fixture-320.png'});await page.evaluate(()=>{PushManager.prototype.getSubscription=window.originalSubscription;});results.connectedUi='synthetic browser subscription; real transport not verified';
  }
  }finally{await page.evaluate(async({password})=>{const r=await navigator.serviceWorker.ready,sub=await r.pushManager.getSubscription();if(sub)await sub.unsubscribe();for(const n of await r.getNotifications())n.close();const removed=await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'УДАЛИТЬ',password})});if(removed.status!==200)throw new Error('Test account cleanup failed');},{password});}
 }
 await page.close();page=await context.newPage();await page.goto(origin,{waitUntil:'networkidle'});page.on('pageerror',e=>errors.push(e.message));
 {
  const email=`pwa-doctor-${Date.now()}@example.invalid`,password=crypto.randomUUID();
  await page.evaluate(async({email,password})=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Проверка врача',email,password,role:'doctor',consent:true})});if(r.status!==201)throw new Error('Doctor test registration failed');},{email,password});
  try{await page.reload({waitUntil:'networkidle'});if(await page.getByRole('button',{name:'Пропустить',exact:true}).count())await page.getByRole('button',{name:'Пропустить',exact:true}).click();await page.goto(origin+'/#/settings');await page.getByRole('heading',{name:'Аккаунт и безопасность',exact:true}).waitFor();await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'../.impeccable/review/pwa-doctor-settings-desktop.png',fullPage:true});await page.setViewportSize({width:320,height:760});await page.getByLabel('Ежедневная сводка новых материалов').evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:'../.impeccable/review/pwa-doctor-settings-320.png'});}
  finally{await page.evaluate(async password=>{const r=await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'УДАЛИТЬ',password})});if(r.status!==200)throw new Error('Doctor test cleanup failed');},password);}
 }
 await page.goto(origin,{waitUntil:'networkidle'});await page.setViewportSize({width:320,height:760});
 results.cache=await page.evaluate(async()=>{const keys=await caches.keys(),urls=[];for(const key of keys){const c=await caches.open(key);urls.push(...(await c.keys()).map(r=>r.url));}return {count:urls.length,containsApi:urls.some(u=>new URL(u).pathname.startsWith('/api/'))};});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Нет подключения к интернету'}).waitFor({timeout:10000}).catch(async e=>{results.offlineDebug={online:await page.evaluate(()=>navigator.onLine),text:await page.locator('body').innerText()};await page.screenshot({path:'../.impeccable/review/pwa-offline-mobile.png'});throw e;});results.offline=true;await page.screenshot({path:'../.impeccable/review/pwa-offline-mobile.png'});
 await context.setOffline(false);await page.getByRole('button',{name:'Попробовать снова',exact:true}).click();await page.getByRole('heading',{name:'Начнём знакомство'}).waitFor({timeout:10000});results.reconnect=true;
 results.errors=errors;if(errors.length||results.cache.containsApi||!results.worker.controlled||results.installability.installabilityErrors.length||!results.notification.length)throw new Error('PWA assertions failed');
 console.log(JSON.stringify(results,null,2));
}finally{writeFileSync('../.impeccable/review/pwa-live-results.json',JSON.stringify(results,null,2));await context.close();rmSync(profile,{recursive:true,force:true});}
