import {useEffect,useRef,useState} from 'react';
import {api,errorText} from './api';
import type {CheckinDraft} from './shared';
export function useDraft(draft:CheckinDraft,busy:boolean){
 const latest=useRef(draft),queue=useRef(Promise.resolve()),stopped=useRef(false),[saved,setSaved]=useState(''),[error,setError]=useState('');latest.current=draft;stopped.current=busy;
 const serialized=JSON.stringify(draft),hasAnswers=draft.entry.mood>0;
 const persist=()=>{const value=latest.current;queue.current=queue.current.catch(()=>{}).then(async()=>{if(stopped.current||!value.entry.mood)return;try{await api('/patient/draft',value,'PUT');setSaved(JSON.stringify(value));setError('');}catch(e){setError(errorText(e));}});return queue.current;};
 useEffect(()=>{if(busy||!hasAnswers)return;const timer=setTimeout(persist,600);return()=>clearTimeout(timer);},[serialized,busy,hasAnswers]);
 useEffect(()=>{const flush=()=>{if(stopped.current||!latest.current.entry.mood)return;void fetch('/api/patient/draft',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(latest.current),keepalive:true}).catch(()=>{});};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[]);
 return {status:!hasAnswers?'':saved===serialized?'Черновик сохранён':'Сохраняем черновик…',error,flush:persist,drain:()=>queue.current};
}
