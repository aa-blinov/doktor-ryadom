import {useState} from 'react';
import {Alert,Button,Group,Modal,Textarea,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,formatDate} from './ui';
import type {Goal,GoalLog,PatientData} from './shared';

export const goalStatus={step:'Шаг',difficult:'Трудность',reached:'Цель достигнута'};
const goalStatusFull={step:'Шаг сделан',difficult:'Возникла трудность',reached:'Цель достигнута'};

export function GoalRecords({goals,logs}:{goals:Goal[];logs:GoalLog[]}){
 return <>{logs.map(log=><article className="care-record" key={log.id}><strong>{goals.find(g=>g.id===log.goal_id)?.title??'Личная цель'}</strong><p>{goalStatusFull[log.status]}, {formatDate(new Date(log.created_at).toISOString().slice(0,10))}</p>{log.note?<p className="care-prose">{log.note}</p>:null}</article>)}</>;
}

export function Goals({data,doctor=false,id,onSaved}:{data:PatientData;doctor?:boolean;id?:string;onSaved:()=>Promise<void>}){
 const [title,setTitle]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[closing,setClosing]=useState<Goal|null>(null),[restoring,setRestoring]=useState<string|null>(null);
 const goals=data.goals??[],logs=data.goalLogs??[],active=goals.filter(g=>!g.closed_at),closed=goals.filter(g=>g.closed_at);
 async function addGoal(e:React.FormEvent){
  e.preventDefault();setError('');setMessage('');setBusy(true);
  try{await api('/patient/goals',{title,reason});setTitle('');setReason('');await onSaved();setMessage('Цель добавлена');}
  catch(err){setError(errorText(err));}finally{setBusy(false);}
 }
 async function closeGoal(goalId:string){setError('');setBusy(true);try{await api(`/patient/goals/${goalId}/close`,{},'PUT');await onSaved();setMessage('Цель завершена');setClosing(null);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function restoreGoal(goalId:string){setError('');setRestoring(goalId);try{await api(`/patient/goals/${goalId}/restore`,{},'PUT');await onSaved();setMessage('Цель снова активна');}catch(e){setError(errorText(e));}finally{setRestoring(null);}}
 return <section className="care-section goals-section">
  <h2>{doctor?'Личные цели пациента':'Мои цели'}</h2>
  <p className="muted">{doctor?'Цели формулирует пациент. Обсудите посильный следующий шаг.':'До трёх целей. Отмечайте шаг — это не оценка и не соревнование.'}</p>
  {!doctor?<form className="goal-add-form" onSubmit={addGoal}>
   <TextInput label="Новая цель" placeholder="Например: снова встречаться с друзьями" value={title} onChange={e=>setTitle(e.currentTarget.value)} required minLength={3} maxLength={180}/>
   <TextInput label="Почему это важно" description="Необязательно" value={reason} onChange={e=>setReason(e.currentTarget.value)} maxLength={500}/>
   <Button type="submit" loading={busy} disabled={active.length>=3||title.trim().length<3}>Добавить цель</Button>
   {active.length>=3?<p className="muted small">Сначала завершите одну из текущих целей</p>:null}
  </form>:null}
  {active.length?active.map(goal=><article className="goal-card" key={goal.id}>
   <div className="goal-card-head">
    <h3>{goal.title}</h3>
    {!doctor?<Button variant="subtle" size="xs" disabled={busy} onClick={()=>setClosing(goal)}>Завершить</Button>:null}
   </div>
   {goal.reason?<p className="muted goal-reason">{goal.reason}</p>:null}
   {!doctor?<GoalProgress goal={goal} busy={busy} save={async(status,note)=>{
    setError('');setMessage('');
    try{await api(`/patient/goals/${goal.id}/logs`,{status,note});await onSaved();setMessage('Отметка сохранена');return true;}
    catch(e){setError(errorText(e));return false;}
   }}/>:null}
   {logs.filter(l=>l.goal_id===goal.id).slice(0,5).map(log=><div className="goal-log" key={log.id}>
    <p><strong>{goalStatusFull[log.status]}</strong><span className="muted small"> · {new Date(log.created_at).toLocaleDateString('ru-RU')}</span></p>
    {log.note?<p className="care-prose">{log.note}</p>:null}
    {log.reviewed_at?<p className="muted small">{log.reviewer_id===data.doctor?.id?'Врач подтвердил просмотр':'Просмотрено предыдущим врачом'}</p>:doctor?<p className="muted small">Ожидает просмотра</p>:null}
     {doctor&&(!log.reviewed_at||log.reviewer_id!==data.doctor?.id)?<Button variant="outline" size="xs" mt="xs" onClick={async()=>{setError('');setMessage('');try{await api(`/doctor/patients/${id}/goal-logs/${log.id}/review`,{});await onSaved();setMessage('Просмотр отметки подтверждён');}catch(e){setError(errorText(e));}}}>Подтвердить просмотр отметки</Button>:null}
   </div>)}
  </article>):<p className="muted">Активных целей нет</p>}
  {!doctor&&closed.length?<section className="goal-archive">
   <h3>Архив</h3>
   <p className="muted small">Завершённые цели можно вернуть в список.</p>
   {closed.map(goal=><article className="goal-card closed" key={goal.id}>
    <div className="goal-card-head">
     <h4>{goal.title}</h4>
     <Button variant="subtle" size="xs" loading={restoring===goal.id} disabled={busy||restoring!==null} onClick={()=>void restoreGoal(goal.id)}>Вернуть в список</Button>
    </div>
    {goal.closed_at?<p className="muted small">Завершена {new Date(goal.closed_at).toLocaleDateString('ru-RU')}</p>:null}
   </article>)}
  </section>:null}
  <Modal opened={!!closing} onClose={()=>setClosing(null)} title="Завершить цель" centered>
   <p>Цель «{closing?.title}» перестанет предлагаться. Отметки останутся в истории, а саму цель можно вернуть из архива.</p>
   <Group justify="flex-end">
    <Button variant="default" onClick={()=>setClosing(null)}>Отмена</Button>
    <Button color="red" loading={busy} onClick={()=>closing&&void closeGoal(closing.id)}>Завершить</Button>
   </Group>
  </Modal>
  {error?<ErrorBox message={error}/>:null}
  {message?<Alert color="forest" role="status">{message}</Alert>:null}
 </section>;
}

function GoalProgress({goal,busy,save}:{goal:Goal;busy:boolean;save:(status:GoalLog['status'],note:string)=>Promise<boolean>}){
 const [status,setStatus]=useState<GoalLog['status']|null>(null),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 async function submit(){
  if(!status)return;
  setSaving(true);
  const ok=await save(status,note);
  setSaving(false);
  if(ok){setStatus(null);setNote('');}
 }
 return <div className="goal-progress">
  <div className="goal-status-row" role="group" aria-label={`Отметка по цели ${goal.title}`}>
   {(Object.entries(goalStatus) as [GoalLog['status'],string][]).map(([value,label])=>
    <button type="button" key={value} className={status===value?'goal-chip selected':'goal-chip'} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label}</button>
   )}
  </div>
  {status?<>
   <Textarea label="Что получилось или помешало" description="Необязательно" value={note} onChange={e=>setNote(e.currentTarget.value)} minRows={2} maxLength={1000}/>
   <Group>
    <Button size="sm" loading={saving||busy} onClick={()=>void submit()}>Сохранить отметку</Button>
    <Button size="sm" variant="subtle" onClick={()=>{setStatus(null);setNote('');}}>Отмена</Button>
   </Group>
  </>:null}
 </div>;
}
