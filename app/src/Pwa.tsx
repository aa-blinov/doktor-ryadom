import {useEffect,useRef,useState} from 'react';
import {Button} from '@mantine/core';
import {useRegisterSW} from 'virtual:pwa-register/react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
let installPrompt:InstallPrompt|null=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event as InstallPrompt;window.dispatchEvent(new Event('pwa-install-ready'));});
window.addEventListener('appinstalled',()=>{installPrompt=null;window.dispatchEvent(new Event('pwa-install-ready'));});

function withTimeout<T>(promise:Promise<T>,ms:number,fallback:T):Promise<T>{
 return Promise.race([promise.catch(()=>fallback),new Promise<T>(r=>setTimeout(()=>r(fallback),ms))]);
}

function postSkipWaiting(){
 const registration=navigator.serviceWorker?.controller?{waiting:navigator.serviceWorker.controller} as ServiceWorkerRegistration:null;
 void navigator.serviceWorker?.getRegistration().then(reg=>{
  reg?.waiting?.postMessage({type:'SKIP_WAITING'});
  reg?.active?.postMessage({type:'SKIP_WAITING'});
  navigator.serviceWorker?.controller?.postMessage({type:'SKIP_WAITING'});
 }).catch(()=>{});
 if(registration)navigator.serviceWorker?.controller?.postMessage({type:'SKIP_WAITING'});
}

export function PwaUpdates(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const clicked=useRef(false);
 const {needRefresh:[pending,setPending],updateServiceWorker}=useRegisterSW({
  immediate:true,
  onRegisteredSW(_url,registration){
   if(!registration)return;
   const check=()=>{if(navigator.onLine)void registration.update().catch(()=>{});};
   window.addEventListener('online',check);
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
   registration.addEventListener('updatefound',()=>{
    const next=registration.installing;
    next?.addEventListener('statechange',()=>{
     if(next.state==='installed'&&navigator.serviceWorker?.controller)setPending(true);
    });
   });
   if(registration.waiting&&navigator.serviceWorker?.controller)setPending(true);
  },
  onRegisterError(){setError('Не удалось подготовить приложение для установки. Перезагрузите страницу при подключённом интернете.');}
 });

 useEffect(()=>{
  const onController=()=>{if(clicked.current)location.reload();};
  navigator.serviceWorker?.addEventListener('controllerchange',onController);
  return()=>{navigator.serviceWorker?.removeEventListener('controllerchange',onController);};
 },[]);

 if(!pending&&!error)return null;

 async function onUpdate(){
  if(clicked.current)return;
  clicked.current=true;
  setBusy(true);
  postSkipWaiting();
  try{
   const registration=await withTimeout(navigator.serviceWorker?.getRegistration()??Promise.resolve(null),400,null as ServiceWorkerRegistration|null);
   if(registration)await withTimeout(registration.update().then(()=>undefined),500,undefined);
   postSkipWaiting();
   await withTimeout(updateServiceWorker(false),600,undefined);
  }catch{/* fall through to reload */}
  postSkipWaiting();
  setTimeout(()=>location.reload(),250);
  setTimeout(()=>location.reload(),1500);
 }

 return <div className="pwa-notice" role="status">
  <div className="pwa-notice-card">
   <div className="pwa-notice-copy">
    <strong>{error?'Установка приложения':'Доступно обновление'}</strong>
    <p>{error||'Сохраните текущие ответы перед обновлением'}</p>
   </div>
   {pending?<div className="pwa-notice-actions">
    <Button size="sm" type="button" loading={busy} disabled={busy} onClick={()=>{void onUpdate();}}>Обновить</Button>
    <Button size="sm" type="button" variant="subtle" disabled={busy} onClick={()=>setPending(false)}>Позже</Button>
   </div>:null}
  </div>
 </div>;
}
export function PwaInstall(){
 const [prompt,setPrompt]=useState(installPrompt),[installed,setInstalled]=useState(window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone),[busy,setBusy]=useState(false);
 useEffect(()=>{const refresh=()=>{setPrompt(installPrompt);if(!installPrompt)setInstalled(window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);};const done=()=>setInstalled(true);window.addEventListener('pwa-install-ready',refresh);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('pwa-install-ready',refresh);window.removeEventListener('appinstalled',done);};},[]);
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return <section className="care-section"><h3>Приложение на устройстве</h3>{installed?<p className="muted">Рядом открыто как установленное приложение</p>:<><p className="muted">Добавьте Рядом на главный экран, чтобы открывать кабинет одним нажатием</p>{prompt?<Button variant="outline" mt="sm" loading={busy} onClick={async()=>{setBusy(true);try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);installPrompt=null;setPrompt(null);}finally{setBusy(false);}}}>Установить Рядом</Button>:<p className="muted small">{ios?'В Safari нажмите «Поделиться», затем «На экран Домой». На iPhone push доступны в установленном приложении с iOS 16.4.':'В меню браузера выберите «Установить приложение» или «Добавить на главный экран», если этот пункт доступен'}</p>}</>}</section>;
}
