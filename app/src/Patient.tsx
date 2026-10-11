import {useSectionScroll} from './useSectionScroll';
import {Goals} from './Goals';
import {PracticeExperienceList} from './PracticeLibrary';
import {assessmentTitle} from './assessments';
import { DoctorDirectory, DoctorPage } from './DoctorDirectory';
import { PracticeVisual } from './PracticeVisual';
import {ProfileSettings,DoctorProfileDetails} from './ProfileSettings';
import { useRefreshOnReturn } from './useRefreshOnReturn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Group, Loader, Modal, SegmentedControl, Switch, Textarea, TextInput } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconCheck, IconChevronRight, IconClock, IconFileText, IconLeaf, IconLink, IconMoon, IconPlayerPause, IconShieldCheck, IconSparkles } from '@tabler/icons-react';
import { api, errorText } from './api';
import { Empty, ErrorBox, Face, formatDate, HistoryChart, PageHead, SleepInput} from './ui';
import { navigate } from './App';
import { moods, today, todayInTimezone, firstNameOf, type Entry, type EntryInput, type PatientData, type Settings, type DoctorProfile, type User } from './shared';
import { practiceContent } from './practices';
import { PracticeLibrary } from './PracticeLibrary';
import {AccountSettings} from './AccountSettings';
import {ReminderSettings} from './ReminderSettings';
import {Treatment,AssessmentFlow,AssessmentReview} from './Care';
import {EditEntry} from './EditEntry';
import {useDraft} from './useDraft';

