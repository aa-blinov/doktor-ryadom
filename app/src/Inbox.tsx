import {useCallback,useEffect,useState} from 'react';
import {Button} from '@mantine/core';
import {IconBell} from '@tabler/icons-react';
import {api,errorText} from './api';
import {Empty,ErrorBox,PageHead,PageLoader} from './ui';

type Item={id:string;body:string;url:string;createdAt:number;read:boolean};

// Unread count for the navigation badge. Polled every 30 seconds; the page itself refreshes on open.
export function useUnread(userId?:string){
 const [unread,setUnread]=useState(0);
 useEffect(()=>{
  if(!userId){setUnread(0);return;}
  let alive=true;
  const tick=async()=>{try{const r=await api<{unread:number}>('/inbox');if(alive)setUnread(r.unread);}catch{/* offline: keep the last value */}};
  void tick();
  const timer=setInterval(()=>void tick(),30000);
  return()=>{alive=false;clearInterval(timer);};
 },[userId]);
 return unread;
}

// Each role sees only its own notifications: the server filters by the signed-in person.
export function InboxPage(){
 const [items,setItems]=useState<Item[]|null>(null),[fresh,setFresh]=useState<Set<string>>(new Set()),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setError('');
  try{
   const r=await api<{unread:number;items:Item[]}>('/inbox');
   setItems(r.items);
   // What was unread when the page opened stays marked for this visit; then everything is read.
   setFresh(new Set(r.items.filter(i=>!i.read).map(i=>i.id)));
   if(r.unread)await api('/inbox/read',{all:true});
  }catch(e){setError(errorText(e));}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function markAll(){setBusy(true);try{await api('/inbox/read',{all:true});await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <section className="inbox">
  <PageHead title="Уведомления" description="Записи, подтверждения, напоминания и изменения в вашем кабинете. Здесь только то, что касается вас"/>
  {error?<ErrorBox message={error} retry={load}/>:null}
  {items===null&&!error?<PageLoader label="Загружаем уведомления…"/>:null}
  {items&&!items.length?<Empty icon={<IconBell size={28}/>} title="Уведомлений пока нет" description="Они появятся, когда что-то изменится в записи, карточке или проверке профиля"/>:null}
  {items?.length?<>
   <div className="connect-actions"><Button variant="default" loading={busy} onClick={()=>void markAll()}>Отметить все прочитанными</Button></div>
   <ol className="inbox-list">{items.map(i=><li key={i.id} className={fresh.has(i.id)?'inbox-item unread':'inbox-item'}>
    <a href={`#${i.url.replace(/^\/?#?/,'')}`}>{i.body}</a>
    <span className="muted small">{new Date(i.createdAt).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</span>
   </li>)}</ol>
  </>:null}
 </section>;
}
