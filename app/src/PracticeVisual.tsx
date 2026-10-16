import {IconLeaf} from '@tabler/icons-react';
import {useState} from 'react';
import {practiceContent} from './practices';
import {scenes,heroStep} from './practiceScenes';
import type {PracticeId} from './shared';

const categoryColors={
 'Внимание вокруг':{tone:'#3f6b4e',wash:'#e7efe6',acc:'#b7782f'},
 'Мысли и чувства':{tone:'#6b5678',wash:'#f0eaf2',acc:'#b2536f'},
 'Забота о себе':{tone:'#3f6672',wash:'#e6eef1',acc:'#c0643a'}
} as const;

function colorsFor(category:string){
 return categoryColors[category as keyof typeof categoryColors]??categoryColors['Внимание вокруг'];
}

// Doctor-written practices have no drawn scenes: their picture is the cover photo, or a plain card in the category colour.
export function PracticeVisual({id,step='hero',compact=false,category,photoUrl=null,label}:{id:string;step?:number|'hero';compact?:boolean;category?:string;photoUrl?:string|null;label?:string}){
 if(!(id in scenes)){
  const colors=colorsFor(category??'Внимание вокруг');
  return <div className={`practice-art${compact?' compact':''}`} style={{background:colors.wash,color:colors.tone,['--art-acc' as string]:colors.acc}} data-practice-visual={id} data-practice-category={category}>
   {photoUrl?<img src={photoUrl} alt={label??''} loading="lazy" decoding="async"/>:<div className="practice-art-placeholder" aria-hidden="true"><IconLeaf size={compact?36:56} stroke={1.5}/></div>}
  </div>;
 }
 const list=scenes[id as PracticeId];
 const index=step==='hero'?heroStep[id as PracticeId]:Math.min(Math.max(step,0),list.length-1);
 const scene=list[index];
 const {tone,wash,acc}=colorsFor(practiceContent.find(p=>p.id===id)?.category??'Внимание вокруг');
 // Every frame is a generated picture, one file per step. The drawn scene stays as the fallback
 // for when a picture cannot load (the files are not precached, so offline is the common case).
 const [dropped,setDropped]=useState(false);
 const art=!dropped
  ?<img src={`practices/${id}-${index}.webp`} alt={scene.label} loading="lazy" decoding="async" onError={()=>setDropped(true)}/>
  :<svg viewBox="0 0 260 175" role="img" aria-label={scene.label} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:scene.svg}}/>;
 return <div className={`practice-art${compact?' compact':''}`} style={{background:wash,color:tone,['--art-acc' as string]:acc}} data-practice-visual={id} data-practice-category={practiceContent.find(p=>p.id===id)?.category}>
  {art}
 </div>;
}
