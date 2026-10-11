import { useEffect } from 'react';
export function useRefreshOnReturn(refresh:()=>Promise<void>){
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const resume=()=>{if(document.visibilityState!=='visible')return;clearTimeout(timer);timer=setTimeout(()=>{void refresh();},150);};
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[refresh]);
}
