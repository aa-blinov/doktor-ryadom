import {useCallback,useEffect,useState} from 'react';
import {Button,Loader,Textarea} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageHead,formatDate} from './ui';
import {specialtyLabels,type SpecialtyKind} from './shared';
type Item={id:string;kind:SpecialtyKind|null;specialty:string;license:string;city:string;note:string;status:'pending'|'needs_info'|'approved'|'rejected';admin_note:string;created_at:number;name:string;email:string;specialist_verified_at:number|null};
const statusText={pending:'На проверке',needs_info:'Нужны уточнения',approved:'Подтверждён',rejected:'Отклонён'};
export function AdminVerifications(){
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{setError('');try{const result=await api<{requests:Item[]}>('/admin/verifications');setItems(result.requests);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function decide(id:string,decision:'approve'|'needs_info'|'reject'){setBusy(id);setError('');try{await api(`/admin/verifications/${id}/decision`,{decision,note:notes[id]??''});await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 return <><PageHead title="Заявки врачей" description="Проверка квалификации перед подключением к порталу"/>
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {!loading&&!error&&!items.length?<p className="muted">Заявок пока нет</p>:null}
  <div className="admin-list">{items.map(r=><article className={`care-record admin-card${r.status==='pending'||r.status==='needs_info'?'':' resolved'}`} key={r.id}>
   <div className="admin-card-head"><h3>{r.name}</h3><span className={`pill status-${r.status}`}>{statusText[r.status]}</span></div>
   <p className="muted small">{r.email} · подана {formatDate(new Date(r.created_at).toISOString().slice(0,10))}</p>
   {r.status==='pending'||r.status==='needs_info'?<><p><strong>{r.kind?specialtyLabels[r.kind]:'Тип не указан'}</strong> · {r.specialty}, {r.city}</p>
   <p>Лицензия или диплом: {r.license}</p></>:<p className="small">{r.kind?specialtyLabels[r.kind]+' · ':''}{r.specialty}, {r.city} · {r.license}</p>}
   {r.note?<p className="care-prose">{r.note}</p>:null}
   {r.admin_note?<p className="muted small">Ваш комментарий: {r.admin_note}</p>:null}
   {r.status==='pending'||r.status==='needs_info'?<div className="admin-decision">
    <Textarea label="Комментарий врачу" description="Нужен для уточнения и отказа" value={notes[r.id]??''} onChange={e=>setNotes({...notes,[r.id]:e.currentTarget.value})} maxLength={500} minRows={2}/>
    {(notes[r.id]??'').trim()?null:<p className="muted small">{!r.kind?'Подтвердить нельзя без типа специалиста — укажите его в разделе «Врачи»':'Комментарий нужен только для уточнения и отказа'}</p>}
    <div className="admin-actions">
     <Button loading={busy===r.id} disabled={busy!==null||!r.kind} onClick={()=>void decide(r.id,'approve')}>Подтвердить</Button>
     <Button variant="outline" disabled={busy!==null||!(notes[r.id]??'').trim()} onClick={()=>void decide(r.id,'needs_info')}>Запросить уточнение</Button>
     <Button className="danger-button" variant="subtle" color="red" disabled={busy!==null||!(notes[r.id]??'').trim()} onClick={()=>void decide(r.id,'reject')}>Отклонить</Button>
    </div></div>:null}
  </article>)}</div>
 </>;
}
