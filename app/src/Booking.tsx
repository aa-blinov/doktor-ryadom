import {useCallback,useEffect,useMemo,useState} from 'react';
import {Button,NativeSelect,Textarea,TextInput} from '@mantine/core';
import {IconCalendarEvent} from '@tabler/icons-react';
import {api,errorText} from './api';
import {Empty,ErrorBox,PageLoader} from './ui';
import {clinicTimezones,DEFAULT_TIMEZONE,zoneDateTime,zoneDayKey,zoneDayTitle,zoneTime} from './timezone';

const DAY=86400000;
export const tzLabel=(tz:string)=>clinicTimezones.find(z=>z.value===tz)?.label??tz;
export const statusLabels:Record<string,string>={pending:'Ждёт ответа врача',confirmed:'Подтверждена',declined:'Врач не смог принять, выберите другое время',cancelled:'Отменена'};

type Slot={id:string;startsAt:number;minutes:number};
type Appt={id:string;status:string;reason:string;startsAt:number;minutes:number;doctorName:string;timezone:string};

function groupByDay<T extends {startsAt:number}>(slots:T[],zoneOf:(s:T)=>string){
 const map=new Map<string,T[]>();
 for(const s of slots){const k=zoneDayKey(s.startsAt,zoneOf(s));map.set(k,[...(map.get(k)??[]),s]);}
 return [...map.entries()];
}

