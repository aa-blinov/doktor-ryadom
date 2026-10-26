import {expect,it} from 'vitest';
import {chromium} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {totpCode} from '../server/totp';

it('a doctor without a second factor sees the QR, enables it and reaches the cabinet without reloading',async()=>{
 const db=createDatabase(),origin='https://factor.test',env={DB:db.binding,ASSETS:{} as Fetcher};
 const registered=await app.request(origin+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Врач Фактор',email:'factor-ui@factor.test',role:'doctor',password:'test-factor-password-long',consent:true,adult:true})},env);
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
  await page.goto(origin+'/#/patients');
  await page.getByRole('heading',{name:'Включите вход с кодом'}).waitFor();
  expect(await page.locator('nav[aria-label="Основная навигация"] a').count()).toBe(0);
  await page.getByLabel(/^Пароль/).fill('test-factor-password-long');await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await page.getByRole('img',{name:/QR-код/}).waitFor();
  const secret=(await page.getByLabel('Ключ для приложения').textContent())!.replace(/\s/g,'');
  await page.getByLabel('Код из приложения').fill(await totpCode(secret,Math.floor(Date.now()/30000)));
  await page.getByRole('button',{name:'Включить',exact:true}).click();
  await page.getByRole('button',{name:'Открыть кабинет'}).click();
  await page.getByRole('heading',{name:'Подключение врача'}).waitFor();
  expect(await page.locator('nav[aria-label="Основная навигация"] a').count()).toBeGreaterThan(0);
 }finally{await browser.close();}
},60000);
