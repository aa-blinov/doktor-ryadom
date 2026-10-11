import {useCallback,useEffect,useState} from 'react';
import {Button,Group,Loader,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,formatDate} from './ui';

type InviteRow={id:number;expires:number};

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
  <Button loading={busy==='new'} onClick={()=>void create()}>Создать ссылку</Button>
  {active?<>
   <TextInput label="Ссылка для пациента" value={link} readOnly onFocus={e=>e.currentTarget.select()} mt="md"/>
   <Group mt="sm"><Button variant="outline" onClick={()=>void copy(link)}>Скопировать ссылку</Button><Button variant="subtle" color="red" loading={busy===String(active.id)} onClick={()=>void revoke(active.id)}>Отозвать</Button></Group>
   {copied?<p role="status">{copied}</p>:null}
   <p className="muted small">Действует до {formatDate(new Date(active.expires).toISOString().slice(0,10),true).replace(/\.$/,'')}. Показана только сейчас — сохраните её, пока не отправили пациенту.</p>
  </>:null}
  <h3 style={{marginTop:24}}>Неиспользованные</h3>
  {loading?<Loader size="sm"/>:null}
  {!loading&&!invites.length?<p className="muted small">Активных ссылок нет.</p>:null}
  {invites.map(row=><Group key={row.id} justify="space-between" py={8} style={{borderTop:'1px solid var(--line)'}}>
   <span className="small">до {formatDate(new Date(row.expires).toISOString().slice(0,10),true).replace(/\.$/,'')}</span>
   <Button size="xs" variant="subtle" color="red" loading={busy===String(row.id)} onClick={()=>void revoke(row.id)}>Отозвать</Button>
  </Group>)}
  {error?<ErrorBox message={error} retry={invites.length?undefined:load}/>:null}
 </section>;
}
