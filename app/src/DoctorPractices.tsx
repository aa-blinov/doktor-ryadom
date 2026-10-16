import {useEffect,useState} from 'react';
import {Alert,Button,FileButton,Group,NumberInput,Select,Textarea,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageHead} from './ui';
import {PracticeVisual} from './PracticeVisual';
import type {CustomPractice} from './shared';

// Doctor-written practices: title, short text, duration, category, steps, a cover photo and an optional short video.
const categories=['Внимание вокруг','Мысли и чувства','Забота о себе'];
const MAX_STEPS=8, VIDEO_MAX_SECONDS=180;
type Draft={title:string;subtitle:string;minutes:number;category:string;basis:string;description:string;steps:{title:string;text:string}[]};
const emptyDraft=():Draft=>({title:'',subtitle:'',minutes:2,category:categories[0],basis:'',description:'',steps:[{title:'',text:''}]});

function probeSeconds(file:File){return new Promise<number>((resolve,reject)=>{const el=document.createElement('video');el.preload='metadata';const timer=window.setTimeout(()=>{URL.revokeObjectURL(el.src);reject(new Error('Не удалось проверить длительность видео. Попробуйте другой файл.'));},8000);el.onloadedmetadata=()=>{window.clearTimeout(timer);URL.revokeObjectURL(el.src);resolve(el.duration);};el.onerror=()=>{window.clearTimeout(timer);URL.revokeObjectURL(el.src);reject(new Error('Не удалось прочитать видео. Попробуйте MP4 или WebM.'));};el.src=URL.createObjectURL(file);});}

