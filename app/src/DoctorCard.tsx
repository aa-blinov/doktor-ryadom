import {useCallback,useEffect,useState} from 'react';
import {Button,NativeSelect,Textarea,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageLoader} from './ui';

type Entry={id:string;kind:string;kindLabel:string;body:string;occurredOn:string;createdAt:number;authorName:string;mine:boolean;withdrawn:boolean;withdrawReason:string|null};
const KINDS=[{value:'visit_summary',label:'Итоги приёма'},{value:'diagnosis',label:'Диагноз'},{value:'treatment',label:'Назначение и план лечения'},{value:'referral',label:'Направление'},{value:'other',label:'Запись'}];
const todayIso=()=>new Date().toISOString().slice(0,10);

// The doctor's part of the patient card: the entries written by every doctor who treats this patient.
// Entries are never edited or erased; a mistake is withdrawn by its author with a reason.
export function DoctorPatientCard({patientId}:{patientId:string}){
 const [entries,setEntries]=useState<Entry[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState('');
 const [kind,setKind]=useState('visit_summary'),[occurredOn,setOccurredOn]=useState(todayIso()),[body,setBody]=useState('');
 const [withdrawing,setWithdrawing]=useState<string|null>(null),[reason,setReason]=useState('');
 const load=useCallback(async()=>{setError('');try{setEntries((await api<{entries:Entry[]}>(`/doctor/patients/${patientId}/card`)).entries);}catch(e){setError(errorText(e));}},[patientId]);
 useEffect(()=>{void load();},[load]);
 async function add(){
  setBusy(true);setError('');setSaved('');
  try{await api(`/doctor/patients/${patientId}/card/entries`,{kind,body,occurredOn});setBody('');setSaved('Запись добавлена в карточку. Пациент получит уведомление.');await load();}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function withdraw(id:string){
  setBusy(true);setError('');
  try{await api(`/doctor/card/entries/${id}/withdraw`,{reason});setWithdrawing(null);setReason('');await load();}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 if(!entries&&!error)return <PageLoader label="Открываем карточку…"/>;
 return <section className="doctor-section" aria-labelledby="doctor-card-title">
  <h2 id="doctor-card-title">Карточка пациента</h2>
  <p className="muted small">Записи не стираются. Ошибочную запись можно отозвать, указав причину: она останется в истории, но её текст скроется.</p>
  {error?<ErrorBox message={error} retry={load}/>:null}
  <form className="care-form" onSubmit={e=>{e.preventDefault();if(body.trim())void add();}}>
   <h3>Новая запись</h3>
   <div className="directory-search">
    <NativeSelect label="Тип записи" value={kind} onChange={e=>setKind(e.currentTarget.value)} data={KINDS}/>
    <TextInput type="date" label="Дата" description="Не позже сегодняшнего дня" max={todayIso()} value={occurredOn} onChange={e=>setOccurredOn(e.currentTarget.value)}/>
   </div>
   <Textarea label="Текст записи" description="Только то, что нужно для ведения пациента. До 4000 символов" value={body} onChange={e=>setBody(e.currentTarget.value)} maxLength={4000} minRows={3}/>
   {saved?<p role="status" className="muted small">{saved}</p>:null}
   <div className="connect-actions"><Button type="submit" loading={busy} disabled={!body.trim()}>Добавить в карточку</Button></div>
  </form>
  <div className="card-entries">
   {!entries?.length?<p className="muted">Записей пока нет.</p>:null}
   {(entries??[]).map(e=><article className={e.withdrawn?'request-row card-entry withdrawn':'request-row card-entry'} key={e.id}>
    <div>
     <strong>{e.kindLabel}</strong><span className="muted small"> · {e.occurredOn} · {e.authorName}{e.mine?' (вы)':''}</span>
     {e.withdrawn?<p className="muted small">Отозвано: {e.withdrawReason}</p>:<p className="care-prose">{e.body}</p>}
     {e.mine&&!e.withdrawn&&withdrawing!==e.id?<Button size="sm" variant="subtle" onClick={()=>setWithdrawing(e.id)}>Отозвать запись</Button>:null}
     {withdrawing===e.id?<div className="card-withdraw">
      <TextInput label="Причина отзыва" value={reason} onChange={ev=>setReason(ev.currentTarget.value)} maxLength={500}/>
      <div className="connect-actions"><Button color="red" loading={busy} disabled={!reason.trim()} onClick={()=>void withdraw(e.id)}>Отозвать</Button><Button variant="default" onClick={()=>setWithdrawing(null)}>Отмена</Button></div>
     </div>:null}
    </div>
   </article>)}
  </div>
 </section>;
}
