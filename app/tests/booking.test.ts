import {afterAll,expect,it} from 'vitest';
import app from '../server/index';
import {createDatabase} from './db-adapter';
const db=createDatabase(),origin='https://booking.test',password='booking-test-password-long';
const env={DB:db.binding,ASSETS:{} as Fetcher,PUSH_PUBLIC_KEY:'key',PUSH_SEND:async()=>{}};
afterAll(()=>db.close());
let ip=0;
const DAY=86400000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
async function request(path:string,init:{json?:unknown;cookie?:string;method?:string}={}){
 const headers:Record<string,string>={Origin:origin,'CF-Connecting-IP':`10.11.${Math.floor(ip/200)}.${(++ip%200)+1}`};
 if(init.cookie)headers.Cookie=init.cookie;
 let body:string|undefined;
 if(init.json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(init.json);}
 return app.request(origin+'/api'+path,{method:init.method||(init.json!==undefined?'POST':'GET'),headers,body},env);
}
async function register(role:'doctor'|'patient',email:string,name:string){
 const r=await request('/auth/register',{json:{name,email,password,role,consent:true,adult:true}});
 expect(r.status).toBe(201);
 const id=(await r.json() as {user:{id:string}}).user.id;
 if(role==='doctor')db.binding.prepare("UPDATE users SET specialist_verified_at=?,specialty_kind='psychologist' WHERE id=?").bind(Date.now(),id).run();
 return {cookie:r.headers.get('set-cookie')!.split(';')[0],id};
}
type Slot={id:string;startsAt:number};

it('doctor publishes slots, patient requests one, doctor confirms; closed or held slots refuse changes',async()=>{
 const doctor=await register('doctor','book-doc@example.com','Анна Врачева');
 const patient=await register('patient','book-pat@example.com','Пётр Пациентов');
 const other=await register('patient','book-other@example.com','Мария Другая');
 const gen=await request('/doctor/slots/generate',{json:{dateFrom:iso(Date.now()+3*DAY),dateTo:iso(Date.now()+4*DAY),weekdays:[1,2,3,4,5,6,7],from:'09:00',to:'11:00',minutes:30},cookie:doctor.cookie});
 expect(gen.status).toBe(201);
 expect((await gen.json() as {created:number}).created).toBe(8);
 const free=await (await request(`/directory/${doctor.id}/slots`,{cookie:patient.cookie})).json() as {slots:Slot[]};
 expect(free.slots).toHaveLength(8);
 const slot=free.slots[0];
 const book=await request('/patient/appointments',{json:{slotId:slot.id,reason:'Тревога перед работой'},cookie:patient.cookie});
 expect(book.status).toBe(201);
 const apptId=(await book.json() as {id:string}).id;
 expect((await request('/patient/appointments',{json:{slotId:slot.id,reason:''},cookie:other.cookie})).status).toBe(409);
 expect(((await (await request(`/directory/${doctor.id}/slots`,{cookie:other.cookie})).json()) as {slots:Slot[]}).slots).toHaveLength(7);
 const mine=await (await request(`/doctor/slots?from=${Date.now()}&to=${Date.now()+14*DAY}`,{cookie:doctor.cookie})).json() as {slots:{id:string;request:{id:string}|null}[]};
 expect(mine.slots.find(s=>s.id===slot.id)?.request).not.toBeNull();
 expect((await request(`/doctor/slots/${slot.id}`,{method:'PUT',json:{closed:true},cookie:doctor.cookie})).status).toBe(409);
 expect((await request(`/doctor/slots/${slot.id}`,{method:'DELETE',json:{},cookie:doctor.cookie})).status).toBe(409);
 expect((await request(`/doctor/appointments/${apptId}/confirm`,{json:{},cookie:doctor.cookie})).status).toBe(200);
 expect((await request(`/doctor/appointments/${apptId}/decline`,{json:{},cookie:doctor.cookie})).status).toBe(409);
 const mineP=await (await request('/patient/appointments',{cookie:patient.cookie})).json() as {appointments:{status:string}[]};
 expect(mineP.appointments[0].status).toBe('confirmed');
 expect((await request(`/patient/appointments/${apptId}/cancel`,{json:{},cookie:patient.cookie})).status).toBe(200);
 expect(((await (await request(`/directory/${doctor.id}/slots`,{cookie:other.cookie})).json()) as {slots:Slot[]}).slots).toHaveLength(8);
},60000);