export function DoctorPractices(){
 const [list,setList]=useState<CustomPractice[]|null>(null),[mode,setMode]=useState<'list'|'edit'>('list'),[editingId,setEditingId]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(emptyDraft()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const current=list?.find(p=>p.id===editingId)??null;
 const readOnly=!!current?.archived;
 async function reload(){const r=await api<{practices:CustomPractice[]}>('/doctor/practices');setList(r.practices);}
 useEffect(()=>{reload().catch(e=>setError(errorText(e)));},[]);
 function open(p:CustomPractice|null){setError('');setMessage('');if(!p){setEditingId(null);setDraft(emptyDraft());}else{setEditingId(p.id);setDraft({title:p.title,subtitle:p.subtitle,minutes:p.minutes,category:p.category,basis:p.basis,description:p.description,steps:p.steps.map(s=>({...s}))});}setMode('edit');}
 function setStep(i:number,patch:Partial<Draft['steps'][number]>){setDraft(d=>({...d,steps:d.steps.map((s,k)=>k===i?{...s,...patch}:s)}));}
 function moveStep(i:number,delta:number){setDraft(d=>{const steps=[...d.steps];const j=i+delta;if(j<0||j>=steps.length)return d;[steps[i],steps[j]]=[steps[j],steps[i]];return {...d,steps};});}
 async function save(){setBusy(true);setError('');setMessage('');
  try{
   const body={...draft,subtitle:draft.subtitle.trim(),basis:draft.basis.trim(),description:draft.description.trim()};
   let id=editingId;
   if(id){await api(`/doctor/practices/${id}`,body,'PUT');}else{const r=await api<{practice:CustomPractice}>('/doctor/practices',body);id=r.practice.id.slice(7);setEditingId(r.practice.id);}
   setMessage('Практика сохранена'); await reload();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function uploadMedia(kind:'photo'|'video',file:File|null){if(!file||!editingId)return;setBusy(true);setError('');setMessage('');
  try{
   if(kind==='video'){const seconds=await probeSeconds(file);if(!Number.isFinite(seconds)||seconds>VIDEO_MAX_SECONDS){setError(`Видео должно быть не длиннее ${VIDEO_MAX_SECONDS} секунд`);return;}}
   const res=await fetch(`/api/doctor/practices/${editingId.slice(7)}/media/${kind}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});
   const body=await res.json().catch(()=>({})) as {error?:string};if(!res.ok)throw new Error(body.error||'Не удалось загрузить файл');
   setMessage(kind==='photo'?'Фото сохранено':'Видео сохранено'); await reload();
  }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить файл');}finally{setBusy(false);}
 }
 async function removeMedia(kind:'photo'|'video'){if(!editingId)return;setBusy(true);setError('');try{await api(`/doctor/practices/${editingId.slice(7)}/media/${kind}`,{},'DELETE');await reload();setMessage('Файл удалён');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function archive(){if(!editingId||!window.confirm('Убрать практику из библиотеки? Пациенты, у которых она уже есть, смогут её открыть, но в новые планы её не добавить.'))return;setBusy(true);setError('');try{await api(`/doctor/practices/${editingId.slice(7)}/archive`,{},'POST');await reload();setMessage('Практика перенесена в архив');}catch(e){setError(errorText(e));}finally{setBusy(false);}}

 if(mode==='list')return <>
  <PageHead title="Практики" description="Свои практики с описанием, шагами, фото и видео. Их можно добавить в план пациента."/>
  <Group mb="var(--sp-5)"><Button onClick={()=>open(null)}>Создать практику</Button></Group>
  {list===null?<p className="muted">Загружаем практики…</p>:null}
  {list&&!list.length?<p className="muted">Своих практик пока нет. Стоковые практики можно добавить в план как прежде.</p>:null}
  <div className="doctor-practice-list">{(list??[]).map(p=><article className="doctor-practice-card" key={p.id}>
   <PracticeVisual id={p.id} category={p.category} photoUrl={p.photoUrl} label={p.title} compact/>
   <div><h3>{p.title}</h3><p className="muted small">{p.minutes} мин · {p.category} · шагов: {p.steps.length}{p.archived?' · в архиве':''}</p>{p.subtitle?<p>{p.subtitle}</p>:null}</div>
   <Button variant="outline" onClick={()=>open(p)}>{p.archived?'Посмотреть':'Открыть'}</Button>
  </article>)}</div>
  {error?<ErrorBox message={error}/>:null}{message?<Alert color="forest" role="status" mt="var(--sp-4)">{message}</Alert>:null}
 </>;

 return <>
  <Button variant="subtle" onClick={()=>{setMode('list');setError('');setMessage('');}} mb="var(--sp-4)">← К списку практик</Button>
  <PageHead title={editingId?(readOnly?'Практика в архиве':'Редактирование практики'):'Новая практика'} description={readOnly?'Архивную практику нельзя менять. Пациенты, у которых она есть, видят её как прежде.':'Заполните название, шаги и, при желании, фото и видео.'}/>
  <div className="doctor-practice-editor">
   <fieldset disabled={busy||readOnly} className="doctor-practice-form">
    <TextInput label="Название" value={draft.title} onChange={e=>setDraft({...draft,title:e.currentTarget.value})} minLength={3} maxLength={80} required/>
    <TextInput label="Короткое описание" description="Одна строка, видна в списке практик" value={draft.subtitle} onChange={e=>setDraft({...draft,subtitle:e.currentTarget.value})} maxLength={160}/>
    <div className="profile-fields">
     <NumberInput label="Длительность, минут" value={draft.minutes} min={1} max={15} allowDecimal={false} hideControls onChange={v=>setDraft({...draft,minutes:typeof v==='number'?v:1})}/>
     <Select label="Направление" value={draft.category} data={categories} onChange={v=>setDraft({...draft,category:v||categories[0]})}/>
    </div>
    <TextInput label="Основа" description="Например: дыхание по методике, ВОЗ или авторская практика" value={draft.basis} onChange={e=>setDraft({...draft,basis:e.currentTarget.value})} maxLength={160}/>
    <p className="muted small">Текст и шаги пишете вы, и отвечаете за них вы. Рядом не проверяет клинические формулировки: перед использованием с пациентами сверьте их с собственной практикой.</p>
    <Textarea label="Описание" description="Зачем эта практика и кому она подходит" value={draft.description} onChange={e=>setDraft({...draft,description:e.currentTarget.value})} minRows={3} maxLength={600}/>
    <section aria-label="Шаги практики">
     <h3>Шаги</h3>
     {draft.steps.map((s,i)=><div className="doctor-practice-step" key={i}>
      <div className="section-title"><strong>Шаг {i+1}</strong><Group gap="var(--sp-2)">
       <Button size="xs" variant="subtle" disabled={i===0} aria-label={`Поднять шаг ${i+1}`} onClick={()=>moveStep(i,-1)}>Выше</Button>
       <Button size="xs" variant="subtle" disabled={i===draft.steps.length-1} aria-label={`Опустить шаг ${i+1}`} onClick={()=>moveStep(i,1)}>Ниже</Button>
       <Button size="xs" variant="subtle" disabled={draft.steps.length===1} aria-label={`Удалить шаг ${i+1}`} onClick={()=>setDraft(d=>({...d,steps:d.steps.filter((_,k)=>k!==i)}))}>Удалить</Button>
      </Group></div>
      <TextInput label={`Название шага ${i+1}`} value={s.title} onChange={e=>setStep(i,{title:e.currentTarget.value})} maxLength={80}/>
      <Textarea label={`Текст шага ${i+1}`} value={s.text} onChange={e=>setStep(i,{text:e.currentTarget.value})} minRows={2} maxLength={400}/>
     </div>)}
     <Button variant="outline" disabled={draft.steps.length>=MAX_STEPS} onClick={()=>setDraft(d=>({...d,steps:[...d.steps,{title:'',text:''}]}))}>Добавить шаг</Button>
    </section>
    <Group><Button onClick={()=>void save()} loading={busy}>{editingId?'Сохранить':'Создать практику'}</Button></Group>
   </fieldset>
   <aside className="doctor-practice-side">
    <h3>Фото и видео</h3>
    {editingId&&current?<>
     <PracticeVisual id={editingId} category={draft.category} photoUrl={current.photoUrl} label={draft.title}/>
     <Group gap="var(--sp-3)" mt="var(--sp-3)">
      <FileButton onChange={f=>void uploadMedia('photo',f)} accept="image/jpeg,image/png,image/webp" disabled={busy||readOnly}>{p=><Button {...p} variant="outline" size="sm" disabled={busy||readOnly}>{current.photoUrl?'Заменить фото':'Загрузить фото'}</Button>}</FileButton>
      {current.photoUrl?<Button variant="subtle" size="sm" disabled={busy||readOnly} onClick={()=>void removeMedia('photo')}>Удалить фото</Button>:null}
     </Group>
     {current.videoUrl?<video className="profile-video-player" src={current.videoUrl} controls playsInline preload="metadata" aria-label={`Видео к практике ${draft.title}`}/>:<p className="muted small">Видео пока нет</p>}
     <Group gap="var(--sp-3)" mt="var(--sp-3)">
      <FileButton onChange={f=>void uploadMedia('video',f)} accept="video/mp4,video/webm" disabled={busy||readOnly}>{p=><Button {...p} variant="outline" size="sm" disabled={busy||readOnly}>{current.videoUrl?'Заменить видео':'Загрузить видео'}</Button>}</FileButton>
      {current.videoUrl?<Button variant="subtle" size="sm" disabled={busy||readOnly} onClick={()=>void removeMedia('video')}>Удалить видео</Button>:null}
     </Group>
     <p className="muted small">Фото до 5 МБ, видео до 50 МБ и до 3 минут.</p>
     {!readOnly?<Button variant="subtle" color="red" mt="var(--sp-5)" disabled={busy} onClick={()=>void archive()}>Убрать в архив</Button>:null}
    </>:<p className="muted small">Фото и видео появятся после первого сохранения практики.</p>}
    <h3 style={{marginTop:'var(--sp-5)'}}>Так увидит пациент</h3>
    <ol className="doctor-practice-preview">{draft.steps.filter(s=>s.title||s.text).map((s,i)=><li key={i}><strong>{s.title||'Без названия'}</strong>{s.text?<p className="muted small">{s.text}</p>:null}</li>)}</ol>
   </aside>
  </div>
  {error?<ErrorBox message={error}/>:null}{message?<Alert color="forest" role="status" mt="var(--sp-4)">{message}</Alert>:null}
 </>;
}
