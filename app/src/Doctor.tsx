import {useSectionScroll} from './useSectionScroll';
import {Goals} from './Goals';
import {AppointmentOverview} from './AppointmentOverview';
import {PracticeReview} from './PracticeReview';
import {DoctorInvites} from './DoctorInvites';
import {ProfileSettings,PatientProfileDetails} from './ProfileSettings';
import { useRefreshOnReturn } from './useRefreshOnReturn';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Avatar, Button, Checkbox, Group, Loader, Modal, SegmentedControl, Select, Tabs, Textarea, TextInput } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconCheck, IconCopy, IconDownload, IconLink, IconSearch, IconUsers } from '@tabler/icons-react';
import { api,errorText } from './api';
import { Empty,ErrorBox,formatDate,PageHead } from './ui';
import { History } from './History';
import {AccountSettings} from './AccountSettings';
import {DoctorReminders} from './DoctorReminders';
import {Treatment,AssessmentResults,AssessmentReview} from './Care';
import {assessmentContent,standardKinds} from './assessments';
import { csvCell } from './report';
import { practiceContent } from './practices';
import { navigate } from './App';
import { plural, attentionFlags, canPrescribe, signals, today, type Assessment, type PatientData, type PatientRow, type Plan, type PatientProfile, type User } from './shared';
export function DoctorWorkspace({user,route}:{user:User;route:string}){
 useSectionScroll(route.startsWith('/patient/')?null:`${user.id}:${route}`);
 const [patients,setPatients]=useState<PatientRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[listFilter,setListFilter]=useState('all'),[inviting,setInviting]=useState(false),[invite,setInvite]=useState<{token:string;expires:number}|null>(null),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 const reload=useCallback(async()=>{setError('');try{setPatients((await api<{patients:PatientRow[]}>('/doctor/patients')).patients);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 const showingList=!route.startsWith('/patient/')&&!['/settings','/profile','/code'].includes(route);
 const refreshList=useCallback(async()=>{if(showingList)await reload();},[reload,showingList]);
 useEffect(()=>{void refreshList();},[refreshList]);
 useRefreshOnReturn(refreshList);
 async function createInvite(){if(invite&&invite.token){setInviting(true);return;}setBusy(true);setError('');try{const list=await api<{invites:{id:number;expires:number;token:string|null}[]}>('/doctor/invites');const reusable=list.invites.find(i=>i.token);if(reusable){setInvite({token:reusable.token!,expires:reusable.expires});setInviting(true);setCopied(false);return;}const result=await api<{token:string;expires:number}>('/doctor/invites',{});setInvite(result);setInviting(true);setCopied(false);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const link=invite?`${window.location.origin}/?invite=${invite.token}`:'';
 async function copy(){try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setError('Не удалось скопировать. Выделите ссылку и скопируйте вручную.');}}
 if(route.startsWith('/admin')){if(typeof window!=='undefined')window.location.hash='/patients';return null;}
 if(route.startsWith('/patient/'))return <PatientDetail key={route.split('/')[2]} id={route.split('/')[2]} doctorId={user.id} canRx={canPrescribe(user)}/>;
 if(route==='/profile')return <><PageHead title="Профиль" description="Как вас видят пациенты"/><ProfileSettings user={user}/></>;
 if(route==='/code')return <><PageHead title="Приглашения" description="Одноразовые ссылки, чтобы подключить пациента"/><DoctorInvites/></>;
 if(route==='/settings')return <><PageHead title="Настройки" description="Аккаунт, уведомления и безопасность"/><section className="settings-panel narrow"><h2>{user.name}</h2><Button variant="light" onClick={()=>window.dispatchEvent(new Event('show-onboarding'))}>Как пользоваться Рядом</Button><p>{user.email}</p><p className="muted">Пациенты подключаются по приглашению и могут отозвать доступ. Для каждого пациента укажите реальный режим просмотра записей в плане наблюдения.</p></section><DoctorReminders emailVerified={!!user.email_verified_at}/><AccountSettings user={user}/></>;
 const filtered=patients.filter(p=>p.name.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))&&(listFilter==='all'||(listFilter==='attention'?attentionFlags(p,today()).length>0:listFilter==='new'?(p.pending_reports+p.pending_assessments+(p.pending_practices??0)+(p.pending_goals??0))>0:!p.count)));
 return <><PageHead title="Ваши пациенты" description="История, план наблюдения и записи пациента" action={<Button leftSection={<IconLink size={18}/>} onClick={createInvite} loading={busy}>Пригласить пациента</Button>}/>{error?<ErrorBox message={error} retry={reload}/>:null}{loading?<div className="section-loading"><Loader/><p>Загружаем пациентов…</p></div>:patients.length?<><div className="patients-toolbar"><TextInput placeholder="Найти пациента" aria-label="Найти пациента" leftSection={<IconSearch size={18}/>} value={search} onChange={e=>setSearch(e.currentTarget.value)}/><Select aria-label="Какие пациенты" value={listFilter} onChange={v=>setListFilter(v||'all')} data={[{value:'attention',label:'Требуют внимания'},{value:'all',label:'Все пациенты'},{value:'new',label:'Новые материалы'},{value:'empty',label:'Без отметок'}]}/><span className="muted small patients-count">Показано: {filtered.length} из {patients.length}</span></div><div className="patient-table"><div className="patient-table-head"><span>Пациент</span><span>Последняя отметка</span><span>Самочувствие</span><span>Записи</span></div>{filtered.map(p=><a className="patient-table-row" href={`#/patient/${p.id}`} key={p.id}><div className="patient-name"><Avatar radius="xl" color="forest" size={42}>{p.name.slice(0,1)}</Avatar><div><strong>{p.name}</strong>{attentionFlags(p,today()).map(f=><small className="patient-report-badge" key={f.key}>{f.label}</small>)}{(p.pending_reports+p.pending_assessments+(p.pending_practices??0)+(p.pending_goals??0))>0?<small className="patient-report-badge">Новых материалов: {p.pending_reports+p.pending_assessments+(p.pending_practices??0)+(p.pending_goals??0)}</small>:null}</div></div><div className="patient-cell"><small>Последняя отметка</small><span>{p.last_date?formatDate(p.last_date,true):'Пока нет отметок'}</span></div><div className="patient-cell"><small>Самочувствие</small><span>{p.last_mood?['Очень тяжело','Тяжело','Нейтрально','Хорошо','Очень хорошо'][p.last_mood-1]:'Нет данных'}</span></div><div className="patient-count"><span>{p.count}</span><IconArrowRight size={18}/></div></a>)}</div>{!filtered.length?<Empty title="Ничего не найдено" description="Попробуйте другую часть имени" icon={<IconSearch size={27}/>}/>:null}</>:<section className="doctor-empty"><Empty title="Начните с одного пациента" description="Передайте пациенту приглашение. После подключения выберите вопросы и практики, а перед приёмом откройте его историю и сводку." action="Создать приглашение" onAction={createInvite} icon={<IconUsers size={34}/>}/><div className="onboarding-steps"><div><span>1</span><strong>Передайте ссылку</strong><p>Одноразовое приглашение действует 7 дней</p></div><div><span>2</span><strong>Согласуйте наблюдение</strong><p>Выберите вопросы, частоту и подходящие практики</p></div><div><span>3</span><strong>Обсудите динамику</strong><p>Просмотрите историю перед следующим приёмом</p></div></div></section>}<Modal opened={inviting} onClose={()=>setInviting(false)} title="Приглашение пациенту" centered size="lg"><p className="muted">Передайте ссылку пациенту. Его записи появятся в вашем кабинете после регистрации и подтверждения доступа.</p><TextInput label="Одноразовая ссылка" value={link} readOnly onFocus={e=>e.currentTarget.select()}/><p className="muted small">Действует до {invite?new Date(invite.expires).toLocaleDateString('ru-RU'):''}. Приглашение не даёт доступ без согласия пациента.</p><Group justify="flex-end"><Button variant="subtle" onClick={()=>setInviting(false)}>Закрыть</Button><Button leftSection={copied?<IconCheck size={18}/>:<IconCopy size={18}/>} onClick={copy}>{copied?'Скопировано':'Скопировать ссылку'}</Button></Group></Modal></>;
}
function PatientDetail({id,doctorId,canRx}:{id:string;doctorId:string;canRx:boolean}){
 const [planSection,setPlanSection]=useState(()=>{try{return sessionStorage.getItem('ryadom-doctor-plan')||'track';}catch{return 'track';}});
 const [data,setData]=useState<(PatientData&{patient:{id:string;name:string;profile?:PatientProfile}})|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[tab,setTab]=useState<string|null>(()=>{try{const saved=sessionStorage.getItem('ryadom-doctor-tab');return saved&&['overview','goals','history','plan'].includes(saved)?saved:'overview';}catch{return 'overview';}});
 useSectionScroll(`${doctorId}:/patient/${id}:${tab??'overview'}`);
 const [visited,setVisited]=useState<Set<string>>(()=>new Set(['overview',tab??'overview']));
 function openTab(value:string|null){if(!value)return;const next=value==='assessments'||value==='practices'?'history':value;try{sessionStorage.setItem('ryadom-doctor-tab',next);}catch{/* Optional navigation memory. */}setTab(next);setVisited(current=>current.has(next)?current:new Set([...current,next]));requestAnimationFrame(()=>{window.scrollTo({top:0,behavior:'instant'});});}
 const reload=useCallback(async()=>{setError('');try{const result=await api<PatientData&{patient:{id:string;name:string;profile?:PatientProfile}}>(`/doctor/patients/${id}/data`);setData(result);setTab(current=>current??'overview');}catch(e){setData(null);setError(errorText(e));}finally{setLoading(false);}},[id]);
 useEffect(()=>{setLoading(true);reload();},[reload]);
 useRefreshOnReturn(reload);
 function exportCsv(){if(!data)return;const quote=csvCell;const csv=[['Дата','Самочувствие 1–5','Сон, часы','Тревога 0–4 (4 — без тревоги)','Энергия 1–5','Обычные дела 1–3 (3 — без трудностей)','Заметка'],...data.entries.map(e=>[e.date,e.mood,e.sleep,e.anxiety,e.energy,e.functioning,e.note])].map(row=>row.map(quote).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='patient-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(loading)return <div className="section-loading"><Loader/><p>Загружаем историю пациента…</p></div>;
 if(!data)return <><button className="back-link" onClick={()=>navigate('/patients')}><IconArrowLeft size={17}/>Все пациенты</button><ErrorBox message={error} retry={reload}/></>;
 const facts=signals(data.entries);
 return <><button className="back-link" onClick={()=>navigate('/patients')}><IconArrowLeft size={17}/>Все пациенты</button><PageHead title={data.patient.name} action={tab==='history'?<Button variant="outline" leftSection={<IconDownload size={17}/>} onClick={exportCsv} disabled={!data.entries.length}>Экспорт CSV</Button>:undefined}/>{tab==='history'&&facts.length?<div className="observations"><h3>Изменения для обсуждения</h3>{facts.map(f=><p key={f}>{f}</p>)}<small>Наблюдаемые ответы. Клиническую значимость оценивает врач.</small></div>:null}<PatientProfileDetails profile={data.patient.profile}/><Tabs value={tab} onChange={openTab}><div className="doctor-section-menu"><label htmlFor="doctor-section">Раздел карточки пациента</label><select id="doctor-section" value={tab??'overview'} onChange={e=>openTab(e.target.value)}>{[{value:'overview',label:'Обзор'},{value:'goals',label:'Цели'},{value:'history',label:'История'},{value:'plan',label:'План наблюдения'},].map(section=><option key={section.value} value={section.value}>{section.label}</option>)}</select></div><Tabs.List mb="xl" className="doctor-section-tabs"><Tabs.Tab value="overview">Обзор</Tabs.Tab><Tabs.Tab value="goals">Цели</Tabs.Tab><Tabs.Tab value="history">История</Tabs.Tab><Tabs.Tab value="plan">План наблюдения</Tabs.Tab></Tabs.List><Tabs.Panel value="overview">{visited.has('overview')?<AppointmentOverview data={data} onOpen={openTab}/>:null}</Tabs.Panel><Tabs.Panel value="goals">{visited.has('goals')?<Goals data={data} doctor id={id} onSaved={reload}/>:null}</Tabs.Panel><Tabs.Panel value="history">{visited.has('history')?<><History entries={data.entries} doctor/><AssessmentReview assessments={data.assessments.filter(a=>a.doctor_id===data.doctor?.id)} doctor id={id} onSaved={reload} currentDoctorId={data.doctor?.id}/><PracticeReview data={data} id={id} onSaved={reload}/></>:null}</Tabs.Panel><Tabs.Panel value="plan">{visited.has('plan')?((()=>{const mine=data.assessments.filter(a=>a.doctor_id===data.doctor?.id);const go=(v:string|null)=>{setPlanSection(v??'track');try{sessionStorage.setItem('ryadom-doctor-plan',v??'track');}catch{/* Storage is optional. */}};return <div className="plan-sections"><SegmentedControl fullWidth mb="xl" value={planSection} onChange={go} data={[{value:'track',label:'Отслеживаем'},{value:'surveys',label:'Опросники'},{value:'visit',label:'Записи приёма'}]}/>{planSection==='track'?<><h2 className="plan-group-title">Что отслеживаем</h2><PlanForm initial={data.plan} id={id} onSaved={reload} assessments={mine}/></>:null}{planSection==='surveys'?<><AssessmentResults assessments={mine} doctor id={id} onSaved={reload}/></>:null}{planSection==='visit'?<><Treatment data={data} doctor id={id} onSaved={reload} canRx={canRx}/></>:null}</div>;})()):null}</Tabs.Panel></Tabs></>;
}
function PlanForm({initial,id,onSaved,assessments}:{initial:Plan;id:string;onSaved:()=>Promise<void>;assessments:Assessment[]}){
 const [plan,setPlan]=useState<Plan>(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 const assignedKinds=new Set(assessments.map(a=>a.kind));
 const [chosen,setChosen]=useState<Set<string>>(()=>new Set(assessments.filter(a=>!a.completed_at&&a.doctor_id).map(a=>a.kind)));
 const [phq9Contact,setPhq9Contact]=useState(''),[phq9Note,setPhq9Note]=useState('');
 async function save(){
  setBusy(true);setError('');setSuccess(false);
  try{
   await api(`/doctor/patients/${id}/plan`,plan,'PUT');
   const due=today();
   for(const kind of standardKinds){
    const already=assessments.some(a=>a.kind===kind);
    const want=chosen.has(kind);
    if(want&&!already){
     if(kind==='phq9'){
      if(phq9Contact.trim().length<5||phq9Note.trim().length<5){setError('Для PHQ-9 укажите способ связи и порядок просмотра');setBusy(false);return;}
      await api(`/doctor/patients/${id}/assessments`,{kind,dueDate:due,safety:{contact:phq9Contact,reviewNote:phq9Note,confirmed:true}});
     }else{
      await api(`/doctor/patients/${id}/assessments`,{kind,dueDate:due});
     }
    }
   }
   await onSaved();setSuccess(true);
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <div className="plan-simple">
  <section>
   <h2>Вопросы дня</h2>
   <Select label="Частота" value={plan.frequency} onChange={v=>setPlan({...plan,frequency:v as Plan['frequency']})} data={[{value:'daily',label:'Каждый день'},{value:'three',label:'Три раза в неделю'},{value:'weekly',label:'Раз в неделю'}]}/>
   <div className="plan-checks">{([{key:'sleep',label:'Сон'},{key:'anxiety',label:'Тревога'},{key:'energy',label:'Энергия'},{key:'functioning',label:'Обычные дела'}] as const).map(p=><Checkbox key={p.key} label={p.label} checked={plan[p.key]} onChange={e=>setPlan({...plan,[p.key]:e.currentTarget.checked})}/>)}</div>
  </section>
  <section>
   <h2>Что обсудить с пациентом</h2>
   <Textarea label="Привычка пациента" description="Например: прогулка после ужина. Пациент увидит это в своих настройках." value={plan.habit} onChange={e=>setPlan({...plan,habit:e.currentTarget.value})} maxLength={180} minRows={1} autosize/>
   <Textarea label="Порядок просмотра записей" description="Обязательный текст, минимум 5 символов. Пациент прочитает его в своих настройках." value={plan.reviewNote} onChange={e=>setPlan({...plan,reviewNote:e.currentTarget.value})} maxLength={500} minRows={2} required/>
  </section>
  <section>
   <h2>Практики</h2>
   {plan.practices.length?<div className="plan-list">
    {plan.practices.map(id=>{const p=practiceContent.find(x=>x.id===id);if(!p)return null;return <label className="plan-row" key={id}>
     <Checkbox checked onChange={e=>setPlan({...plan,practices:e.currentTarget.checked?plan.practices:[...plan.practices.filter(x=>x!==id)]})}/>
     <span className="plan-row-main"><strong>{p.title}</strong><span className="muted small">{p.time}</span></span>
     <a className="source-link" href={p.source} target="_blank" rel="noreferrer">Источник</a>
    </label>;})}
   </div>:<p className="muted">В плане пока нет практик.</p>}
   <details className="plan-more" open={!plan.practices.length}>
    <summary>Добавить другие практики — ещё {practiceContent.length-plan.practices.length}</summary>
    <div className="plan-list">
     {practiceContent.filter(p=>!plan.practices.includes(p.id)).map(p=><label className="plan-row" key={p.id}>
      <Checkbox checked={false} onChange={e=>setPlan({...plan,practices:e.currentTarget.checked?[...plan.practices,p.id]:plan.practices})}/>
      <span className="plan-row-main"><strong>{p.title}</strong><span className="muted small">{p.time} · {p.category}</span></span>
      <a className="source-link" href={p.source} target="_blank" rel="noreferrer">Источник</a>
     </label>)}
    </div>
   </details>
  </section>
  <section>
   <h2>Опросники пациенту</h2>
   <div className="plan-list">
    {standardKinds.map(kind=>{
     const already=assignedKinds.has(kind);
     return <div key={kind}>
      <label className="plan-row">
       <Checkbox checked={already||chosen.has(kind)} disabled={already} onChange={e=>{
        const next=new Set(chosen);
        if(e.currentTarget.checked)next.add(kind);else next.delete(kind);
        setChosen(next);
       }}/>
       <span className="plan-row-main"><strong>{assessmentContent[kind].title}</strong><span className="muted small">{already?(assessments.some(a=>a.kind===kind&&a.completed_at)?'Пройден':'Ждёт ответа пациента'):`${assessmentContent[kind].items.length} ${plural(assessmentContent[kind].items.length,'вопрос','вопроса','вопросов')}`}</span></span>
       <a className="source-link" href={assessmentContent[kind].source} target="_blank" rel="noreferrer">Источник</a>
      </label>
      {kind==='phq9'&&!already&&chosen.has('phq9')?<div className="plan-phq9">
       <TextInput label="Связь с врачом" value={phq9Contact} onChange={e=>setPhq9Contact(e.currentTarget.value)} maxLength={300}/>
       <TextInput label="Порядок просмотра ответов" value={phq9Note} onChange={e=>setPhq9Note(e.currentTarget.value)} maxLength={500}/>
      </div>:null}
     </div>;
    })}
   </div>
  </section>
  <div className="plan-save">
   {error?<ErrorBox message={error}/>:null}
   {success?<Alert color="forest" role="status" icon={<IconCheck size={17}/>}>План сохранён</Alert>:null}
   <Button onClick={save} loading={busy} disabled={plan.reviewNote.trim().length<5}>Сохранить план</Button>
  </div>
 </div>;
}
