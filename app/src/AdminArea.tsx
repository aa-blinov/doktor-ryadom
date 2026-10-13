import {useCallback,useEffect,useState} from 'react';
import {Button,Loader,NativeSelect,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageHead,formatDate} from './ui';
import {AdminVerifications} from './AdminVerifications';
import {AccountSettings} from './AccountSettings';
import {specialtyKinds,specialtyLabels,type SpecialtyKind,type User} from './shared';
import {Stars} from './DoctorDirectory';
type Doctor={id:string;name:string;email:string;created_at:number;blocked_at:number|null;specialist_verified_at:number|null;specialty_kind:SpecialtyKind|null;request_status:string|null;request_specialty:string|null;request_kind:SpecialtyKind|null;profile_specialty:string|null};
type Patient={id:string;created_at:number;blocked_at:number|null};
const requestText:Record<string,string>={pending:'заявка на проверке',needs_info:'нужны уточнения',rejected:'заявка отклонена',approved:'подтверждён'};
export function AdminArea({route,user}:{route:string;user:User}){
 if(route==='/settings')return <AccountSettings user={user}/>;
 if(route==='/admin/doctors')return <AdminDoctors/>;
 if(route==='/admin/patients')return <AdminPatients/>;
 if(route==='/admin/reviews')return <AdminReviews/>;
 if(route==='/admin/audit')return <AdminAudit/>;
 return <AdminVerifications/>;
}
function BlockButton({blocked,busy,onClick}:{blocked:boolean;busy:boolean;onClick:()=>void}){
 return <Button className={blocked?undefined:'danger-button'} variant={blocked?'outline':'subtle'} color={blocked?undefined:'red'} loading={busy} onClick={onClick}>{blocked?'Разблокировать':'Заблокировать'}</Button>;
}
function AdminDoctors(){
 const [doctors,setDoctors]=useState<Doctor[]>([]),[q,setQ]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[undone,setUndone]=useState<{id:string;who:string}|null>(null);
 const load=useCallback(async()=>{setError('');try{const r=await api<{doctors:Doctor[]}>(`/admin/doctors${q.trim()?`?q=${encodeURIComponent(q.trim())}`:''}`);setDoctors(r.doctors);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[q]);
 useEffect(()=>{void load();},[load]);
 async function toggle(d:Doctor){if(!d.blocked_at&&!window.confirm(`Заблокировать ${d.name}? Вход закроется, и при следующем открытии пользователь увидит, что аккаунт заблокирован.`))return;setBusy(d.id);setError('');try{await api(`/admin/accounts/${d.id}/block`,{blocked:!d.blocked_at});setUndone(d.blocked_at?null:{id:d.id,who:`Врач ${d.name}`});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 async function setKind(d:Doctor,kind:SpecialtyKind|''){setBusy(d.id);setError('');try{await api(`/admin/doctors/${d.id}/kind`,{kind:kind||null});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 return <><PageHead title="Врачи" description="Все врачи портала, тип специальности и статус проверки. Блокировка закрывает вход и завершает сессии"/>
  <TextInput label="Поиск по имени или почте" value={q} onChange={e=>setQ(e.currentTarget.value)} mb="var(--sp-4)"/>
  {doctors.length>=300?<p className="muted small list-cap">Показаны первые 300 врачей. Для остальных пользуйтесь поиском.</p>:null}
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {!loading&&!error&&!doctors.length?<p className="muted">{q.trim()?'Поиск ничего не нашёл':'Врачей пока нет'}</p>:null}
  {undone?<div className="admin-undo" role="status"><span>{undone.who} заблокирован. Это было сделано только что.</span><Button variant="subtle" size="xs" onClick={async()=>{const id=undone?.id;setUndone(null);if(id){setBusy(id);try{await api(`/admin/accounts/${id}/block`,{blocked:false});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}}}>Отменить</Button></div>:null}
  <div className="admin-list">{doctors.map(d=><article className="care-record admin-card" key={d.id}>
   <h2>{d.name}{d.blocked_at?' · заблокирован':''}</h2>
   <p className="muted small">{d.email} · создан {formatDate(new Date(d.created_at).toISOString().slice(0,10))}</p>
   <p className="small">{d.specialist_verified_at?'Подтверждён':d.request_status?requestText[d.request_status]??'не подтверждён':'не подтверждён, заявки нет'}</p>
   <>
    <p className="small admin-specialty"><span className={`pill kind-${d.specialty_kind??'none'}`}>{d.specialty_kind?specialtyLabels[d.specialty_kind]:'Тип не указан'}</span>{d.profile_specialty||d.request_specialty?<span className="muted">{d.profile_specialty||d.request_specialty}</span>:null}</p>
    <NativeSelect label="Тип специалиста" description={d.specialist_verified_at?'Исправьте по диплому. Подтверждение врача от этого не снимается':'Проверьте по специальности в дипломе'} value={d.specialty_kind??''} onChange={e=>void setKind(d,e.currentTarget.value as SpecialtyKind|'')} data={d.specialist_verified_at?specialtyKinds.map(k=>({value:k,label:specialtyLabels[k]})):[{value:'',label:'Тип не указан'},...specialtyKinds.map(k=>({value:k,label:specialtyLabels[k]}))]}/>
   </>
   <BlockButton blocked={!!d.blocked_at} busy={busy===d.id} onClick={()=>void toggle(d)}/>
  </article>)}</div>
 </>;
}
function AdminPatients(){
 const [patients,setPatients]=useState<Patient[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[undone,setUndone]=useState<{id:string;who:string}|null>(null);
 const load=useCallback(async()=>{setError('');try{const r=await api<{patients:Patient[]}>('/admin/patients');setPatients(r.patients);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function toggle(p:Patient){if(!p.blocked_at&&!window.confirm(`Заблокировать пациента №${patients.indexOf(p)+1}? Вход закроется, и при следующем открытии пользователь увидит, что аккаунт заблокирован. Разблокировать можно кнопкой в списке или сразу после блокировки.`))return;setBusy(p.id);setError('');try{await api(`/admin/accounts/${p.id}/block`,{blocked:!p.blocked_at});setUndone(p.blocked_at?null:{id:p.id,who:`Пациент №${patients.indexOf(p)+1}`});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 return <><PageHead title="Пациенты" description="Имена и почты пациентов администратору не показываются. Видны только даты и статус аккаунта"/>
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {patients.length>=200?<p className="muted small list-cap">Показаны первые 200 пациентов.</p>:null}
  {!loading&&!error&&!patients.length?<p className="muted">Пациентов пока нет</p>:null}
  {undone?<div className="admin-undo" role="status"><span>{undone.who} заблокирован. Это было сделано только что.</span><Button variant="subtle" size="xs" onClick={async()=>{const id=undone?.id;setUndone(null);if(id){setBusy(id);try{await api(`/admin/accounts/${id}/block`,{blocked:false});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}}}>Отменить</Button></div>:null}
  <div className="admin-list">{patients.map((p,i)=><article className="care-record admin-card" key={p.id}>
   <h2>Пациент {i+1}{p.blocked_at?' · заблокирован':''}</h2>
   <p className="muted small">Аккаунт создан {formatDate(new Date(p.created_at).toISOString().slice(0,10))}</p>
   <BlockButton blocked={!!p.blocked_at} busy={busy===p.id} onClick={()=>void toggle(p)}/>
  </article>)}</div>
 </>;
}
type Event={action:string;action_label?:string;subject_id:string|null;subject_name?:string|null;created_at:number;actor_name:string|null;actor_role:string|null};

function AdminAudit(){
 const [events,setEvents]=useState<Event[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[hasMore,setHasMore]=useState(true),[error,setError]=useState(''),[actionFilter,setActionFilter]=useState(''),[known,setKnown]=useState<Record<string,string>>({});
 // The filter goes to the server so that "показать ещё" keeps paging through the same action.
 const load=useCallback(async(offset:number)=>{setBusy(true);setError('');try{const r=await api<{events:Event[];limit:number}>(`/admin/audit?limit=200&offset=${offset}${actionFilter?`&action=${encodeURIComponent(actionFilter)}`:''}`);setEvents(prev=>offset?[...prev,...r.events]:r.events);setHasMore(r.events.length>=200);setKnown(prev=>{const next={...prev};for(const e of r.events)next[e.action]=e.action_label??e.action;return next;});}catch(e){setError(errorText(e));}finally{setLoading(false);setBusy(false);}},[actionFilter]);
 useEffect(()=>{void load(0);},[load]);
 return <><PageHead title="Журнал действий" description="Кто и что сделал в портале. Содержимое записей здесь не показывается"/>
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error}/>:null}
  {Object.keys(known).length?<NativeSelect mb="var(--sp-4)" label="Тип события" value={actionFilter} onChange={e=>setActionFilter(e.currentTarget.value)} data={[{value:'',label:'Все события'},...Object.entries(known).map(([value,label])=>({value,label}))]}/>:null}
  {!loading&&!error&&!events.length?<p className="muted">{actionFilter?'Событий такого типа пока нет':'Событий пока нет'}</p>:null}
   <div className="admin-list">{events.map((e,i)=><article className="care-record" key={`${e.created_at}-${i}`}>
   <p><strong>{e.action_label??e.action}</strong>{e.subject_name?<span className="muted"> · {e.subject_name}</span>:null}</p>
   <p className="muted small">{new Date(e.created_at).toLocaleString('ru-RU')} · {e.actor_name??(e.actor_role==='patient'||e.actor_role==='пациент'?'Пациент':'Система')}{e.actor_role&&e.actor_role!=='patient'&&e.actor_role!=='пациент'?` (${e.actor_role==='admin'?'администратор':e.actor_role==='doctor'?'врач':e.actor_role})`:''}</p>
  </article>)}</div>
  {hasMore&&!loading&&!error?<Button mt="var(--sp-4)" variant="outline" loading={busy} onClick={()=>void load(events.length)}>Показать ещё</Button>:null}
 </>;
}

function AdminReviews(){
 type Row={id:string;rating:number;body:string;createdAt:number;hidden:boolean;author:string;doctor:string};
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{setRows((await api<{reviews:Row[]}>('/admin/reviews')).reviews);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function toggle(r:Row){setBusy(r.id);setError('');try{await api(`/admin/reviews/${r.id}/hide`,{hidden:!r.hidden});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 return <><PageHead title="Отзывы о врачах" description="Отзывы публикуются сразу. Скрытый отзыв пропадает из каталога и из рейтинга"/>
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {!loading&&!error&&!rows.length?<p className="muted">Отзывов пока нет</p>:null}
  <div className="admin-list">{rows.map(r=><article className={`care-record admin-card${r.hidden?' resolved':''}`} key={r.id}>
   <div className="admin-card-head"><h3>{r.doctor}</h3><span className={r.hidden?'pill status-rejected':'pill status-approved'}>{r.hidden?'Скрыт':'Опубликован'}</span></div>
   <p className="muted small">{r.author} · {formatDate(new Date(r.createdAt).toISOString().slice(0,10))}</p>
   <Stars value={r.rating} size={16}/>
   {r.body?<p className="care-prose">{r.body}</p>:null}
   <Button className={r.hidden?undefined:'danger-button'} variant={r.hidden?'outline':'subtle'} color={r.hidden?undefined:'red'} loading={busy===r.id} onClick={()=>void toggle(r)}>{r.hidden?'Вернуть отзыв':'Скрыть отзыв'}</Button>
  </article>)}</div>
 </>;
}
