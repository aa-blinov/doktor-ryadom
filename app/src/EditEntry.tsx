import {useState} from 'react';
import {Button,Group,Textarea} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageHead,formatDate, ScaleRow, SleepInput} from './ui';
import {navigate} from './App';
import {moods,today,todayInTimezone,type Entry,type PatientData} from './shared';

function goBack(){if(window.history.length>1)window.history.back();else navigate('/history');}

export function EditEntry({entry,plan,onSaved,timezone}:{entry:Entry;plan:PatientData['plan'];onSaved:()=>Promise<void>;timezone?:string}){
 const [value,setValue]=useState(entry),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sleepOther,setSleepOther]=useState(entry.sleep!==null&&![4,5,6,7,8,9].includes(entry.sleep));
 const update=(key:keyof Entry,v:unknown)=>setValue(e=>({...e,[key]:v,...(key==='sleep'&&(v===null||Number(v)>=6)?{sleepContext:null}:{})}));
 async function save(){setBusy(true);setError('');try{await api(`/patient/checkins/${entry.id}`,{...value,expectedVersion:entry.version??1},'PUT');await onSaved();goBack();}catch(e){// Текст ответа сервера показывается как есть: «Исправить можно только сегодняшнюю запись.» и прочие причины.
  setError(errorText(e));}finally{setBusy(false);}}
 return <div className="edit-entry">
  <button className="back-link" onClick={()=>navigate('/history')}>История</button>
  <PageHead title="Исправить запись" description={formatDate(entry.date,true)}/>
  <form className="care-form" onSubmit={e=>{e.preventDefault();void save();}}>
   <fieldset>
    <legend>Самочувствие</legend>
    <div className="checkin-moods" role="group" aria-label="Самочувствие">
     {moods.map((label,i)=><button type="button" key={label} className={value.mood===i+1?'checkin-mood selected':'checkin-mood'} aria-label={label} aria-pressed={value.mood===i+1} onClick={()=>update('mood',i+1)}>
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="1.5"/><circle cx="17" cy="20" r="1.4" fill="currentColor"/><circle cx="31" cy="20" r="1.4" fill="currentColor"/><path d={i<2?'M16 33Q24 25 32 33':i===2?'M17 30H31':'M16 28Q24 37 32 28'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      <span>{label}</span>
     </button>)}
    </div>
   </fieldset>
   <fieldset>
    <legend>Сон</legend>
    <div className="checkin-chips" role="group" aria-label="Сон, часов">
     {[4,5,6,7,8,9].map(h=><button type="button" key={h} className={value.sleep===h&&!sleepOther?'checkin-chip selected':'checkin-chip'} aria-pressed={value.sleep===h&&!sleepOther} onClick={()=>{setSleepOther(false);update('sleep',value.sleep===h?null:h);}}>{h} ч</button>)}
     <button type="button" className={sleepOther?'checkin-chip selected':'checkin-chip'} aria-pressed={sleepOther} onClick={()=>setSleepOther(v=>!v)}>Другое</button>
    </div>
    {sleepOther?<SleepInput value={value.sleep} onChange={v=>update('sleep',v)} showTitle={false}/>:null}
   </fieldset>
   {value.sleep!==null&&value.sleep<6?<fieldset>
    <legend>После короткого сна</legend>
    <div className="checkin-chips" role="group" aria-label="После короткого сна">
     {([['tired','Усталость'],['usual','Как обычно'],['active','Много энергии']] as const).map(([v,l])=>
      <button type="button" key={v} className={value.sleepContext===v?'checkin-chip selected':'checkin-chip'} aria-pressed={value.sleepContext===v} onClick={()=>update('sleepContext',value.sleepContext===v?null:v)}>{l}</button>)}
    </div>
   </fieldset>:null}
   {plan.anxiety||entry.anxiety!==null?<fieldset>
    <legend>Тревога</legend>
    <ScaleRow label="Тревога" options={['Очень сильная','Сильная','Умеренная','Небольшая','Без тревоги'].map((l,i)=>({value:i,label:l}))} value={value.anxiety} onChange={v=>update('anxiety',v)} ends={['хуже','лучше']}/>
   </fieldset>:null}
   {plan.energy||entry.energy!==null?<fieldset>
    <legend>Энергия</legend>
    <ScaleRow label="Энергия" options={['Очень мало','Мало','Как обычно','Много','Необычно много'].map((l,i)=>({value:i+1,label:l}))} value={value.energy} onChange={v=>update('energy',v)} ends={['хуже','лучше']}/>
   </fieldset>:null}
   {plan.functioning||entry.functioning!==null?<fieldset>
    <legend>Обычные дела</legend>
    <ScaleRow label="Обычные дела" options={[{value:1,label:'Очень трудно'},{value:2,label:'С трудностями'},{value:3,label:'Без трудностей'}]} value={value.functioning} onChange={v=>update('functioning',v)} ends={['хуже','лучше']}/>
   </fieldset>:null}
   <fieldset>
    <legend>Небольшое действие</legend>
    <div className="checkin-chips" role="group" aria-label="Небольшое действие">
     <button type="button" className={value.habit===true?'checkin-chip selected':'checkin-chip'} aria-pressed={value.habit===true} onClick={()=>update('habit',value.habit===true?null:true)}>Получилось</button>
     <button type="button" className={value.habit===false?'checkin-chip selected':'checkin-chip'} aria-pressed={value.habit===false} onClick={()=>update('habit',value.habit===false?null:false)}>Не получилось</button>
    </div>
   </fieldset>
   <Textarea label="Заметка" value={value.note} onChange={e=>update('note',e.currentTarget.value)} minRows={4} maxLength={2000}/>
   {entry.date!==(timezone?todayInTimezone(timezone):today())?<p className="muted small">Исправить можно только сегодняшнюю запись. Прошлые записи остаются в истории без изменений.</p>:null}
   {error?<ErrorBox message={error}/>:null}
   <Group><Button type="submit" loading={busy}>Сохранить исправления</Button><Button variant="subtle" disabled={busy} onClick={()=>goBack()}>Отмена</Button></Group>
  </form>
 </div>;
}
