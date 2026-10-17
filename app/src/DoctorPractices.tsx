import {useEffect,useState} from 'react';
import {Alert,Button,FileButton,Group,NumberInput,Select,Textarea,TextInput} from '@mantine/core';
import {DndContext,KeyboardSensor,PointerSensor,closestCenter,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,arrayMove,sortableKeyboardCoordinates,useSortable,verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {IconGripVertical} from '@tabler/icons-react';
import {api,errorText} from './api';
import {ErrorBox,PageHead} from './ui';
import {PracticeVisual} from './PracticeVisual';
import type {CustomPractice} from './shared';

// Doctor-written practices: title, short text, duration, category, steps, a cover photo and an optional short video.
const categories=['Внимание вокруг','Мысли и чувства','Забота о себе'];
const MAX_STEPS=8, VIDEO_MAX_SECONDS=180;
type Step={uid:string;title:string;text:string};
type Draft={title:string;subtitle:string;minutes:number;category:string;basis:string;description:string;steps:Step[]};
const newStep=():Step=>({uid:crypto.randomUUID(),title:'',text:''});
const emptyDraft=():Draft=>({title:'',subtitle:'',minutes:2,category:categories[0],basis:'',description:'',steps:[newStep()]});

function probeSeconds(file:File){return new Promise<number>((resolve,reject)=>{const el=document.createElement('video');el.preload='metadata';const timer=window.setTimeout(()=>{URL.revokeObjectURL(el.src);reject(new Error('Не удалось проверить длительность видео. Попробуйте другой файл.'));},8000);el.onloadedmetadata=()=>{window.clearTimeout(timer);URL.revokeObjectURL(el.src);resolve(el.duration);};el.onerror=()=>{window.clearTimeout(timer);URL.revokeObjectURL(el.src);reject(new Error('Не удалось прочитать видео. Попробуйте MP4 или WebM.'));};el.src=URL.createObjectURL(file);});}

// Checks a picked file before it is sent; returns an error text or null.
async function checkMedia(kind:'photo'|'video',file:File){
 if(kind==='video'){const seconds=await probeSeconds(file);if(!Number.isFinite(seconds)||seconds>VIDEO_MAX_SECONDS)return `Видео должно быть не длиннее ${VIDEO_MAX_SECONDS} секунд`;}
 return null;
}
async function sendMedia(practiceId:string,kind:'photo'|'video',file:File){
 const res=await fetch(`/api/doctor/practices/${practiceId}/media/${kind}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});
 const body=await res.json().catch(()=>({})) as {error?:string};if(!res.ok)throw new Error(body.error||'Не удалось загрузить файл');
}

// A local address for a file that is not uploaded yet; released when the file changes or the editor closes.
function useObjectUrl(file:File|null){const [url,setUrl]=useState<string|null>(null);useEffect(()=>{if(!file){setUrl(null);return;}const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);return url;}

// One step row: a drag handle for touch and mouse, plus the arrow buttons for keyboard and screen readers.
function StepRow({step,index,count,onMove,onRemove,onChange}:{step:Step;index:number;count:number;onMove:(delta:number)=>void;onRemove:()=>void;onChange:(patch:Partial<Step>)=>void}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:step.uid});
 return <div ref={setNodeRef} className={isDragging?'doctor-practice-step is-dragging':'doctor-practice-step'} style={{transform:CSS.Transform.toString(transform),transition}}>
  <div className="section-title"><strong>Шаг {index+1}</strong><Group gap="var(--sp-2)" wrap="wrap">
   <Button size="sm" variant="subtle" ref={setActivatorNodeRef} {...attributes} {...listeners} leftSection={<IconGripVertical size={16}/>} aria-label={`Перетащить шаг ${index+1}`}>Перетащить</Button>
   <Button size="sm" variant="subtle" disabled={index===0} aria-label={`Поднять шаг ${index+1}`} onClick={()=>onMove(-1)}>Выше</Button>
   <Button size="sm" variant="subtle" disabled={index===count-1} aria-label={`Опустить шаг ${index+1}`} onClick={()=>onMove(1)}>Ниже</Button>
   <Button size="sm" variant="subtle" disabled={count===1} aria-label={`Удалить шаг ${index+1}`} onClick={onRemove}>Удалить</Button>
  </Group></div>
  <TextInput label={`Название шага ${index+1}`} value={step.title} onChange={e=>onChange({title:e.currentTarget.value})} maxLength={80}/>
  <Textarea label={`Текст шага ${index+1}`} value={step.text} onChange={e=>onChange({text:e.currentTarget.value})} minRows={2} maxLength={400}/>
 </div>;
}

export function DoctorPractices(){
 const [list,setList]=useState<CustomPractice[]|null>(null),[mode,setMode]=useState<'list'|'edit'>('list'),[editingId,setEditingId]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(emptyDraft()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 // Photo and video picked before the practice exists are sent right after its first save.
 const [pending,setPending]=useState<{photo:File|null;video:File|null}>({photo:null,video:null});
 const current=list?.find(p=>p.id===editingId)??null;
 const readOnly=!!current?.archived;
 const pendingPhotoUrl=useObjectUrl(pending.photo),pendingVideoUrl=useObjectUrl(pending.video);
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 async function reload(){const r=await api<{practices:CustomPractice[]}>('/doctor/practices');setList(r.practices);}
 useEffect(()=>{reload().catch(e=>setError(errorText(e)));},[]);
 function open(p:CustomPractice|null){setError('');setMessage('');setPending({photo:null,video:null});if(!p){setEditingId(null);setDraft(emptyDraft());}else{setEditingId(p.id);setDraft({title:p.title,subtitle:p.subtitle,minutes:p.minutes,category:p.category,basis:p.basis,description:p.description,steps:p.steps.map(s=>({...s,uid:crypto.randomUUID()}))});}setMode('edit');}
 function setStep(uid:string,patch:Partial<Step>){setDraft(d=>({...d,steps:d.steps.map(s=>s.uid===uid?{...s,...patch}:s)}));}
 function moveStepTo(from:number,to:number){setDraft(d=>{if(to<0||to>=d.steps.length||from===to)return d;return {...d,steps:arrayMove(d.steps,from,to)};});}
 function onDragEnd(e:DragEndEvent){const {active,over}=e;if(!over||active.id===over.id)return;const from=draft.steps.findIndex(s=>s.uid===active.id),to=draft.steps.findIndex(s=>s.uid===over.id);moveStepTo(from,to);}
 async function save(){setBusy(true);setError('');setMessage('');
  try{
   const body={...draft,subtitle:draft.subtitle.trim(),basis:draft.basis.trim(),description:draft.description.trim(),steps:draft.steps.map(({title,text})=>({title,text}))};
   let id=editingId;
   if(id){await api(`/doctor/practices/${id}`,body,'PUT');}
   else{const r=await api<{practice:CustomPractice}>('/doctor/practices',body);id=r.practice.id;setEditingId(id);
    // Pictures chosen while creating go up now, in the same step as the text.
    const pid=id.slice(7);
    if(pending.photo)await sendMedia(pid,'photo',pending.photo);
    if(pending.video)await sendMedia(pid,'video',pending.video);
    setPending({photo:null,video:null});
   }
   setMessage('Практика сохранена'); await reload();
  }catch(e){setError(e instanceof Error?e.message:errorText(e));}finally{setBusy(false);}
 }
 async function uploadMedia(kind:'photo'|'video',file:File|null){if(!file||!editingId)return;setBusy(true);setError('');setMessage('');
  try{const bad=await checkMedia(kind,file);if(bad){setError(bad);return;}await sendMedia(editingId.slice(7),kind,file);setMessage(kind==='photo'?'Фото сохранено':'Видео сохранено'); await reload();}
  catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить файл');}finally{setBusy(false);}
 }
 async function pick(kind:'photo'|'video',file:File|null){
  if(!file)return;setError('');
  const bad=await checkMedia(kind,file).catch(()=>'Не удалось прочитать файл');
  if(bad){setError(bad);return;}
  setPending(p=>({...p,[kind]:file}));
 }
 async function removeMedia(kind:'photo'|'video'){if(!editingId)return;setBusy(true);setError('');try{await api(`/doctor/practices/${editingId.slice(7)}/media/${kind}`,{},'DELETE');await reload();setMessage('Файл удалён');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 // A copy starts as a new practice with the same text, steps and pictures; the copy opens in the editor for renaming.
 async function copy(){if(!editingId||!current)return;setBusy(true);setError('');setMessage('');
  try{
   const body={title:`${draft.title} (копия)`.slice(0,80),subtitle:draft.subtitle.trim(),minutes:draft.minutes,category:draft.category,basis:draft.basis.trim(),description:draft.description.trim(),steps:draft.steps.map(({title,text})=>({title,text}))};
   const r=await api<{practice:CustomPractice}>('/doctor/practices',body);
   const newId=r.practice.id.slice(7),oldId=editingId.slice(7);
   for(const kind of ['photo','video'] as const){
    const has=kind==='photo'?current.photoUrl:current.videoUrl;
    if(!has)continue;
    const res=await fetch(`/api/practices/${oldId}/media/${kind}`,{credentials:'same-origin'});
    if(res.ok)await sendMedia(newId,kind,new File([await res.blob()],`copy.${kind==='photo'?'jpg':'mp4'}`,{type:res.headers.get('content-type')||''}));
   }
   await reload();
   const made=(await api<{practices:CustomPractice[]}>('/doctor/practices')).practices.find(p=>p.id===r.practice.id);
   if(made)open(made);
   setMessage('Копия создана. Измените название и сохраните.');
  }catch(e){setError(e instanceof Error?e.message:errorText(e));}finally{setBusy(false);}
 }
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
     <p className="muted small">Перетащите шаг за кнопку «Перетащить» или поставьте его кнопками «Выше» и «Ниже».</p>
     <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={draft.steps.map(s=>s.uid)} strategy={verticalListSortingStrategy}>
       {draft.steps.map((s,i)=><StepRow key={s.uid} step={s} index={i} count={draft.steps.length} onMove={d=>moveStepTo(i,i+d)} onRemove={()=>setDraft(d=>({...d,steps:d.steps.filter(x=>x.uid!==s.uid)}))} onChange={patch=>setStep(s.uid,patch)}/>)}
      </SortableContext>
     </DndContext>
     <Button variant="outline" disabled={draft.steps.length>=MAX_STEPS} onClick={()=>setDraft(d=>({...d,steps:[...d.steps,newStep()]}))}>Добавить шаг</Button>
    </section>
    <Group><Button onClick={()=>void save()} loading={busy}>{editingId?'Сохранить':'Создать практику'}</Button>{editingId&&!readOnly?<Button variant="outline" onClick={()=>void copy()} loading={busy}>Копировать практику</Button>:null}</Group>
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
    </>:<>
     <p className="muted small">Можно сразу выбрать фото и видео: они сохранятся вместе с практикой.</p>
     <Group gap="var(--sp-3)" mt="var(--sp-3)">
      <FileButton onChange={f=>void pick('photo',f)} accept="image/jpeg,image/png,image/webp" disabled={busy}>{p=><Button {...p} variant="outline" size="sm" disabled={busy}>{pending.photo?'Заменить фото':'Выбрать фото'}</Button>}</FileButton>
      {pending.photo?<span className="muted small">{pending.photo.name}</span>:null}
     </Group>
     {pendingPhotoUrl?<img className="practice-pending-photo" src={pendingPhotoUrl} alt={`Фото к практике: ${draft.title||'без названия'}`}/>:null}
     <Group gap="var(--sp-3)" mt="var(--sp-3)">
      <FileButton onChange={f=>void pick('video',f)} accept="video/mp4,video/webm" disabled={busy}>{p=><Button {...p} variant="outline" size="sm" disabled={busy}>{pending.video?'Заменить видео':'Выбрать видео'}</Button>}</FileButton>
      {pending.video?<span className="muted small">{pending.video.name}</span>:null}
     </Group>
     {pendingVideoUrl?<video className="profile-video-player" src={pendingVideoUrl} controls playsInline preload="metadata" aria-label="Видео к практике (ещё не сохранено)"/>:null}
     <p className="muted small">Фото до 5 МБ, видео до 50 МБ и до 3 минут.</p>
    </>}
    <h3 style={{marginTop:'var(--sp-5)'}}>Так увидит пациент</h3>
    <ol className="doctor-practice-preview">{draft.steps.filter(s=>s.title||s.text).map((s,i)=><li key={s.uid}><strong>{s.title||'Без названия'}</strong>{s.text?<p className="muted small">{s.text}</p>:null}</li>)}</ol>
   </aside>
  </div>
  {error?<ErrorBox message={error}/>:null}{message?<Alert color="forest" role="status" mt="var(--sp-4)">{message}</Alert>:null}
 </>;
}
