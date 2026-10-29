import {expect,it} from 'vitest';
import {chromium} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';

it('a patient with a wrong invitation code reads why it did not work',async()=>{
 const db=createDatabase(),origin='https://invite.test',env={DB:db.binding,ASSETS:{} as Fetcher};
 const registered=await app.request(origin+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Пациент Приглашение',email:'invite-ui@invite.test',role:'patient',password:'test-invite-password-long',consent:true,adult:true})},env);
 const user=(await registered.json() as any).user,cookie=registered.headers.get('set-cookie')!.split(';')[0];
 const browser=await chromium.launch({executablePath:existsSync('/opt/google/chrome/chrome')?'/opt/google/chrome/chrome':undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  await context.addCookies([{name:'ryadom_session',value:cookie.split('=')[1],url:origin}]);
  await context.addInitScript(id=>localStorage.setItem('ryadom:onboarding:v1:'+id,'seen'),user.id);
  await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
   if(url.pathname.startsWith('/api/')){const r=await app.request(req.url(),{method:req.method(),headers:req.headers(),body:req.method()==='GET'?undefined:req.postData()??undefined},env);await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});}
   else{const path=url.pathname==='/'?'index.html':url.pathname.slice(1),mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};try{await route.fulfill({contentType:mime[extname(path)]??'text/plain',body:readFileSync(resolve('dist/client',path))});}catch{await route.fulfill({status:404,body:'missing'});}}});
  const page=await context.newPage();
  await page.goto(origin+'/#/settings');
  // The segmented control and the mobile navigation carry the same word, so the tab
  // is taken from the control itself.
  await page.locator('.mantine-SegmentedControl-label').filter({hasText:'Врач'}).click();
  await page.getByLabel('Ссылка или код приглашения').fill('wrong-code-0000');
  await page.getByRole('button',{name:'Проверить приглашение'}).click();
  // The reason has to be on the screen of the doctor tab itself, not hidden in another one.
  const error=page.getByText('Приглашение уже использовано или срок истёк. Попросите врача создать новое.');
  await error.waitFor({timeout:10000});
  expect(await error.isVisible()).toBe(true);
 }finally{await browser.close();}
},60000);
