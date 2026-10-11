import {useEffect,useState} from 'react';
import {Button,Group,Loader,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox} from './ui';
export function DoctorCode(){
 const [data,setData]=useState<{code:string;active:boolean}|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState('');
 async function load(){setError('');try{setData(await api('/doctor/code'));}catch(e){setError(errorText(e));}}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('profile-updated',refresh);return()=>window.removeEventListener('profile-updated',refresh);},[]);
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setCopied(label);}catch{setError('Не удалось скопировать. Выделите код или ссылку и скопируйте вручную');}}
 const link=data?`${window.location.origin}/?invite=${data.code}`:'';
 return <section className="settings-panel doctor-code"><h2>Ваш код врача</h2><p className="muted">Пациент вводит этот код в настройках или открывает ссылку, затем подтверждает доступ к своим записям</p>{data?<><TextInput label="Код врача" value={data.code} readOnly onFocus={e=>e.currentTarget.select()} styles={{input:{letterSpacing:'0.12em',fontWeight:700,fontSize:20}}}/><TextInput label="Ссылка для пациента" value={link} readOnly onFocus={e=>e.currentTarget.select()}/><Group><Button variant="outline" onClick={()=>void copy(data.code,'Код скопирован')}>Скопировать код</Button><Button variant="light" onClick={()=>void copy(link,'Ссылка скопирована')}>Скопировать ссылку</Button></Group>{copied?<p role="status">{copied}</p>:null}<p className="muted small">{data.active?'Код постоянный, его можно передавать нескольким пациентам':'Код уже создан. Подключение пациентов станет доступно после проверки профиля специалиста'}</p></>:!error?<Loader size="sm"/>:null}{error?<ErrorBox message={error} retry={data?undefined:load}/>:null}</section>;
}
