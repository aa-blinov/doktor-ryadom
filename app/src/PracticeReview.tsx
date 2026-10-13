import {useState} from 'react';
import {Button} from '@mantine/core';
import type {PatientData} from './shared';
import {api,errorText} from './api';
import {ErrorBox} from './ui';
import {practiceContent} from './practices';
export function PracticeReview({data,id,onSaved}:{data:PatientData;id:string;onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[showReviewed,setShowReviewed]=useState(false),[done,setDone]=useState('');
 const pending=data.practices.filter(l=>!l.reviewed_at||l.reviewer_id!==data.doctor?.id);
 async function reviewAll(){setBusy('all');setError('');setDone('');try{for(const l of pending)await api(`/doctor/patients/${id}/practices/${l.id}/review`,{});await onSaved();setDone('Просмотр подтверждён');}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 async function review(logId:string){setBusy(logId);setError('');setDone('');try{await api(`/doctor/patients/${id}/practices/${logId}/review`,{});await onSaved();setDone('Просмотр подтверждён');}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 const logs=data.practices.slice().sort((a,b)=>Number(!!a.reviewed_at&&a.reviewer_id===data.doctor?.id)-Number(!!b.reviewed_at&&b.reviewer_id===data.doctor?.id)||b.completed_at-a.completed_at);
 return <section className="care-section"><h2>Опыт практик</h2><p className="muted">После неприятного опыта упражнение перестаёт предлагаться. Обсудите отзыв и при необходимости измените план наблюдения.</p>
  <details className="review-fold" open={pending.length===0}>
   <summary>{pending.length?`Ожидают подтверждения: ${pending.length}`:'Все отзывы подтверждены'}</summary>
   <div className="review-fold-body">
    {pending.length>1?<Button variant="outline" mb="var(--sp-4)" loading={busy==='all'} disabled={busy!==null} onClick={()=>void reviewAll()}>Подтвердить все ({pending.length})</Button>:null}
    {logs.length>pending.length?<Button variant="subtle" mb="var(--sp-4)" onClick={()=>setShowReviewed(v=>!v)}>{showReviewed?'Скрыть просмотренные':`Показать просмотренные (${logs.length-pending.length})`}</Button>:null}
    {done?<p className="muted small" role="status">{done}</p>:null}
    {error?<ErrorBox message={error}/>:null}
    {(showReviewed?logs:pending).length?(showReviewed?logs:pending).map(log=><article className="care-record" key={log.id}><h3>{practiceContent.find(p=>p.id===log.practice_id)?.title??'Практика'}</h3><p>{log.feedback==='comfortable'?'Комфортно':log.feedback==='same'?'Без изменений':'Неприятно'}, {new Date(log.completed_at).toLocaleString('ru-RU')}</p>{log.note?<p className="care-prose">{log.note}</p>:null}{log.reviewed_at&&log.reviewer_id===data.doctor?.id?<p className="muted small">Просмотр подтверждён</p>:<Button variant="outline" disabled={busy!==null} loading={busy===log.id} onClick={()=>review(log.id)}>Подтвердить просмотр отзыва</Button>}</article>):<p className="muted">Пациент пока не сохранил отзывы о практиках</p>}
   </div>
  </details>
 </section>;
}
