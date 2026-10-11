import { useEffect, useState } from 'react';
import { Button, Alert } from '@mantine/core';
import { IconArrowRight, IconAlertCircle } from '@tabler/icons-react';
import { moods, type Entry } from './shared';
export function Brand(){return <div className="brand"><svg width="35" height="35" viewBox="0 0 36 36" aria-hidden="true"><path fill="currentColor" d="M5 6c13 0 20 9 20 24C12 30 5 21 5 6Z"/><path fill="#a9c3a0" d="M30 4c-11 2-16 10-15 22C27 25 32 16 30 4Z"/></svg><span>рядом<span className="brand-dot" aria-hidden="true">.</span></span></div>}
export function Face({value,size=38}:{value:number;size?:number}){return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.6"/><circle cx="17" cy="20" r="1.6" fill="currentColor"/><circle cx="31" cy="20" r="1.6" fill="currentColor"/>{value===3?<path d="M17 30h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>:<path d={value<3?'M16 33Q24 24 32 33':'M16 28Q24 38 32 28'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>}{value===5?<path d="M15 15l4-1M29 14l4 1" stroke="currentColor" strokeWidth="1.3"/>:null}</svg>}
export function ErrorBox({message,retry}:{message:string;retry?:()=>void}){return <Alert color="red" icon={<IconAlertCircle size={18}/>} role="alert" radius="md">{message}{retry?<Button variant="subtle" size="xs" onClick={retry}>Повторить</Button>:null}</Alert>}
export function Empty({title,description,action,onAction,icon}:{title:string;description:string;action?:string;onAction?:()=>void;icon:React.ReactNode}){return <div className="empty"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{description}</p>{action?<Button onClick={onAction} rightSection={<IconArrowRight size={17}/>}>{action}</Button>:null}</div>}
export function formatDate(date:string,full=false){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:full?'long':'short',...(full?{year:'numeric'}:{})}).format(new Date(date+'T12:00:00'));}
export function PageHead({title,description,action,level=1}:{title:string;description?:string;action?:React.ReactNode;level?:1|2}){return <div className="page-head"><div>{level===1?<h1>{title}</h1>:<h2>{title}</h2>}{description?<p>{description}</p>:null}</div>{action}</div>}
export function trendOf(rows:{date:string;value:number}[],minDelta=0.5){
 if(rows.length<2)return null;
 const xs=rows.map(r=>Date.parse(r.date)),ys=rows.map(r=>r.value);
 const x0=Math.min(...xs),x1=Math.max(...xs);
 if(x1===x0)return null;
 const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
 let num=0,den=0;
 for(let i=0;i<xs.length;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;}
 if(!den)return null;
 const slope=num/den,intercept=my-slope*mx;
 const from=intercept+slope*x0,to=intercept+slope*x1;
 const delta=to-from;
 const dir=Math.abs(delta)<minDelta?'stable':delta>0?'up':'down';
 return {from,to,delta,dir} as {from:number;to:number;delta:number;dir:'up'|'down'|'stable'};
}
export function trendLabel(kind:'mood'|'sleep'|'anxiety'|'energy'|'functioning',dir:'up'|'down'|'stable'){
 if(dir==='stable')return 'Тренд ровный';
 const worseUp=false;
 const worse=dir==='up'?worseUp:!worseUp;
 if(kind==='sleep')return dir==='up'?'Сон длиннее':'Сон короче';
 return worse?'Тренд к ухудшению':'Тренд к улучшению';
}
function useNarrow(){const q='(max-width:700px)';const [n,setN]=useState(()=>typeof window!=='undefined'&&window.matchMedia(q).matches);useEffect(()=>{const m=window.matchMedia(q);const f=()=>setN(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);return n;}
export function HistoryChart({entries,kind,showTrend=true}:{entries:Entry[];kind:'mood'|'sleep'|'anxiety'|'energy'|'functioning';showTrend?:boolean}){
 const [hover,setHover]=useState<string|null>(null);const narrow=useNarrow();const W=narrow?400:600;const H=narrow?200:158;
 const rows=[...entries].reverse().filter(e=>e[kind]!==null);const labels={mood:'Самочувствие',sleep:'Сон',anxiety:'Тревога',energy:'Энергия',functioning:'Обычные дела'};
 const max=kind==='sleep'?Math.max(12,...rows.map(e=>e.sleep??0)):kind==='anxiety'?4:kind==='functioning'?3:5;
 const min=kind==='anxiety'||kind==='sleep'?0:1;
 if(!rows.length)return <p className="muted chart-empty">Пока нет данных</p>;
 const minDay=Date.parse(rows[0].date),span=Math.max(86400000,Date.parse(rows.at(-1)!.date)-minDay);
 const points=rows.map(e=>({date:e.date,value:e[kind]!}));
 const trend=showTrend?trendOf(points):null;
 const bottom=H-38;const plot=bottom-20;const yOf=(v:number)=>bottom-(Math.min(max,Math.max(min,v))-min)/(max-min)*plot;
 const xOf=(date:string)=>40+((Date.parse(date)-minDay)/span)*(W-120);
 return <>
  <svg viewBox={`0 0 ${W} ${H}`} className="history-chart" role="img" aria-label={`${labels[kind]} по дням${trend?`. ${trendLabel(kind,trend.dir)}`:''}. Точные значения приведены в списке ниже.`}>
  {kind!=='sleep'?<rect x="30" y="20" width={W-90} height={plot/3} fill="var(--accent)" fillOpacity=".08" rx="6"/>:null}
  {kind!=='sleep'?<text x={W-54} y={20+plot/3-6} fill="var(--muted)" style={{fontSize:14}}>лучше</text>:null}
  {kind!=='sleep'?<text x={W-54} y={bottom-4} fill="var(--muted)" style={{fontSize:14}}>хуже</text>:null}
  {[0,0.5,1].map(t=><g key={t}><line x1="30" y1={20+t*plot} x2={W-60} y2={20+t*plot} stroke="var(--line)" strokeDasharray="3 5"/><text x="0" y={25+t*plot} fill="var(--muted)" style={{fontSize:16}}>{Math.round(max-(max-min)*t)}{kind==='sleep'?'ч':''}</text></g>)}
  {rows.length>1?<polyline points={rows.map(e=>`${xOf(e.date)},${yOf(e[kind]!)}`).join(' ')} fill="none" stroke="var(--muted)" strokeWidth="2" strokeOpacity=".5" strokeLinejoin="round"/>:null}
  {trend&&rows.length>1?<line x1={xOf(rows[0].date)} y1={yOf(trend.from)} x2={xOf(rows.at(-1)!.date)} y2={yOf(trend.to)} stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 7"><title>Линия тренда</title></line>:null}
  {rows.map(e=>{const v=e[kind]!;const x=xOf(e.date),y=yOf(v);const text=`${formatDate(e.date)}: ${kind==='mood'?moods[v-1]:`${v}${kind==='sleep'?' ч':''}`}`;return <g key={e.id} tabIndex={0} role="img" aria-label={text} onMouseEnter={()=>setHover(e.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(e.id)} onBlur={()=>setHover(null)} onClick={()=>setHover(h=>h===e.id?null:e.id)} style={{cursor:'pointer',outline:'none'}}><circle cx={x} cy={y} r="16" fill="transparent"/><circle cx={x} cy={y} r={hover===e.id?8:6} fill={kind==='sleep'?'var(--chart-sleep)':'var(--accent)'} stroke="var(--surface)" strokeWidth="2"/></g>;})}
  {(()=>{const e=rows.find(r=>r.id===hover);if(!e)return null;const v=e[kind]!;const text=`${formatDate(e.date)}: ${kind==='mood'?moods[v-1]:`${v}${kind==='sleep'?' ч':''}`}`;const w=text.length*9.2+20;const x=Math.min(W-12-w,Math.max(12,xOf(e.date)-w/2));const y=yOf(v);const ty=y>50?y-38:y+14;return <g pointerEvents="none"><rect x={x} y={ty} width={w} height="28" rx="6" fill="var(--ink)"/><text x={x+8} y={ty+19} fill="var(--surface)" style={{fontSize:17}} fontWeight="600">{text}</text></g>;})()}
  <text x="30" y={H-4} fill="var(--muted)" style={{fontSize:16}}>{formatDate(rows[0].date)}</text><text x={W-60} y={H-4} textAnchor="end" fill="var(--muted)" style={{fontSize:16}}>{rows.length>1?formatDate(rows.at(-1)!.date):''}</text>
  </svg>
  {trend?<p className="chart-trend">{trendLabel(kind,trend.dir)}{Math.abs(trend.delta)>=0.5?`: ${trend.delta>0?'+':'−'}${Math.abs(Math.round(trend.delta*10)/10)}${kind==='sleep'?' ч':''}`:''}</p>:null}
 </>;
}

export function SleepInput({value,onChange,label='Сон, часов',showTitle=true}:{value:number|null;onChange:(v:number|null)=>void;label?:string;showTitle?:boolean}){
 const hours=value===null?'':String(Math.floor(value));
 const quarters=value===null?0:Math.round((value-Math.floor(value))*4);
 const minutes=value===null?'':String((quarters*15)%60);
 const setParts=(h:string,m:string)=>{if(h===''&&m==='')return onChange(null);onChange(Number(h||0)+Number(m||0)/60);};
 return <div className="sleep-field">{showTitle?<div className="field-label">{label}</div>:null}<div className="sleep-input" role="group" aria-label={label}>
  <label><span>часов</span><select value={hours} onChange={e=>setParts(e.currentTarget.value,minutes)}><option value="">—</option>{Array.from({length:25},(_,h)=><option key={h} value={h}>{h}</option>)}</select></label>
  <label><span>минут</span><select value={minutes} onChange={e=>setParts(hours,e.currentTarget.value)}><option value="">—</option>{['0','15','30','45'].map(m=><option key={m} value={m}>{m.padStart(2,'0')}</option>)}</select></label>
 </div></div>;
}

export function ScaleRow({label,options,value,onChange,ends}:{label:string;options:{value:number;label:string}[];value:number|null;onChange:(v:number)=>void;ends:[string,string]}){
 const shown=options;
 return <div className="scale-row" role="group" aria-label={label}>
  <p className={value===null?"scale-hint":"scale-hint scale-hint-chosen"}>{options.find(o=>o.value===value)?.label??"Не выбрано"}</p>
  <div className="scale-steps" style={{gridTemplateColumns:`repeat(${options.length},minmax(0,1fr))`}}>
   {shown.map(o=><button type="button" key={o.value} className={value===o.value?'scale-step selected':'scale-step'} aria-pressed={value===o.value} aria-label={o.label} onClick={()=>onChange(o.value)}><span className="scale-dot" aria-hidden="true"/><span className="scale-text">{o.label}</span></button>)}
  </div>
  <div className="scale-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>
 </div>;
}

