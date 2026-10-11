import type {PracticeId} from './shared';
import {practiceContent} from './practices';
import {scenes,heroStep} from './practiceScenes';

const categoryColors={
 'Внимание вокруг':{tone:'#3f6b4e',wash:'#e7efe6',acc:'#b7782f'},
 'Мысли и чувства':{tone:'#6b5678',wash:'#f0eaf2',acc:'#b2536f'},
 'Забота о себе':{tone:'#3f6672',wash:'#e6eef1',acc:'#c0643a'}
} as const;

function colorsFor(id:PracticeId){
 const category=practiceContent.find(p=>p.id===id)?.category??'Внимание вокруг';
 return categoryColors[category as keyof typeof categoryColors]??categoryColors['Внимание вокруг'];
}

export function PracticeVisual({id,step='hero',compact=false}:{id:PracticeId;step?:number|'hero';compact?:boolean}){
 const list=scenes[id];
 const index=step==='hero'?heroStep[id]:Math.min(Math.max(step,0),list.length-1);
 const scene=list[index];
 const {tone,wash,acc}=colorsFor(id);
 return <div className={`practice-art${compact?' compact':''}`} style={{background:wash,color:tone,['--art-acc' as string]:acc}} data-practice-visual={id} data-practice-category={practiceContent.find(p=>p.id===id)?.category}>
  <svg viewBox="0 0 260 175" role="img" aria-label={scene.label} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:scene.svg}}/>
 </div>;
}
