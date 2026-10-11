import {expect,it} from 'vitest';
import {chromium,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import app from '../server/index';
import {createDatabase} from './db-adapter';

// One scenario per role, each in its own browser session against the same database.
it('patient, doctor and administrator complete their core flows without page errors',async()=>{
 const db=createDatabase(),origin='https://roles.test',env={DB:db.binding,ASSETS:{} as Fetcher},password='test-roles-password-long';
 const browser=await chromium.launch({executablePath:existsSync('/opt/google/chrome/chrome')?'/opt/google/chrome/chrome':undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors:string[]=[];
 async function request(path:string,body?:unknown,cookie?:string,method?:string){
  const r=await app.request(origin+'/api'+path,{method:method??(typeof body==='undefined'?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:typeof body==='undefined'?undefined:JSON.stringify(body)},env);
  return {status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 async function session(tag:string,role:'patient'|'doctor',name:string){
  const reg=await request('/auth/register',{name,email:tag+'@roles.test',password,role,consent:true});
  const user=reg.data.user;
  const context=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  await context.addCookies([{name:'ryadom_session',value:reg.cookie!.split('=')[1],url:origin}]);
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
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {page,user,cookie:reg.cookie!};
 }
 try{
  // ---- Patient
  const patient=await session('roles-patient','patient','Пациент Ролевой');
  const p:Page=patient.page;
  await p.goto(origin+'/#/today');
  await p.getByRole('radio',{name:'Хорошо'}).check().catch(()=>p.getByRole('button',{name:'Хорошо',exact:true}).click());
  await p.getByRole('button',{name:'Сохранить отметку'}).click();
  await p.getByRole('heading',{name:'Отметка сохранена'}).waitFor();
  await p.goto(origin+'/#/sos');
  await p.getByText('Врач не подключён, поэтому сигнал некому отправить.').waitFor();
  await p.goto(origin+'/#/practices');
  await p.getByRole('button',{name:'Подключить врача'}).waitFor();
  await p.goto(origin+'/#/settings');
  await p.getByRole('button',{name:'Выйти из аккаунта'}).waitFor();

  // ---- Doctor, not yet verified: sees the request form, not the patient list
  const doctor=await session('roles-doctor','doctor','Врач Ролевой');
  const d:Page=doctor.page;
  await d.goto(origin+'/#/patients');
  await d.getByRole('heading',{name:'Подключение врача'}).waitFor();
  await d.getByLabel('Тип специалиста').selectOption('psychiatrist');
  await d.getByLabel('Специальность',{exact:false}).fill('Психиатр');
  await d.getByLabel('Номер лицензии или диплома').fill('KZ-ROLE-1');
  await d.getByLabel('Город').fill('Алматы');
  await d.getByRole('button',{name:'Отправить заявку'}).click();
  await d.getByText('Заявка на проверке').waitFor();

  // ---- Administrator: promote an account, then review the queue
  const admin=await session('roles-admin','doctor','Админ Ролевой');
  await db.binding.prepare("UPDATE users SET role='admin' WHERE id=?").bind(admin.user.id).run();
  const a:Page=admin.page;
  await a.goto(origin+'/#/admin');
  await a.getByRole('heading',{name:'Заявки врачей'}).waitFor();
  await a.getByText('Врач Ролевой').waitFor();
  await a.getByText('KZ-ROLE-1').waitFor();
  await a.getByRole('button',{name:'Подтвердить'}).first().click();
  await a.getByText('Нет заявок',{exact:false}).count();
  await a.goto(origin+'/#/admin/patients');
  await a.getByRole('heading',{name:'Пациенты'}).waitFor();
  await a.getByText('roles-patient@roles.test').waitFor({state:'detached',timeout:2000}).catch(()=>{});
  expect(await a.getByText('Пациент Ролевой').count()).toBe(0);
  await a.goto(origin+'/#/admin/doctors');
  await a.getByText('Врач Ролевой').waitFor();
  await a.goto(origin+'/#/admin/audit');
  await a.getByRole('heading',{name:'Журнал действий'}).waitFor();

  // The doctor is verified now: patient-side navigation opens for them.
  await d.reload();
  await d.getByRole('heading',{name:'Ваши пациенты'}).waitFor({timeout:10000});
  await d.goto(origin+'/#/profile');
  await d.getByRole('heading',{name:'Профиль',exact:true}).waitFor();
  await d.getByRole('heading',{name:'О себе'}).waitFor();
  await d.goto(origin+'/#/code');
  await d.getByRole('heading',{name:'Приглашения',exact:true}).waitFor();
  await d.getByRole('heading',{name:'Одноразовые ссылки'}).waitFor();
  await d.goto(origin+'/#/settings');
  await d.getByRole('heading',{name:'Настройки',exact:true}).waitFor();
  await d.getByRole('heading',{name:'Аккаунт и безопасность'}).waitFor();

  expect(errors).toEqual([]);
 } finally {
  await browser.close();
  db.close();
 }
},120000);
