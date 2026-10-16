import {openDoctorSection} from './doctor-navigation';
import {expect,it} from 'vitest';
import {chromium,type Page} from '@playwright/test';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {defaultPlan,today} from '../src/shared';

it('pilot: patient goals and practice notes reach the clinician queue and can be reviewed',async()=>{
 const db=createDatabase(),origin='https://pilot.test',env={DB:db.binding,ASSETS:{} as Fetcher},password='test-pilot-password-long';
 const browser=await chromium.launch({executablePath:existsSync('/opt/google/chrome/chrome')?'/opt/google/chrome/chrome':undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const shots=resolve('../.impeccable/review');mkdirSync(shots,{recursive:true});const errors:string[]=[];
 async function request(path:string,body:unknown,cookie?:string,method='POST'){
  return app.request(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)},env);
 }
 async function pageFor(role:string,name:string){
  const registered=await request('/auth/register',{name,email:role+'@pilot.test',role,password,consent:true,adult:true});const user=(await registered.json() as any).user;
  const cookie=registered.headers.get('set-cookie')!.split(';')[0];
  const context=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  await context.addCookies([{name:'ryadom_session',value:cookie.split('=')[1],url:origin}]);
  await context.addInitScript(id=>localStorage.setItem('ryadom:onboarding:v1:'+id,'seen'),user.id);
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.startsWith('/api/')){
    const r=await app.request(req.url(),{method:req.method(),headers:req.headers(),body:req.method()==='GET'?undefined:req.postData()??undefined},env);
    await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
   }else{
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1),mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
    try{await route.fulfill({contentType:mime[extname(path)]??'text/plain',body:readFileSync(resolve('dist/client',path))});}catch{await route.fulfill({status:404,body:'missing asset'});}
   }
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,user,cookie};
 }
 async function capture(page:Page,stem:string){
  for(const width of [1440,320]){
   await page.setViewportSize({width,height:width===320?760:1000});await page.addStyleTag({content:'.pwa-notice{display:none}'});
   await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:shots+'/'+stem+'-'+width+'.png',fullPage:true,animations:'disabled'});
  }
 }
 try{
  const {page:p,user:patient,cookie:pc}=await pageFor('patient','Александр Тестовый');
  const {page:d,user:doctor,cookie:dc}=await pageFor('doctor','Абат Тестовый');
  await db.binding.prepare('UPDATE users SET specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),doctor.id).run();
  const invite=await request('/doctor/invites',{},dc);await request('/patient/accept',{token:(await invite.json() as any).token,consent:true,adult:true},pc);
  expect((await request('/doctor/patients/'+patient.id+'/plan',{...defaultPlan,practices:['ground']},dc,'PUT')).status).toBe(200);
  await request('/patient/checkins',{date:today(),mood:3,sleep:6,anxiety:1,energy:null,functioning:2,sleepContext:null,note:'Для проверки: хочу обсудить, что помогает отдыхать',habit:null},pc);
  await p.goto(origin+'/#/goals');
  await p.getByLabel(/^Новая цель/).fill('Снова встречаться с друзьями');await p.getByLabel('Зачем мне это',{exact:true}).fill('Хочу поддерживать близкие отношения');
  await p.getByRole('button',{name:'Добавить цель',exact:true}).click();await p.getByText('Цель добавлена',{exact:true}).waitFor();
  await p.getByRole('button',{name:'Шаг сделан',exact:true}).click();await p.getByLabel('Что получилось или что помешало',{exact:true}).fill('Написал другу, договорились созвониться');
  await p.getByRole('button',{name:'Сохранить отметку',exact:true}).click();await p.getByText('Отметка сохранена',{exact:true}).waitFor();
  await capture(p,'pilot-patient-goals');
  await p.goto(origin+'/#/practice/ground');await p.getByRole('button',{name:'Начать',exact:true}).click();await p.getByRole('button',{name:'Остановить практику',exact:true}).click();await p.getByRole('button',{name:'Неприятно',exact:true}).click();
  await p.getByLabel('Что хочется рассказать врачу',{exact:true}).fill('Было трудно сосредоточиться, остановился');await capture(p,'pilot-practice-feedback');
  await p.getByRole('button',{name:'Сохранить оценку',exact:true}).click();await p.getByRole('heading',{name:'Практика отключена',exact:true}).waitFor();
  await d.goto(origin+'/#/patients');await d.getByRole('link',{name:/Александр Тестовый/}).waitFor();await d.getByText('Новых материалов: 2',{exact:true}).waitFor();await capture(d,'pilot-doctor-queue');
  await d.getByRole('link',{name:/Александр Тестовый/}).click();await openDoctorSection(d,'Обзор');await d.getByRole('heading',{name:'Перед приёмом',exact:true}).waitFor();await capture(d,'pilot-doctor-overview');
  await d.locator('.attention-row',{hasText:'Отметки по целям к просмотру: 1'}).getByRole('button',{name:'К целям',exact:true}).click();await d.getByRole('heading',{name:'Личные цели пациента',exact:true}).waitFor();await capture(d,'pilot-doctor-goals');
  await d.getByRole('button',{name:'Подтвердить просмотр отметки',exact:true}).click();await d.getByText('Вы подтвердили просмотр',{exact:true}).waitFor();
  await openDoctorSection(d,'История');await d.locator('details.review-fold>summary').click();await d.getByText('Было трудно сосредоточиться, остановился',{exact:true}).waitFor();await capture(d,'pilot-doctor-practices');
  await d.getByRole('button',{name:'Подтвердить просмотр отзыва',exact:true}).click();await d.getByText('Просмотр подтверждён',{exact:true}).waitFor();
  await p.goto(origin+'/#/history/practices');await p.getByText('Врач подтвердил просмотр',{exact:true}).waitFor();
  await d.goto(origin+'/#/patients');await d.getByRole('link',{name:/Александр Тестовый/}).waitFor();await d.waitForFunction(()=>!document.body.innerText.includes('Новых материалов:'),null,{timeout:10000});
  await d.getByRole('link',{name:/Александр Тестовый/}).click();await openDoctorSection(d,'Обзор');await d.getByRole('heading',{name:'Перед приёмом',exact:true}).waitFor();await d.setViewportSize({width:1440,height:1000});await d.locator('.theme-toggle').click();await capture(d,'pilot-dark-overview');
  await p.goto(origin+'/#/settings');await p.getByRole('button',{name:'Тёмная тема',exact:true}).click();await p.goto(origin+'/#/goals');await p.getByRole('heading',{name:'Мои цели',exact:true,level:1}).waitFor();await p.setViewportSize({width:1440,height:1000});await capture(p,'pilot-dark-goals');
  expect(errors).toEqual([]);
 }finally{await browser.close();db.close();}
},90000);
