import {useEffect,useState} from 'react';
import {Alert,Button,Switch,TextInput} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox} from './ui';
import {defaultSettings,type Settings} from './shared';
import {ReminderSettings} from './ReminderSettings';
export function DoctorReminders({emailVerified=false}:{emailVerified?:boolean}){
 const [settings,setSettings]=useState<Settings|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api<{settings:Settings}>('/settings').then(r=>setSettings({...defaultSettings,...r.settings})).catch(e=>setError(errorText(e)));},[]);
 async function save(){setBusy(true);setError('');try{await api('/settings',settings,'PUT');setMessage('Настройки уведомлений сохранены');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <section className="account-security"><h2>Уведомления врача</h2>{settings?<><TextInput type="time" label="Время ежедневной сводки" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.currentTarget.value})}/><ReminderSettings doctor settings={settings} onChange={setSettings} emailVerified={emailVerified}/><Switch label="Поставить уведомления на паузу" checked={settings.paused} onChange={e=>setSettings({...settings,paused:e.currentTarget.checked})}/><Button mt="var(--sp-5)" loading={busy} onClick={save}>Сохранить уведомления</Button></>:null}{error?<ErrorBox message={error}/>:null}{message?<Alert color="forest" role="status">{message}</Alert>:null}</section>;
}
