import { useState } from 'react';
import { Button, Checkbox, Modal } from '@mantine/core';
import { api, errorText } from './api';

// Shown once per new agreement version. The user cannot go on until they confirm the new text.
export function TermsGate(){
 const [agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function accept(){setBusy(true);setError('');try{await api('/account/terms',{});window.location.reload();}catch(e){setError(errorText(e));setBusy(false);}}
 return <Modal opened onClose={()=>{}} withCloseButton={false} closeOnClickOutside={false} closeOnEscape={false} centered title="Обновилось пользовательское соглашение">
  <p>Изменились правила: срок хранения данных, отзывы под первым именем и возрастное ограничение. Прочитайте новую редакцию и подтвердите её, чтобы продолжить.</p>
  <p><a href="#/terms" target="_blank" rel="noreferrer">Открыть соглашение</a></p>
  <Checkbox checked={agreed} onChange={e=>setAgreed(e.currentTarget.checked)} label="Я прочитал(а) новую редакцию и согласен(на) с ней"/>
  {error?<p role="alert">{error}</p>:null}
  <Button mt="md" disabled={!agreed} loading={busy} onClick={()=>void accept()}>Продолжить</Button>
 </Modal>;
}