it('only doctors publish slots and only patients book; decline frees the slot; the reason is capped',async()=>{
 const doctor=await register('doctor','book-doc2@example.com','Ирина Врачева');
 const patient=await register('patient','book-pat2@example.com','Олег Пациентов');
 const day=iso(Date.now()+5*DAY);
 const one={dateFrom:day,dateTo:day,weekdays:[1,2,3,4,5,6,7],from:'10:00',to:'10:30',minutes:30};
 expect((await request('/doctor/slots/generate',{json:one,cookie:patient.cookie})).status).toBe(403);
 expect((await request('/doctor/slots/generate',{json:one,cookie:doctor.cookie})).status).toBe(201);
 const slot=((await (await request(`/directory/${doctor.id}/slots`,{cookie:patient.cookie})).json()) as {slots:Slot[]}).slots[0];
 expect((await request('/patient/appointments',{json:{slotId:slot.id,reason:'x'.repeat(301)},cookie:patient.cookie})).status).toBe(400);
 expect((await request('/patient/appointments',{json:{slotId:slot.id,reason:'x'},cookie:doctor.cookie})).status).toBe(403);
 const id=(await (await request('/patient/appointments',{json:{slotId:slot.id,reason:''},cookie:patient.cookie})).json() as {id:string}).id;
 expect((await request(`/doctor/appointments/${id}/decline`,{json:{},cookie:doctor.cookie})).status).toBe(200);
 expect(((await (await request(`/directory/${doctor.id}/slots`,{cookie:patient.cookie})).json()) as {slots:Slot[]}).slots).toHaveLength(1);
});

it('catalogue sorts by price with unpriced doctors last, filters by format, price and free time, and pages',async()=>{
 const priced=async(email:string,name:string,price:number|null,format:'online'|'offline'|'both')=>{
  const d=await register('doctor',email,name);
  db.binding.prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(d.id,JSON.stringify({price,visitFormat:format}),Date.now()).run();
  return d;
 };
 const cheapOnline=await priced('cat-a@example.com','Елена Дешёвая',1500,'online');
 const pricey=await priced('cat-b@example.com','Игорь Дорогой',9000,'offline');
 const both=await priced('cat-c@example.com','Ольга Общая',4000,'both');
 const patient=await register('patient','cat-pat@example.com','Сергей Каталогов');
 await request('/doctor/slots/generate',{json:{dateFrom:iso(Date.now()+3*DAY),dateTo:iso(Date.now()+3*DAY),weekdays:[1,2,3,4,5,6,7],from:'09:00',to:'09:30',minutes:30},cookie:both.cookie});
 const get=async(q:string)=>(await (await request(`/directory?${q}`,{cookie:patient.cookie})).json()) as {doctors:{id:string;price:number|null;nextSlotAt:number|null}[];total:number;page:number;pageSize:number};
 const byPrice=await get('sort=price');
 const prices=byPrice.doctors.map(d=>d.price);
 const firstNull=prices.indexOf(null);
 const known=prices.filter(p=>p!==null) as number[];
 expect(known).toEqual([...known].sort((a,b)=>a-b));
 if(firstNull>=0)expect(prices.slice(firstNull).every(p=>p===null)).toBe(true);
 const offline=await get('format=offline');
 const offlineIds=offline.doctors.map(d=>d.id);
 expect(offlineIds).toContain(both.id);expect(offlineIds).toContain(pricey.id);expect(offlineIds).not.toContain(cheapOnline.id);
 const cheap=await get('maxPrice=2000');
 expect(cheap.doctors.every(d=>d.price!==null&&d.price<=2000)).toBe(true);
 expect(cheap.doctors.map(d=>d.id)).toContain(cheapOnline.id);
 const free=await get('free=1&sort=nearest');
 expect(free.doctors.length).toBeGreaterThan(0);
 expect(free.doctors.every(d=>d.nextSlotAt!==null)).toBe(true);
 expect(free.doctors.map(d=>d.id)).toContain(both.id);
 for(let i=0;i<13;i++)await register('doctor',`cat-page-${i}@example.com`,`Врач Страница ${i}`);
 const page1=await get('');
 expect(page1.pageSize).toBe(12);expect(page1.total).toBeGreaterThan(12);expect(page1.doctors).toHaveLength(12);
 const page2=await get('page=2');
 expect(page2.page).toBe(2);expect(page2.doctors.length).toBeGreaterThan(0);
 expect(page2.doctors.map(d=>d.id)).not.toContain(page1.doctors[0].id);
},60000);
