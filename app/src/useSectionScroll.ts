import {useLayoutEffect} from 'react';
type Position={top:number;anchor?:string;offset?:number};
const positions=new Map<string,Position>();
/** Each route/clinician section owns its scroll position; async content may arrive later. */
export function useSectionScroll(key:string|null){
 useLayoutEffect(()=>{
  if(!key)return;
  // Only positions left by in-app navigation in this page load are restored; a fresh open starts at the top.
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  const saved=positions.get(key);
  const target=saved??{top:0};
  let current=target,restoring=true,frame=0,lastApplied=window.scrollY,settled=false,timer=window.setTimeout(()=>{},0);
  const capture=()=>{
   if(restoring)return;
   const anchors=Array.from(document.querySelectorAll<HTMLElement>('#main-content [data-scroll-anchor]')).filter(e=>e.getClientRects().length&&e.getBoundingClientRect().top<=90);
   const anchor=anchors.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];
   current={top:window.scrollY,...(anchor?{anchor:anchor.dataset.scrollAnchor,offset:anchor.getBoundingClientRect().top}:{})};
   positions.set(key,current);
  };
  const stop=()=>{restoring=false;observer.disconnect();resize.disconnect();clearTimeout(timer);cancelAnimationFrame(frame);};
  const restore=()=>{
   if(!restoring||settled)return;
   const anchor=target.anchor?document.querySelector<HTMLElement>(`#main-content [data-scroll-anchor="${CSS.escape(target.anchor)}"]`):null;
   const top=anchor?anchor.getBoundingClientRect().top+window.scrollY-(target.offset??0):target.top;
   window.scrollTo({top:Math.max(0,top),behavior:'instant'});
   lastApplied=window.scrollY;
   const tallEnough=document.documentElement.scrollHeight>=(target.top||0)+innerHeight*0.9;
   if(tallEnough){
    settled=true;
    clearTimeout(timer);
    timer=window.setTimeout(()=>{stop();capture();},800);
   }
  };
  const schedule=()=>{if(settled)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(restore);};
  const observer=new MutationObserver(schedule);observer.observe(document.getElementById('main-content')??document.body,{childList:true,subtree:true});
  const resize=new ResizeObserver(schedule);resize.observe(document.getElementById('main-content')??document.body);
  clearTimeout(timer);
  timer=window.setTimeout(()=>{stop();capture();},20000);
  const intent=()=>{stop();capture();};
  const keyboard=(event:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))intent();};
  const scrolled=()=>{if(restoring&&Math.abs(window.scrollY-lastApplied)>2){settled=true;stop();capture();return;}capture();};
  // Save while the old screen is still on the page: the hash change fires before React re-renders.
  const leaving=()=>{if(!restoring)capture();};
  window.addEventListener('hashchange',leaving);
  window.addEventListener('scroll',scrolled,{passive:true});
  window.addEventListener('wheel',intent,{passive:true});
  window.addEventListener('touchstart',intent,{passive:true});
  window.addEventListener('pointerdown',intent,{passive:true});
  window.addEventListener('keydown',keyboard);
  restore();
  return()=>{
   stop();
   positions.set(key,current);
   window.removeEventListener('hashchange',leaving);
   window.removeEventListener('scroll',scrolled);
   window.removeEventListener('wheel',intent);
   window.removeEventListener('touchstart',intent);
   window.removeEventListener('pointerdown',intent);
   window.removeEventListener('keydown',keyboard);
  };
 },[key]);
}
