import {useCallback,useEffect,useState} from 'react';
import {Button,Group,Loader,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,formatDate} from './ui';

type InviteRow={id:number;expires:number;token:string|null};

export function DoctorInvites(){
 const [invites,setInvites]=useState<InviteRow[]>([]),[active,setActive]=useState<{id:number;token:string;expires:number}|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState('');
 const load=useCallback(async()=>{setError('');try{const r=await api<{invites:InviteRow[]}>('/doctor/invites');setInvites(r.invites);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function create(){setBusy('new');setError('');setCopied('');try{const result=await api<{id:number;token:string;expires:number}>('/doctor/invites',{});setActive(result);await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 async function revoke(id:number){setBusy(String(id));setError('');try{await api(`/doctor/invites/${id}`,undefined,'DELETE');if(active?.id===id)setActive(null);await load();}catch(e){setError(errorText(e));}finally{setBusy(null);}}
 async function copy(link:string){try{await navigator.clipboard.writeText(link);setCopied('Ссылка скопирована');}catch{setError('Не удалось скопировать. Выделите ссылку и скопируйте вручную');}}
 const link=active?`${window.location.origin}/?invite=${active.token}`:'';
 return <section className="settings-panel doctor-code">
  <h2>Одноразовые ссылки</h2>
  <p className="muted">Пациент подключается только по такой ссылке. Она срабатывает один раз: второй человек по ней уже не пройдёт. Постоянного кода нет.</p>
  <Button loading={busy==='new'} onClick={()=>void create()}>Создать приглашение</Button>
  {active?<>
   <TextInput label="Ссылка для пациента" value={link} readOnly onFocus={e=>e.currentTarget.select()} mt="var(--sp-4)"/>
   <Group mt="var(--sp-3)"><Button variant="outline" onClick={()=>void copy(link)}>Скопировать ссылку</Button><Button variant="subtle" color="red" loading={busy===String(active.id)} onClick={()=>void revoke(active.id)}>Отозвать</Button></Group>
   {copied?<p role="status">{copied}</p>:null}
   <p className="muted small">Действует до {formatDate(new Date(active.expires).toISOString().slice(0,10),true).replace(/\.$/,'')}. Ссылку можно скопировать повторно, пока её не использовали или не отозвали.</p>
  </>:null}
  <h3 style={{marginTop:'var(--sp-5)'}}>Активные ссылки</h3>
  {loading?<Loader size="sm"/>:null}
  {!loading&&!invites.length?<p className="muted small">Активных ссылок нет.</p>:null}
  {invites.map(row=>{const rowLink=row.token?`${window.location.origin}/?invite=${row.token}`:'';return <Group key={row.id} justify="space-between" py="var(--sp-2)" style={{borderTop:'1px solid var(--line)'}}>
   <span className="small">до {formatDate(new Date(row.expires).toISOString().slice(0,10),true).replace(/\.$/,'')}{row.token?null:' · ссылка показана один раз, создайте новую'}</span>
   <Group gap="var(--sp-3)">{row.token?<Button size="xs" variant="outline" onClick={()=>void copy(rowLink)}>Скопировать ссылку</Button>:null}
   <Button size="xs" variant="subtle" color="red" loading={busy===String(row.id)} onClick={()=>void revoke(row.id)}>Отозвать</Button></Group>
  </Group>;})}
  {error?<ErrorBox message={error} retry={invites.length?undefined:load}/>:null}
 </section>;
}