export function PatientWorkspace({user,route,onLogout,themeLabel,onToggleTheme}:{user:User;route:string;onLogout:()=>void;themeLabel:string;onToggleTheme:()=>void}){
 useSectionScroll(`${user.id}:${route}`);
 const [data,setData]=useState<PatientData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{setError('');try{setData(await api<PatientData>('/patient/data'));}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{reload();},[reload,route]);
 useRefreshOnReturn(reload);
 if(loading)return <div className="section-loading"><Loader/><p>Загружаем ваши записи…</p></div>;
 if(!data)return <ErrorBox message={error} retry={reload}/>;
 const available=practiceContent.filter(p=>data.plan.practices.includes(p.id)&&!data.settings.blockedPractices.includes(p.id));
 if(route==='/checkin'&&data.entries.some(e=>e.date===today()))return <Empty title="Сегодняшняя отметка уже сохранена" description="Она доступна в истории и сводке к приёму" icon={<IconCheck size={28}/>} action="Посмотреть историю" onAction={()=>navigate('/history')}/>;
 if(route.startsWith('/edit/')){const entry=data.entries.find(e=>e.id===route.split('/')[2]);return entry?<EditEntry key={entry.id} entry={entry} onSaved={reload}/>:<ErrorBox message="Запись не найдена. Откройте историю заново."/>;}
 if(route.startsWith('/assessment/')){const a=data.assessments.find(a=>a.id===route.split('/')[2]);return a?<AssessmentFlow key={a.id} assessment={a} onSaved={reload}/>:<ErrorBox message="Опросник недоступен. Откройте план врача."/>;}
 if(route==='/goals')return <><button className="back-link" onClick={()=>navigate('/today')}>На сегодня</button><PageHead title="Мои цели" description="Небольшие шаги к тому, что для вас важно"/><Goals data={data} onSaved={reload}/></>;
 if(route==='/plan')return <Treatment data={data} onSaved={reload}/>;
 if(route==='/checkin')return <Checkin data={data} onSaved={async()=>{await reload();navigate('/saved');}}/>;
 if(route.startsWith('/practice/')){const practice=practiceContent.find(p=>p.id===route.split('/')[2]);return practice?<PracticeFlow key={practice.id} practice={practice} allowed={available.some(p=>p.id===practice.id)} onSaved={reload}/>:<Empty title="Практика сейчас недоступна" description="Она отключена в плане или после неприятного опыта" icon={<IconLeaf/>} action="К списку практик" onAction={()=>navigate('/practices')}/>;}
 
 if(route.startsWith('/history')||route.startsWith('/practices/history')){const section=route==='/history/practices'?'practices':'checkins';return <><SegmentedControl fullWidth mb="lg" value={section} onChange={v=>navigate(v==='practices'?'/history/practices':'/history')} data={[{label:'Отметки',value:'checkins'},{label:'Практики',value:'practices'}]}/>{section==='practices'?<PracticeExperienceList data={data}/>:<><History entries={data.entries}/><AssessmentReview assessments={data.assessments} onSaved={reload}/></>}</>;}
 if(route==='/practices')return <PracticeLibrary data={data}/>;
 if(route==='/doctors')return <DoctorDirectory/>;
 if(route.startsWith('/doctors/'))return <DoctorPage key={route.split('/')[2]} id={route.split('/')[2]} onChanged={reload}/>;
 if(route==='/doctor')return <section className="care-section doctor-page"><h2>Ваш врач</h2>{data.doctor?<><p><strong>{data.doctor.name}</strong></p><DoctorProfileDetails name={data.doctor.name} profile={data.doctor.profile}/><div className="doctor-page-actions"><Button variant="outline" onClick={()=>navigate('/plan')}>План врача</Button><Button variant="subtle" onClick={()=>navigate('/doctors')}>Каталог врачей</Button></div></>:<><p className="muted">Врач не подключён. Выберите специалиста в каталоге или подключитесь по приглашению.</p><div className="doctor-page-actions"><Button size="lg" onClick={()=>navigate('/doctors')}>Найти врача</Button><Button variant="outline" onClick={()=>navigate('/settings/connect')}>У меня есть приглашение</Button></div><Button variant="subtle" mt="md" onClick={()=>navigate('/plan')}>План врача</Button></>}</section>;
 if(route==='/settings'||route==='/settings/connect')return <PatientSettings data={data} user={user} focusConnect={route==='/settings/connect'} onSaved={reload} onLogout={onLogout} themeLabel={themeLabel} onToggleTheme={onToggleTheme}/>;
 if(route==='/saved')return <div className="success-panel"><div className="success-icon"><IconCheck size={34}/></div><h1>Отметка сохранена</h1><p>Она появилась в вашей истории. Все ответы можно включить в сводку к приёму.</p><div className="success-actions"><Button onClick={()=>navigate('/history')}>Посмотреть историю</Button><Button variant="subtle" onClick={()=>navigate('/summary')}>Подготовить сводку</Button><Button variant="subtle" onClick={()=>navigate('/today')}>На сегодня</Button></div><p className="muted small">Ваш лечащий врач: {data.doctor?.name}</p></div>;
 if(route==='/sos')return <section className="sos-screen"><PageHead title="Мне сейчас плохо" description="Сигнал уйдёт вашему врачу. Если опасно, звоните 112."/><SosButton userId={user.id} hasDoctor={!!data.doctor}/></section>;
 const marked=data.entries.find(e=>e.date===today());
 const firstName=firstNameOf(user.name);const frequency=data.plan.frequency==='daily'?'Каждый день':data.plan.frequency==='three'?'Пн, ср, пт':'Раз в неделю';
 const last=data.entries[0]; const daysSince=last?Math.floor((Date.parse(today())-Date.parse(last.date))/86400000):Infinity; const due=!last || (data.plan.frequency==='three'?[1,3,5].includes(new Date().getDay())&&daysSince>=1:daysSince>=(data.plan.frequency==='daily'?1:7));
 const invitation=new URLSearchParams(window.location.search).get('invite');
 return <>{error?<ErrorBox message={error} retry={reload}/>:null}
  <div className="today-simple">
   <header className="today-simple-head">
    <h1>Здравствуйте, {firstName}</h1>
    <p className="muted">{formatDate(today(),true)}</p>
   </header>
   {invitation?<div className="inline-notice"><IconLink size={20}/><span>У вас есть приглашение от врача</span><Button size="xs" variant="subtle" onClick={()=>navigate('/settings/connect')}>Посмотреть</Button></div>:null}
   {marked?<section className="today-simple-card today-done">
    <div className="today-done-main"><Face value={marked.mood} size={40}/><div><strong>{moods[marked.mood-1]}</strong><span className="muted small">Отметка за сегодня есть</span></div></div>
    <Button size="md" rightSection={<IconCheck size={19}/>} onClick={()=>navigate('/history')}>Открыть историю</Button>
   </section>:<Checkin data={data} onSaved={async()=>{await reload();navigate('/saved');}}/>}
   <div className="today-side"><SosButton userId={user.id} hasDoctor={!!data.doctor}/>
</div>
  </div>
 </>;
}
const daysAgo=(date:string)=>Math.round((Date.parse(today())-Date.parse(date))/86400000);
function SosButton({userId,hasDoctor}:{userId:string;hasDoctor:boolean}){
 const key='ryadom-sos-sent:'+userId;
 const readSent=():number|null=>{try{const t=Number(sessionStorage.getItem(key));return t&&Date.now()-t<30*60000?t:null;}catch{return null;}};
 const [sentAt,setSentAt]=useState<number|null>(readSent),[offline,setOffline]=useState(false);
 const [state,setState]=useState<'idle'|'confirm'|'busy'|'sent'|'error'>(()=>readSent()?'sent':'idle');
 async function send(){
  if(typeof navigator!=='undefined'&&navigator.onLine===false){setOffline(true);setState('error');return;}
  setOffline(false);setState('busy');
  try{await api('/patient/sos',{});const t=Date.now();setSentAt(t);try{sessionStorage.setItem(key,String(t));}catch{/* Storage is optional. */}setState('sent');}catch{setState('error');}
 }
 if(!hasDoctor)return <section className="sos-block"><p className="sos-confirm">Врач не подключён, поэтому сигнал некому отправить.</p><div className="sos-confirm-actions"><a className="sos-call" href="tel:112">Позвонить 112</a><Button variant="subtle" onClick={()=>navigate('/settings/connect')}>Подключить врача</Button></div></section>;
 if(state==='confirm'||state==='busy')return <section className="sos-block"><p className="sos-confirm">Отправить врачу сигнал «Мне сейчас плохо»?</p><div className="sos-confirm-actions"><Button className="sos-button" size="lg" onClick={send} loading={state==='busy'}>Да, отправить</Button><Button variant="default" size="lg" onClick={()=>setState('idle')} disabled={state==='busy'}>Отмена</Button></div><p className="small">Если опасно прямо сейчас, звоните <a href="tel:112">112</a>.</p></section>;
 if(state==='sent')return <section className="sos-block sos-sent" role="status"><p className="sos-sent-title">Сигнал отправлен{sentAt?` в ${new Date(sentAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:''}</p><p className="small">Врач получит его на почту и в уведомления. Если нужна помощь прямо сейчас, не ждите ответа: звоните <a href="tel:112">112</a>.</p><div className="sos-confirm-actions"><a className="sos-call" href="tel:112">Позвонить 112</a><Button variant="subtle" onClick={()=>setState('confirm')}>Отправить ещё раз</Button></div></section>;
 if(state==='error')return <section className="sos-block" role="alert"><p className="sos-confirm">{offline?'Нет подключения к интернету. Сигнал не отправлен.':'Не получилось отправить сигнал.'}</p><div className="sos-confirm-actions"><Button className="sos-button" size="lg" onClick={send}>Попробовать ещё раз</Button><a className="sos-call" href="tel:112">Позвонить 112</a></div></section>;
 return <section className="sos-block"><Button className="sos-button sos-trigger" size="lg" fullWidth onClick={()=>setState('confirm')}>Мне сейчас плохо</Button><p className="small">Врач получит сигнал на почту и в уведомления. Если нужна помощь прямо сейчас, звоните <a href="tel:112">112</a>.</p></section>;
}
function IconCalendarMark(){return <div className="calendar-mark"><IconClock size={23}/></div>}
function PracticeRow({practice}:{practice:typeof practiceContent[number]}){return <a className="practice-row" href={`#/practice/${practice.id}`}><div className="practice-info"><h3>{practice.title}</h3><p>{practice.subtitle}</p></div><span className="duration">{practice.time}</span><IconChevronRight className="practice-chevron" size={20}/></a>}
type Step={key:keyof EntryInput;title:string;description:string;type:'mood'|'choices'|'sleep'|'note';choices?:{value:number|string|boolean;label:string}[]};
function ScaleRow({label,options,value,onChange,ends}:{label:string;options:{value:number;label:string}[];value:number|null;onChange:(v:number)=>void;ends:[string,string]}){
 const shown=options;
 return <div className="scale-row" role="group" aria-label={label}>
  <p className={value===null?"scale-hint":"scale-hint scale-hint-chosen"}>{options.find(o=>o.value===value)?.label??"Не выбрано"}</p>
  <div className="scale-steps" style={{gridTemplateColumns:`repeat(${options.length},minmax(0,1fr))`}}>
   {shown.map(o=><button type="button" key={o.value} className={value===o.value?'scale-step selected':'scale-step'} aria-pressed={value===o.value} aria-label={o.label} onClick={()=>onChange(o.value)}><span className="scale-dot" aria-hidden="true"/><span className="scale-text">{o.label}</span></button>)}
  </div>
  <div className="scale-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>
 </div>;
}
function Checkin({data,onSaved}:{data:PatientData;onSaved:()=>Promise<void>}){
 const plan=data.draft?.entry.date===today()?data.draft.plan:data.plan;
 const [entry,setEntry]=useState<EntryInput>(data.draft?.entry.date===today()?data.draft.entry:{date:today(),mood:0,sleep:plan.sleep?8:null,anxiety:null,energy:null,functioning:null,sleepContext:null,note:'',habit:null});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const draft=useDraft({entry,plan,step:0},busy);
 const set=(patch:Partial<EntryInput>)=>setEntry(e=>{
  const next={...e,...patch};
  if(patch.sleep!==undefined&&(patch.sleep===null||Number(patch.sleep)>=6))next.sleepContext=null;
  return next;
 });
 async function save(){setBusy(true);setError('');try{await draft.drain();await api('/patient/checkins',entry);await onSaved();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const compact=typeof window!=='undefined'&&window.matchMedia('(max-width:700px)').matches;
 const sleepChips=[4,5,6,7,8,9];
 const [sleepOther,setSleepOther]=useState(entry.sleep!==null&&!sleepChips.includes(entry.sleep));
 const detailsFilled=[plan.sleep&&entry.sleep!==null,entry.note.trim().length>0].filter(Boolean).length;
 const detailsTotal=[plan.sleep].filter(Boolean).length+1;
 const [detailsOpen,setDetailsOpen]=useState(!compact||detailsFilled>0);
 return <form className="checkin-form" onSubmit={e=>{e.preventDefault();if(entry.mood>0)void save();}}>
  <h2>Отметка за сегодня</h2>
  <fieldset>
   <legend>Самочувствие</legend>
   <div className="checkin-moods" role="group" aria-label="Самочувствие">
    {moods.map((label,i)=><button type="button" key={label} className={entry.mood===i+1?'checkin-mood selected':'checkin-mood'} aria-label={label} aria-pressed={entry.mood===i+1} onClick={()=>set({mood:i+1})}>
     <Face value={i+1} size={36}/><span>{label.replace('Нейтрально','Нейтраль\u00ADно')}</span>
    </button>)}
   </div>
   <div className="scale-ends"><span>хуже</span><span>лучше</span></div>
  </fieldset>
   {plan.anxiety?<fieldset>
    <legend>Тревога</legend>
    <ScaleRow label="Тревога" options={['Очень сильная','Сильная','Умеренная','Небольшая','Не замечал(а)'].map((l,i)=>({value:i,label:l}))} value={entry.anxiety} onChange={v=>set({anxiety:v})} ends={['хуже','лучше']}/>
   </fieldset>:null}
   {plan.energy?<fieldset>
    <legend>Энергия</legend>
    <ScaleRow label="Энергия" options={['Очень мало','Мало','Как обычно','Много','Необычно много'].map((l,i)=>({value:i+1,label:l}))} value={entry.energy} onChange={v=>set({energy:v})} ends={['хуже','лучше']}/>
   </fieldset>:null}
   {plan.functioning?<fieldset>
    <legend>Обычные дела</legend>
    <ScaleRow label="Обычные дела" options={[{value:1,label:'Очень трудно'},{value:2,label:'С трудностями'},{value:3,label:'Без трудностей'}]} value={entry.functioning} onChange={v=>set({functioning:v})} ends={['хуже','лучше']}/>
   </fieldset>:null}
  <details className="checkin-details" open={detailsOpen} onToggle={e=>setDetailsOpen(e.currentTarget.open)}>
   <summary>Подробности, по желанию <span className="checkin-details-count">{detailsFilled} из {detailsTotal}</span></summary>
   <div className="checkin-details-body">
    {plan.sleep?<fieldset>
     <legend>Сон</legend>
     <div className="checkin-chips" role="group" aria-label="Сон, часов">
      {sleepChips.map(h=><button type="button" key={h} className={entry.sleep===h&&!sleepOther?'checkin-chip selected':'checkin-chip'} aria-pressed={entry.sleep===h&&!sleepOther} onClick={()=>{setSleepOther(false);set({sleep:entry.sleep===h?null:h});}}>{h} ч</button>)}
      <button type="button" className={sleepOther?'checkin-chip selected':'checkin-chip'} aria-pressed={sleepOther} onClick={()=>setSleepOther(v=>!v)}>Другое</button>
     </div>
     {sleepOther?<SleepInput value={entry.sleep} onChange={v=>set({sleep:v})} showTitle={false}/>:null}
     {entry.sleep!==null&&entry.sleep<6?<div className="checkin-chips" role="group" aria-label="После короткого сна">
      {([['tired','Усталость'],['usual','Как обычно'],['active','Много энергии']] as const).map(([v,l])=>
       <button type="button" key={v} className={entry.sleepContext===v?'checkin-chip selected':'checkin-chip'} aria-pressed={entry.sleepContext===v} onClick={()=>set({sleepContext:entry.sleepContext===v?null:v})}>{l}</button>)}
     </div>:null}
    </fieldset>:null}
    <fieldset>
     <legend>Заметка врачу</legend>
     <Textarea aria-label="Что хотите рассказать" placeholder="Что хотите рассказать" minRows={3} maxLength={2000} value={entry.note} onChange={e=>set({note:e.currentTarget.value})}/>
    </fieldset>
   </div>
  </details>
  {error?<ErrorBox message={error}/>:null}
  {draft.status?<p className="muted small">{draft.status}</p>:null}
  <Button type="submit" size="lg" fullWidth loading={busy} disabled={entry.mood<1} rightSection={<IconCheck size={19}/>}>Сохранить отметку</Button>
  {entry.mood<1?<p className="checkin-hint">Выберите самочувствие, чтобы сохранить отметку</p>:null}
 </form>;
}
export function History({entries,doctor=false}:{entries:Entry[];doctor?:boolean}){
 const [period,setPeriod]=useState('30');const [showAll,setShowAll]=useState(false);const compact=typeof window!=='undefined'&&window.matchMedia('(max-width:700px)').matches;const shortList=compact?7:14;const filtered=entries.filter(e=>(Date.parse(today())-Date.parse(e.date))/86400000<Number(period));
 return <><PageHead level={doctor?2:1} title={doctor?'Динамика состояния':'Ваша история'} description={doctor?'Самоотчёты пациента. Пропуски остаются пропусками.':'Самочувствие, сон и заметки по дням'} action={<Group><SegmentedControl value={period} onChange={setPeriod} data={[{value:'14',label:'14 дней'},{value:'30',label:'30 дней'},{value:'90',label:'90 дней'}]}/></Group>}/>
  {!entries.length?<Empty title="История начнётся с первой отметки" description={doctor?'Пациент пока не добавил записи':'В ней будут ваши ответы и заметки. Можно начать с сегодняшнего дня.'} action={doctor?undefined:'Сделать отметку'} onAction={()=>navigate('/checkin')} icon={<IconFileText size={30}/>} />:<>
   <details className="history-charts" open={!compact}><summary>Графики за период</summary><div className="chart-grid">
    <section className="chart-panel"><h3>Самочувствие</h3><p className="chart-caption">От «очень тяжело» до «очень хорошо»</p><HistoryChart entries={filtered} kind="mood" showTrend/></section>
    <section className="chart-panel"><h3>Сон</h3><p className="chart-caption">Продолжительность, часы</p><HistoryChart entries={filtered} kind="sleep" showTrend/></section>
    {doctor?<><section className="chart-panel"><h3>Тревога</h3><p className="chart-caption">Вверху меньше тревоги (4 — не замечал), внизу больше (0 — очень сильная)</p><HistoryChart entries={filtered} kind="anxiety" showTrend/></section>
    <section className="chart-panel"><h3>Энергия</h3><p className="chart-caption">От 1 (очень мало) до 5 (необычно много)</p><HistoryChart entries={filtered} kind="energy" showTrend/></section>
    <section className="chart-panel"><h3>Обычные дела</h3><p className="chart-caption">Вверху легче (3 — без трудностей), внизу тяжелее (1 — очень трудно)</p><HistoryChart entries={filtered} kind="functioning" showTrend/></section></>:null}
   </div>
   {!doctor?<details className="more-charts"><summary>Тревога, энергия и обычные дела</summary><div className="chart-grid">{([{kind:'anxiety',title:'Тревога',caption:'Вверху меньше тревоги (4 — не замечал), внизу больше (0 — очень сильная)'},{kind:'energy',title:'Энергия',caption:'От 1 (очень мало) до 5 (необычно много)'},{kind:'functioning',title:'Обычные дела',caption:'Вверху легче (3 — без трудностей), внизу тяжелее (1 — очень трудно)'}] as const).map(c=><section className="chart-panel" key={c.kind}><h3>{c.title}</h3><p className="chart-caption">{c.caption}</p><HistoryChart entries={filtered} kind={c.kind}/></section>)}</div></details>:null}
   </details>
   <div className="section-title history-title"><h2>Записи по дням</h2><span className="muted small">{filtered.length} записей за период</span>{doctor&&filtered.length>shortList?<Button variant="subtle" size="sm" onClick={()=>setShowAll(v=>!v)}>{showAll?'Свернуть':`Показать все (${filtered.length})`}</Button>:null}</div>
   {!filtered.length?<p className="muted">За выбранный период записей нет</p>:<div className="entries-list">{(doctor&&!showAll?filtered.slice(0,shortList):filtered).map(e=><article className={e.mood<=2?'entry-row hard':'entry-row'} data-scroll-anchor={`entry-${e.id}`} key={e.id}><div className="entry-date"><strong>{formatDate(e.date)}</strong><span>{new Date(e.date+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long'})}</span></div><div className="entry-body"><div className="entry-values"><span className="entry-mood"><Face value={e.mood} size={25}/>{moods[e.mood-1]}</span>{e.sleep!==null?<span><IconMoon size={16}/>{e.sleep} ч сна</span>:null}{e.anxiety!==null?<span>Тревога: {['очень сильная','сильная','умеренная','небольшая','не замечал(а)'][e.anxiety]}</span>:null}{e.energy!==null?<span>Энергия: {e.energy}/5</span>:null}{e.functioning!==null?<span>Обычные дела: {e.functioning===3?'без трудностей':e.functioning===2?'с трудностями':'очень трудно'}</span>:null}</div>{e.sleepContext?<p className="entry-context">После сна: {e.sleepContext==='active'?'необычно много энергии':e.sleepContext==='tired'?'усталость':'как обычно'}.</p>:null}{e.note?<p className="entry-note">{e.note}</p>:null}{e.updated_at?<small>Исправлена {new Date(e.updated_at).toLocaleString('ru-RU')}</small>:null}{!doctor&&true?<Button variant="subtle" size="sm" onClick={()=>navigate(`/edit/${e.id}`)}>Исправить запись</Button>:null}</div></article>)}</div>}
  </>}
 </>;
}
function PracticeFlow({practice,allowed,onSaved}:{practice:typeof practiceContent[number];allowed:boolean;onSaved:()=>Promise<void>}){
 const [index,setIndex]=useState(-1),[feedback,setFeedback]=useState<string|null>(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');const evaluating=index>=practice.steps.length;
 async function save(){setBusy(true);try{await api('/patient/practices',{practiceId:practice.id,feedback,note});setSaved(true);await onSaved();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 if(!allowed&&!saved)return <Empty title="Практика сейчас недоступна" description="Она отключена в плане или после неприятного опыта" icon={<IconLeaf/>} action="К списку практик" onAction={()=>navigate('/practices')}/>;
 if(saved)return <div className="success-panel"><div className="success-icon"><IconLeaf size={32}/></div><h1>{feedback==='unpleasant'?'Практика отключена':'Спасибо за отметку'}</h1><p>{feedback==='unpleasant'?'Она больше не будет предлагаться. Если захотите, её можно вернуть в настройках. Обсудите неприятный опыт с врачом.':'Ваш опыт сохранён в истории практик'}</p><Button onClick={()=>navigate('/practices')}>К практикам</Button></div>;
 const steps=practice.steps;const n=steps.length;const stepWord=n===1?'шаг':n<5?'шага':'шагов';
 if(index<0)return <div className="flow-wrap practice-flow"><button className="back-link" onClick={()=>navigate('/practices')}><IconArrowLeft size={17}/>Все практики</button><section className="practice-intro"><PracticeVisual id={practice.id} step="hero"/><p className="practice-meta">{practice.time} · {n} {stepWord}</p><h1>{practice.title}</h1><p className="practice-sub">{practice.subtitle}</p><p className="practice-lead">{practice.description}</p><p className="practice-safety">Можно остановиться на любом шаге. Если станет неприятно, выберите «Остановить практику».</p><details className="practice-method"><summary>Методика и источник</summary><p>{practice.methodology}</p><p>Источник: <a href={practice.source} target="_blank" rel="noreferrer">{practice.basis}</a></p></details><Button size="lg" fullWidth onClick={()=>setIndex(0)} rightSection={<IconArrowRight size={18}/>}>Начать</Button></section></div>;
 if(!evaluating)return <div className="practice-step-screen" role="region" aria-label={`${practice.title}, шаг ${index+1} из ${n}`}><div className="practice-step-top"><div className="practice-progress" role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={index+1} aria-label={`Шаг ${index+1} из ${n}`}>{steps.map((_,i)=><span key={i} className={i<=index?'done':''}/>)}</div><button className="practice-stop" onClick={()=>setIndex(n)}>Остановить практику</button></div><div className="practice-step-body" key={index}><PracticeVisual id={practice.id} step={index}/><p className="practice-meta">Шаг {index+1} из {n}</p><h1>{steps[index].title}</h1><p className="practice-step-text">{steps[index].text}</p></div><div className="practice-step-actions">{index>0?<Button size="lg" variant="default" onClick={()=>setIndex(index-1)} leftSection={<IconArrowLeft size={18}/>}>Назад</Button>:<Button size="lg" variant="default" onClick={()=>setIndex(-1)}>К описанию</Button>}<Button size="lg" onClick={()=>setIndex(index+1)} rightSection={<IconArrowRight size={18}/>}>{index===n-1?'Завершить':'Дальше'}</Button></div></div>;
 return <div className="flow-wrap practice-flow"><button className="back-link" onClick={()=>setIndex(n-1)}><IconArrowLeft size={17}/>Назад к шагам</button><section className="practice-focus"><PracticeVisual id={practice.id} step="hero" compact/><h1>Как вам было?</h1><p>Выберите, как вы чувствовали себя во время упражнения. Улучшение необязательно.</p><div className="answer-list">{[{value:'comfortable',label:'Комфортно'},{value:'same',label:'Без изменений'},{value:'unpleasant',label:'Неприятно'}].map(f=><button className={feedback===f.value?'answer selected':'answer'} key={f.value} onClick={()=>setFeedback(f.value)} aria-pressed={feedback===f.value}>{f.label}{feedback===f.value?<IconCheck size={18}/>:null}</button>)}</div><Textarea label="Что хочется рассказать врачу" description="Необязательно: что помогло или вызвало трудность" value={note} onChange={e=>setNote(e.currentTarget.value)} maxLength={1000} minRows={3} mb="md"/>{error?<ErrorBox message={error}/>:null}<Button loading={busy} disabled={!feedback} onClick={save}>Сохранить оценку</Button></section></div>;
}
function PatientSettings({data,user,onSaved,focusConnect=false,onLogout,themeLabel,onToggleTheme}:{data:PatientData;user:User;focusConnect?:boolean;onSaved:()=>Promise<void>;onLogout:()=>void;themeLabel:string;onToggleTheme:()=>void}){
 const connectionRef=useRef<HTMLElement>(null);useEffect(()=>{if(focusConnect){connectionRef.current?.focus({preventScroll:true});connectionRef.current?.scrollIntoView({block:'start'});}},[focusConnect]);
 const [settings,setSettings]=useState<Settings>(data.settings),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[revoke,setRevoke]=useState(false);
 const [invite,setInvite]=useState(new URLSearchParams(window.location.search).get('invite')||''),[doctorName,setDoctorName]=useState(''),[invitedProfile,setInvitedProfile]=useState<DoctorProfile|undefined>(),[consent,setConsent]=useState(false),[checking,setChecking]=useState(false);
 async function save(){setBusy(true);setSuccess('');setError('');try{await api('/settings',settings,'PUT');await onSaved();setSuccess('Настройки сохранены');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 function extractToken(){try{return new URL(invite).searchParams.get('invite')||invite;}catch{return invite.trim();}}
 async function preview(){setChecking(true);setError('');try{const result=await api<{doctorName:string;doctorProfile?:DoctorProfile}>(`/invites/${encodeURIComponent(extractToken())}`);setDoctorName(result.doctorName);setInvitedProfile(result.doctorProfile);}catch(e){setError(errorText(e));}finally{setChecking(false);}}
 async function accept(){setBusy(true);setError('');try{await api('/patient/accept',{token:extractToken(),consent});await onSaved();window.history.replaceState({},'',window.location.pathname+'#/settings');setDoctorName('');setSuccess('Врач подключён');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function disconnect(){setBusy(true);try{await api('/patient/revoke',{});await onSaved();setRevoke(false);setSuccess('Доступ врача отозван');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <><PageHead title="Настройки" description="Ваш ритм и доступ к вашим данным"/><section className="settings-panel settings-account"><h2>Аккаунт</h2><p className="muted">{user.name}</p><div className="account-actions"><Button variant="default" onClick={onToggleTheme}>{themeLabel}</Button><Button variant="default" color="red" onClick={onLogout}>Выйти из аккаунта</Button></div></section><div className="settings-layout"><section className="settings-panel"><h2>Время для отметки</h2><p className="muted">Выберите время для отметки. Расписание отображается внутри приложения.</p><TextInput type="time" label="Удобное время" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.currentTarget.value})}/><ReminderSettings settings={settings} onChange={setSettings}/><Switch label="Поставить расписание на паузу" checked={settings.paused} onChange={e=>setSettings({...settings,paused:e.currentTarget.checked})}/>{data.settings.blockedPractices.length?<><h3>Отключённые практики</h3><p className="muted small">После неприятного опыта практики не предлагаются. Верните их только если готовы.</p>{data.settings.blockedPractices.map(id=><Checkbox key={id} label={`Вернуть «${practiceContent.find(p=>p.id===id)?.title}»`} checked={!settings.blockedPractices.includes(id)} onChange={e=>setSettings({...settings,blockedPractices:e.currentTarget.checked?settings.blockedPractices.filter(x=>x!==id):[...settings.blockedPractices,id]})}/>)}</>:null}<Button onClick={save} loading={busy}>Сохранить настройки</Button></section><section className="settings-panel doctor-connection" ref={connectionRef} tabIndex={-1}><div className="section-title"><h2>Доступ к записям</h2><IconShieldCheck size={22}/></div><p>Ваши записи доступны только вам и вашему врачу после подключения по приглашению. Врач видит сведения профиля, дневник и заметки, результаты опросников, отметки о лекарствах, наблюдения, отзывы о практиках, личные цели и продвижение по ним, предыдущие рекомендации. Пока врач не подключён, записи видны только вам.</p>{data.doctor?<><div className="connected-doctor"><span className="connected-mark"><IconCheck size={20}/></span><div><strong>{data.doctor.name}</strong><p>Имеет доступ к вашей истории</p></div></div><p><a href="#/doctor">Подробнее о враче</a></p><p className="muted small">После отзыва доступа врач не сможет открывать ваши записи в приложении.</p><Button variant="outline" color="gray" onClick={()=>setRevoke(true)}>Отозвать доступ</Button></>:<><p className="muted">Вставьте ссылку, которую передал ваш врач. Доступ появится только после вашего подтверждения.</p><TextInput label="Ссылка или код приглашения" placeholder="Вставьте приглашение" value={invite} onChange={e=>{setInvite(e.currentTarget.value);setDoctorName('');setConsent(false);}}/><Button variant="light" onClick={preview} loading={checking} disabled={!invite.trim()}>Проверить приглашение</Button>{doctorName?<div className="consent-box"><strong>Врач: {doctorName}</strong><DoctorProfileDetails name={doctorName} profile={invitedProfile}/><p>Врач получит доступ к сведениям вашего профиля, прошлым и новым отметкам, заметкам, ответам на опросники, назначениям и отметкам о лекарствах, наблюдениям, оценкам практик, личным целям и отметкам продвижения, предыдущим рекомендациям. В кабинете отображаются до 365 последних отметок и 100 оценок практик. Врач сможет менять план наблюдения.</p><Checkbox label="Разрешаю этому врачу доступ к моей истории" checked={consent} onChange={e=>setConsent(e.currentTarget.checked)}/><Button onClick={accept} disabled={!consent} loading={busy}>Подключить врача</Button></div>:null}</>}</section></div>{error?<ErrorBox message={error}/>:null}{success?<Alert color="forest" role="status" mt="md" icon={<IconCheck size={18}/>}>{success}</Alert>:null}<section className="account-details"><h3>Ваш аккаунт</h3><Button variant="light" onClick={()=>window.dispatchEvent(new Event('show-onboarding'))}>Как пользоваться Рядом</Button><p>{user.name}, {user.email}</p></section><ProfileSettings user={user}/><AccountSettings user={user}/><Modal opened={revoke} onClose={()=>setRevoke(false)} title="Отозвать доступ врача?" centered><p>Ваша история останется в аккаунте. Врач перестанет видеть её и менять план наблюдения.</p><Group mt="lg" justify="flex-end"><Button variant="subtle" onClick={()=>setRevoke(false)}>Оставить доступ</Button><Button onClick={disconnect} loading={busy}>Отозвать доступ</Button></Group></Modal></>;
}
