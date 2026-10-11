import {chromium} from '@playwright/test';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
const profile=mkdtempSync('/tmp/ryadom-update-');
const context=await chromium.launchPersistentContext(profile,{executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await context.newPage();await page.goto('https://doktor-ryadom.duckdns.org',{waitUntil:'networkidle'});await page.evaluate(async()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});console.log('UPDATE_CHECK_READY');
 await page.evaluate(()=>{window.pwaCheck=setInterval(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{}),2000);});
 await page.getByRole('button',{name:'Обновить',exact:true}).waitFor({timeout:55000});await page.screenshot({path:'../.impeccable/review/pwa-update-desktop.png'});
 const loaded=page.waitForEvent('load',{timeout:10000});await page.getByRole('button',{name:'Обновить',exact:true}).click();await loaded;await page.getByRole('heading',{name:'Начнём знакомство'}).waitFor();
 const result={updatePrompt:true,reloaded:true,workerControlled:await page.evaluate(()=>!!navigator.serviceWorker.controller)};writeFileSync('../.impeccable/review/pwa-update-results.json',JSON.stringify(result));console.log(JSON.stringify(result));
}finally{await context.close();rmSync(profile,{recursive:true,force:true});}
