import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const shots='/home/ubuntu/pet/control-app/.impeccable/review';
mkdirSync(shots,{recursive:true});
const base='https://doktor-ryadom.duckdns.org';
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
async function login(context,email,password){
  const page=await context.newPage();
  const r=await page.request.post(base+'/api/auth/login',{data:{email,password},headers:{Origin:base}});
  const body=await r.json();
  const cookie=r.headers()['set-cookie']?.split(';')[0];
  await context.addCookies([{name:'ryadom_session',value:cookie.split('=')[1],url:base}]);
  await page.addInitScript(id=>localStorage.setItem('ryadom:onboarding:v1:'+id,'seen'),body.user.id);
  return page;
}
async function capture(page,stem){
  for(const width of [1440,320]){
    await page.setViewportSize({width,height:width===320?760:1000});
    await page.addStyleTag({content:'.pwa-notice{display:none}'});
    await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow) console.log('OVERFLOW',stem,width);
    await page.screenshot({path:`${shots}/${stem}-${width}.png`,fullPage:true,animations:'disabled'});
    console.log('shot',stem,width);
  }
}
try{
  const ctxP=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  const p=await login(ctxP,'demo-patient-1791397579182@example.com','W7E8GSDkf3Mg_KZI');
  p.on('pageerror',e=>errors.push('patient: '+e.message));
  await p.goto(base+'/#/today');await p.getByText('Здравствуйте').first().waitFor();
  await capture(p,'quieter-patient-today');
  await p.goto(base+'/#/plan');await p.getByText('План врача').first().waitFor();
  await capture(p,'quieter-patient-care');
  await p.goto(base+'/#/practices');await p.waitForTimeout(500);
  await capture(p,'quieter-patient-practices');

  const ctxD=await browser.newContext({locale:'ru-RU',serviceWorkers:'block'});
  const d=await login(ctxD,'demo-doctor-1791397577564@example.com','je0EdIEY6M0-SOIB');
  d.on('pageerror',e=>errors.push('doctor: '+e.message));
  await d.goto(base+'/#/patients');await d.getByText('Блинов Александр').first().waitFor();
  await capture(d,'quieter-doctor-list');
  await d.getByText('Блинов Александр').first().click();
  await d.getByText('Перед приёмом').first().waitFor();
  await capture(d,'quieter-doctor-overview');
  await d.goto(base+'/#/patient/'+(await d.evaluate(async()=>{
    const r=await fetch('/api/doctor/patients',{headers:{Accept:'application/json'}});
    const j=await r.json();return j.patients[0].id;
  }))+'');
  await d.waitForTimeout(400);
  // open history via select on mobile / tabs on desktop
  await d.evaluate(()=>{const s=document.querySelector('#doctor-section');if(s){s.value='history';s.dispatchEvent(new Event('change',{bubbles:true}));}});
  await d.waitForTimeout(400);
  await capture(d,'quieter-doctor-history');
  console.log('errors',errors);
}finally{await browser.close();}
