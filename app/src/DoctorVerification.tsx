import {useCallback,useEffect,useState} from 'react';
import {Alert,Button,Loader,NativeSelect,TextInput,Textarea} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox,PageHead} from './ui';
import {navigate} from './App';
import {specialtyKinds,specialtyLabels,type SpecialtyKind,type User} from './shared';
type Request={id:string;kind:SpecialtyKind|null;specialty:string;license:string;city:string;note:string;status:'pending'|'needs_info'|'approved'|'rejected';admin_note:string;created_at:number;updated_at:number};
export function DoctorVerification({user}:{user:User}){
 const [request,setRequest]=useState<Request|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const [form,setForm]=useState<{kind:SpecialtyKind|'';specialty:string;license:string;city:string;note:string}>({kind:'',specialty:'',license:'',city:'',note:''});
 const load=useCallback(async()=>{setError('');try{const result=await api<{verified:boolean;request:Request|null}>('/doctor/verification');setRequest(result.request);if(result.request&&(result.request.status==='needs_info'||result.request.status==='rejected'))setForm({kind:result.request.kind??'',specialty:result.request.specialty,license:result.request.license,city:result.request.city,note:result.request.note});}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function submit(){setBusy(true);setError('');setDone(false);try{await api('/doctor/verification',form);setDone(true);await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const status=request?.status;
 const canSubmit=!status||status==='needs_info'||status==='rejected';
 return <><PageHead title="Подключение врача" description="Проверим квалификацию, после этого откроются пациенты и приглашения"/>
  {loading?<Loader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {status==='pending'?<Alert color="forest" mb="var(--sp-4)" title="Заявка на проверке">Мы проверим данные и сообщим результат. Пока можно заполнить настройки аккаунта.</Alert>:null}
  {status==='needs_info'?<Alert className="verification-notice" color="yellow" mb="var(--sp-4)" title="Нужны уточнения">{request?.admin_note||'Уточните данные и отправьте заявку снова.'}</Alert>:null}
  {status==='rejected'?<Alert color="red" mb="var(--sp-4)" title="Заявка отклонена">{request?.admin_note||'Проверьте данные и отправьте заявку снова.'}</Alert>:null}
  {status==='approved'||user.specialist_verified_at?<Alert color="forest" mb="var(--sp-4)" title="Профиль подтверждён">Можно приглашать пациентов. Если пациентов не видно, обновите страницу.<div><Button mt="var(--sp-3)" onClick={()=>navigate('/patients')}>К пациентам</Button></div></Alert>:null}
  {canSubmit&&!loading?<form className="care-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   <NativeSelect label="Тип специалиста" description="Назначать препараты в приложении может только психиатр" value={form.kind} onChange={e=>setForm({...form,kind:e.currentTarget.value as SpecialtyKind|''})} required data={[{value:'',label:'Выберите'},...specialtyKinds.map(k=>({value:k,label:specialtyLabels[k]}))]}/>
   <TextInput label="Специальность" placeholder="Как указано в дипломе, например: врач-психиатр" value={form.specialty} onChange={e=>setForm({...form,specialty:e.currentTarget.value})} required minLength={2} maxLength={80}/>
   <TextInput label="Номер лицензии или диплома" value={form.license} onChange={e=>setForm({...form,license:e.currentTarget.value})} required minLength={3} maxLength={60}/>
   <TextInput label="Город" value={form.city} onChange={e=>setForm({...form,city:e.currentTarget.value})} required minLength={2} maxLength={80}/>
   <Textarea label="Комментарий администратору" description="Необязательно" value={form.note} onChange={e=>setForm({...form,note:e.currentTarget.value})} maxLength={500} autosize minRows={3}/>
   {done?<p className="muted small" role="status">Заявка отправлена</p>:null}
   <Button type="submit" loading={busy}>{status?'Отправить заявку снова':'Отправить заявку'}</Button>
  </form>:null}
 </>;
}