// Patient side: pick a free slot of a verified doctor and send a request. The doctor confirms it.
export function BookAppointment({doctorId,doctorName}:{doctorId:string;doctorName:string}){
 const [slots,setSlots]=useState<Slot[]|null>(null),[tz,setTz]=useState(DEFAULT_TIMEZONE),[clinicTz,setClinicTz]=useState(DEFAULT_TIMEZONE),[error,setError]=useState(''),[day,setDay]=useState(''),[picked,setPicked]=useState<Slot|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState('');
 const load=useCallback(async()=>{setError('');try{const r=await api<{slots:Slot[];timezone:string;viewerTimezone:string}>(`/directory/${doctorId}/slots`);setSlots(r.slots);setTz(r.viewerTimezone);setClinicTz(r.timezone);}catch(e){setError(errorText(e));}},[doctorId]);
 useEffect(()=>{void load();},[load]);
 const days=useMemo(()=>groupByDay(slots??[],()=>tz),[slots,tz]);
 const activeDay=days.some(([k])=>k===day)?day:days[0]?.[0]??'';
 const current=days.find(([k])=>k===activeDay)?.[1]??[];
 async function send(){
  if(!picked)return;
  setBusy(true);setError('');setDone('');
  try{
   await api('/patient/appointments',{slotId:picked.id,reason});
   setDone(`Заявка отправлена: ${zoneDateTime(picked.startsAt,tz)} по времени клиники. ${doctorName} подтвердит её или предложит другое время.`);
   setPicked(null);setReason('');await load();
  }catch(e){setError(errorText(e));setPicked(null);await load();}
  finally{setBusy(false);}
 }
 return <section className="doctor-section booking" aria-labelledby="booking-title">
  <h2 id="booking-title">Записаться на приём</h2>
  {tz===clinicTz?<p className="muted small">Время по часовому поясу клиники: {tzLabel(tz)}.</p>:<p className="muted small">Время показано по вашему поясу: {tzLabel(tz)}. Врач работает по времени {tzLabel(clinicTz)}.</p>}
  {slots===null&&!error?<PageLoader label="Загружаем расписание…"/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {slots&&!slots.length&&!error?<Empty icon={<IconCalendarEvent size={28}/>} title="Свободного времени пока нет" description="Врач добавит окна в расписание. Загляните позже"/>:null}
  {days.length?<>
   <div className="booking-days" role="group" aria-label="День приёма">{days.map(([k,list])=><button type="button" key={k} className={k===activeDay?'kind-chip selected':'kind-chip'} aria-pressed={k===activeDay} onClick={()=>{setDay(k);setPicked(null);}}>{zoneDayTitle(list[0].startsAt,tz)}<span className="muted small"> · {list.length}</span></button>)}</div>
   <div className="booking-times" role="group" aria-label="Время приёма">{current.map(s=><button type="button" key={s.id} className={picked?.id===s.id?'booking-time selected':'booking-time'} aria-pressed={picked?.id===s.id} onClick={()=>{setPicked(s);setDone('');}}>{zoneTime(s.startsAt,tz)}</button>)}</div>
  </>:null}
  {picked?<form className="care-form" onSubmit={e=>{e.preventDefault();void send();}}>
   <p><strong>{zoneDateTime(picked.startsAt,tz)}</strong> · {picked.minutes} мин</p>
   <Textarea label="Коротко о причине визита" description="Необязательно. Не пишите диагноз, если не хотите. Врач увидит этот текст" value={reason} onChange={e=>setReason(e.currentTarget.value)} maxLength={300} minRows={2}/>
   <p className="muted small">Оплата проходит у врача или в клинике, не через Рядом. Запись не даёт врачу доступа к вашей карточке: делиться ею вы решаете отдельно. Если нужна срочная помощь, звоните 112 или 103.</p>
   <div className="connect-actions"><Button type="submit" loading={busy}>Отправить заявку</Button><Button variant="default" onClick={()=>setPicked(null)} disabled={busy}>Выбрать другое время</Button></div>
  </form>:null}
  {done?<p role="status" className="muted">{done}</p>:null}
 </section>;
}

// Patient side: own requests and visits, in the clinic's clock.
export function MyAppointments(){
 const [items,setItems]=useState<Appt[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const load=useCallback(async()=>{setError('');try{setItems((await api<{appointments:Appt[]}>('/patient/appointments')).appointments);}catch(e){setError(errorText(e));}},[]);
 useEffect(()=>{void load();},[load]);
 async function cancel(id:string){setBusy(id);setError('');try{await api(`/patient/appointments/${id}/cancel`,{});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 if(!items?.length&&!error)return null;
 return <section className="connection-requests" aria-labelledby="my-appointments-title">
  <h2 id="my-appointments-title">Мои записи</h2>
  {error?<ErrorBox message={error}/>:null}
  {(items??[]).map(a=><article className="request-row" key={a.id}>
   <div><strong>{a.doctorName}</strong><p className="muted small">{zoneDateTime(a.startsAt,a.timezone)} · {a.minutes} мин · {tzLabel(a.timezone)}</p><p className="small">{statusLabels[a.status]??a.status}</p>{a.reason?<p className="care-prose">{a.reason}</p>:null}</div>
   {(a.status==='pending'||a.status==='confirmed')&&a.startsAt>Date.now()?<div className="request-actions"><Button variant="default" loading={busy===a.id} disabled={busy!==null} onClick={()=>void cancel(a.id)}>Отменить</Button></div>:null}
  </article>)}
 </section>;
}

const WEEKDAYS=[{value:1,label:'Пн'},{value:2,label:'Вт'},{value:3,label:'Ср'},{value:4,label:'Чт'},{value:5,label:'Пт'},{value:6,label:'Сб'},{value:7,label:'Вс'}];
const LENGTHS=[15,20,30,45,60,90,120];
const dayOffset=(tz:string,n:number)=>zoneDayKey(Date.now()+n*DAY,tz);

// Doctor side: a weekly template turned into slots, the requests waiting for an answer, and the next two weeks of slots.
export function DoctorSchedule(){
 const [tz,setTz]=useState(DEFAULT_TIMEZONE);
 const [dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState(''),[weekdays,setWeekdays]=useState<number[]>([1,2,3,4,5]),[from,setFrom]=useState('09:00'),[to,setTo]=useState('18:00'),[minutes,setMinutes]=useState('30');
 const [slots,setSlots]=useState<{id:string;startsAt:number;minutes:number;tz:string;status:string;request:{id:string;status:string;reason:string;patientName:string}|null}[]>([]),[appts,setAppts]=useState<(Appt&{patientName:string})[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setError('');
  try{
   const [a,b]=await Promise.all([api<{timezone:string;slots:typeof slots}>(`/doctor/slots?from=${Date.now()}&to=${Date.now()+14*DAY}`),api<{appointments:(Appt&{patientName:string})[]}>('/doctor/appointments')]);
   setTz(a.timezone);setSlots(a.slots);setAppts(b.appointments);
   setDateFrom(d=>d||zoneDayKey(Date.now()+DAY,a.timezone));setDateTo(d=>d||zoneDayKey(Date.now()+7*DAY,a.timezone));
  }catch(e){setError(errorText(e));}
 },[]);
 useEffect(()=>{void load();},[load]);
 const days=useMemo(()=>groupByDay(slots,s=>s.tz),[slots]);
 async function generate(){
  setBusy(true);setError('');setMessage('');
  try{
   const r=await api<{created:number;skipped:number}>('/doctor/slots/generate',{dateFrom,dateTo,weekdays,from,to,minutes:Number(minutes)});
   setMessage(`Добавлено слотов: ${r.created}${r.skipped?`, уже были или в прошлом: ${r.skipped}`:''}`);
   await load();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function decide(id:string,action:'confirm'|'decline'|'cancel'){setBusy(true);setError('');try{await api(`/doctor/appointments/${id}/${action}`,{});await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function toggle(id:string,closed:boolean){setBusy(true);setError('');try{await api(`/doctor/slots/${id}`,{closed},'PUT');await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function drop(id:string){setBusy(true);setError('');try{await api(`/doctor/slots/${id}`,{},'DELETE');await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const pending=appts.filter(a=>a.status==='pending'),confirmed=appts.filter(a=>a.status==='confirmed'&&a.startsAt>Date.now());
 return <section className="doctor-schedule">
  {error?<ErrorBox message={error} retry={load}/>:null}
  <section className="connection-requests" aria-labelledby="requests-title">
   <h2 id="requests-title">Заявки на приём: {pending.length}</h2>
   {pending.map(a=><article className="request-row" key={a.id}><div><strong>{a.patientName}</strong><p className="small">{zoneDateTime(a.startsAt,a.timezone)} · {a.minutes} мин</p>{a.reason?<p className="care-prose">{a.reason}</p>:<p className="muted small">Без причины</p>}</div><div className="request-actions"><Button loading={busy} disabled={busy} onClick={()=>void decide(a.id,'confirm')}>Подтвердить</Button><Button variant="default" disabled={busy} onClick={()=>void decide(a.id,'decline')}>Отклонить</Button></div></article>)}
   {!pending.length?<p className="muted small">Новых заявок нет.</p>:null}
   {confirmed.length?<><h3>Подтверждённые приёмы</h3>{confirmed.map(a=><article className="request-row" key={a.id}><div><strong>{a.patientName}</strong><p className="small">{zoneDateTime(a.startsAt,a.timezone)} · {a.minutes} мин</p></div><div className="request-actions"><Button variant="default" disabled={busy} onClick={()=>void decide(a.id,'cancel')}>Отменить приём</Button></div></article>)}</>:null}
  </section>
  <section className="doctor-section" aria-labelledby="generate-title">
   <h2 id="generate-title">Добавить свободное время</h2>
   <p className="muted small">Время по часовому поясу клиники: {tzLabel(tz)}. Его меняют в профиле. Слоты, которые уже есть, не дублируются.</p>
   <div className="directory-search">
    <TextInput type="date" label="С даты" value={dateFrom} onChange={e=>setDateFrom(e.currentTarget.value)}/>
    <TextInput type="date" label="По дату" value={dateTo} onChange={e=>setDateTo(e.currentTarget.value)}/>
   </div>
   <div className="booking-days" role="group" aria-label="Дни недели">{WEEKDAYS.map(d=>{const on=weekdays.includes(d.value);return <button key={d.value} type="button" className={on?'kind-chip selected':'kind-chip'} aria-pressed={on} onClick={()=>setWeekdays(on?weekdays.filter(x=>x!==d.value):[...weekdays,d.value].sort((a,b)=>a-b))}>{d.label}</button>;})}</div>
   <div className="directory-search">
    <TextInput type="time" label="С" value={from} onChange={e=>setFrom(e.currentTarget.value)}/>
    <TextInput type="time" label="До" value={to} onChange={e=>setTo(e.currentTarget.value)}/>
    <NativeSelect label="Длительность" value={minutes} onChange={e=>setMinutes(e.currentTarget.value)} data={LENGTHS.map(m=>({value:String(m),label:`${m} мин`}))}/>
   </div>
   <div className="connect-actions"><Button loading={busy} disabled={!weekdays.length} onClick={()=>void generate()}>Создать слоты</Button></div>
   {message?<p role="status" className="muted small">{message}</p>:null}
  </section>
  <section className="doctor-section" aria-labelledby="slots-title">
   <h2 id="slots-title">Слоты на две недели</h2>
   {!days.length?<p className="muted small">Слотов пока нет.</p>:null}
   {days.map(([k,list])=><div key={k} className="schedule-day"><h3>{zoneDayTitle(list[0].startsAt,list[0].tz)}</h3>{list.map(s=><div className="schedule-slot" key={s.id}><span>{zoneTime(s.startsAt,s.tz)} · {s.minutes} мин</span>{s.request?<span className="muted small">Заявка: {s.request.patientName}</span>:s.status==='closed'?<span className="muted small">Закрыт</span>:<span className="small">Свободно</span>}<span className="request-actions">{s.request?null:<><Button size="xs" variant="default" disabled={busy} onClick={()=>void toggle(s.id,s.status!=='closed')}>{s.status==='closed'?'Открыть':'Закрыть'}</Button><Button size="xs" variant="subtle" disabled={busy} onClick={()=>void drop(s.id)}>Удалить</Button></>}</span></div>)}</div>)}
  </section>
 </section>;
}
