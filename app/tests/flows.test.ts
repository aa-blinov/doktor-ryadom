import {expect,it} from 'vitest';
import {chromium,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';
import {defaultPlan,today} from '../src/shared';
import {openDoctorSection} from './doctor-navigation';

// Rewritten end-to-end flows on the current interface: invitation, patient goals,
// doctor review of a goal, overview and tabs, and mobile width.
it('invitation links a patient to a doctor, the doctor reviews goals and the patient sees it',async()=>{
 const db=createDatabase(),origin='https://flows.test',env={DB:db.binding,ASSETS:{} as Fetcher},password='test-flows-password-long';
 const browser=await chromium.launch({executablePath:existsSync('/opt/google/chrome/chrome')?'/opt/google/chrome/chrome':undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors:string[]=[];
 async function request(path:string,body?:unknown,cookie?:string,method?:string){
  const r=await app.request(origin+'/api'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)},env);
  return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 async function session(tag:string,role:'patient'|'doctor',name:string){
  const reg=await request('/auth/register',{name,email:tag+'@flows.test',password,role,consent:true,adult:true});
  const context=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  await context.addCookies([{name:'ryadom_session',value:reg.cookie!.split('=')[1],url:origin}]);
  await context.addInitScript(id=>localStorage.setItem('ryadom:onboarding:v1:'+id,'seen'),reg.data.user.id);
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
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {page,user:reg.data.user as {id:string},cookie:reg.cookie!};
 }
 try{
  const patient=await session('flows-patient','patient','Пациент Потоков');
  const doctor=await session('flows-doctor','doctor','Врач Потоков');
  await db.binding.prepare('UPDATE users SET totp_enabled_at=1,specialist_verified_at=?,specialty_kind=\'psychiatrist\' WHERE id=?').bind(Date.now(),doctor.user.id).run();
  // Invitation: the doctor creates a link, the patient accepts it with consent.
  const invite=await request('/doctor/invites',{},doctor.cookie);
  expect((await request('/patient/accept',{token:invite.data.token,consent:true,adult:true},patient.cookie)).status).toBe(200);
  await request('/doctor/patients/'+patient.user.id+'/plan',{...defaultPlan,practices:['ground']},doctor.cookie,'PUT');
  await request('/patient/checkins',{date:today(),mood:3,sleep:6,anxiety:1,energy:null,functioning:2,sleepContext:null,note:'',habit:null},patient.cookie);

  // Patient: adds a goal and logs a step, then sees the assigned practice.
  const p:Page=patient.page;
  await p.goto(origin+'/#/goals');
  await p.getByLabel(/^Новая цель/).fill('Гулять утром');
  await p.getByLabel('Зачем мне это',{exact:true}).fill('Чувствую себя бодрее');
  await p.getByRole('button',{name:'Добавить цель',exact:true}).click();
  await p.getByText('Цель добавлена',{exact:true}).waitFor();
  await p.getByRole('button',{name:'Шаг сделан',exact:true}).click();
  await p.getByLabel('Что получилось или что помешало',{exact:true}).fill('Прошёлся до парка');
  await p.getByRole('button',{name:'Сохранить отметку',exact:true}).click();
  await p.getByText('Отметка сохранена',{exact:true}).waitFor();
  await p.goto(origin+'/#/practices');
  await p.getByRole('heading',{name:'Здесь и сейчас'}).waitFor();

  // Doctor: sees the patient, the overview, the tabs, and confirms the goal log.
  const d:Page=doctor.page;
  await d.goto(origin+'/#/patients');
  await d.getByRole('link',{name:/Пациент Потоков/}).click();
  await d.getByRole('heading',{name:'Перед приёмом',exact:true}).waitFor();
  await openDoctorSection(d,'Цели');
  await d.getByRole('button',{name:'Подтвердить просмотр отметки',exact:true}).click();
  await d.getByText('Просмотр отметки подтверждён',{exact:true}).waitFor();
  await openDoctorSection(d,'История');
  await d.getByRole('heading',{name:'Записи по дням',exact:true}).waitFor();
  await openDoctorSection(d,'План наблюдения');
  await d.getByRole('heading',{name:'Что отслеживаем',exact:true}).waitFor();

  // Patient sees the doctor's confirmation.
  await p.goto(origin+'/#/goals');
  await p.getByText('Врач подтвердил просмотр',{exact:true}).waitFor();

  // Mobile width: no horizontal scroll on the patient home and the doctor overview.
  await p.setViewportSize({width:320,height:760});await p.goto(origin+'/#/today');
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await d.setViewportSize({width:320,height:760});await d.goto(origin+'/#/patient/'+patient.user.id);
  await openDoctorSection(d,'Обзор');
  await d.getByRole('heading',{name:'Перед приёмом',exact:true}).waitFor();
  expect(await d.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

  expect(errors).toEqual([]);
 } finally {
  await browser.close();
  db.close();
 }
},120000);
