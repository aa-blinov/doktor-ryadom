import { PracticeVisual } from './PracticeVisual';
import { useState } from 'react';
import { Select, TextInput } from '@mantine/core';
import { IconChevronRight, IconLeaf, IconSearch } from '@tabler/icons-react';
import { practiceContent } from './practices';
import type { PatientData } from './shared';
import { Empty, PageHead } from './ui';
import { navigate } from './App';
export function PracticeLibrary({data}:{data:PatientData}) {
 const [query,setQuery]=useState(''),[category,setCategory]=useState('Все направления'),[duration,setDuration]=useState('Любая длительность');
 // Practices disabled after an unpleasant experience stay out of the list; they can be restored in settings.
 const visible=practiceContent.filter(p=>data.plan.practices.includes(p.id)&&!data.settings.blockedPractices.includes(p.id)&&(`${p.title} ${p.subtitle} ${p.basis}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))&&(category==='Все направления'||p.category===category)&&(duration==='Любая длительность'||p.minutes<=(duration==='До 1 минуты'?1:2)));
 return <><PageHead title="Библиотека практик" description="Упражнения из вашего плана. Выберите подходящее сейчас, остановиться можно на любом шаге."/><div className="library-filters"><TextInput label="Найти практику" placeholder="Название или техника" leftSection={<IconSearch size={18}/>} value={query} onChange={e=>setQuery(e.currentTarget.value)}/><Select label="Направление" value={category} onChange={v=>setCategory(v||'Все направления')} data={['Все направления','Внимание вокруг','Мысли и чувства','Забота о себе']}/><Select label="Время" value={duration} onChange={v=>setDuration(v||'Любая длительность')} data={['Любая длительность','До 1 минуты','До 2 минут']}/></div><div className="library-meta"><span aria-live="polite">Найдено: {visible.length}</span></div><div className="library-list">{visible.map(p=><article className="library-item" data-scroll-anchor={`practice-${p.id}`} key={p.id}><PracticeVisual id={p.id} compact/><div className="library-item-head"><span>{p.category}</span><span className="duration">{p.time}</span></div><h2>{p.title}</h2><p>{p.short}</p><a className="text-link library-start" href={`#/practice/${p.id}`}>Начать практику <IconChevronRight size={18}/></a></article>)}</div>{!visible.length?<Empty icon={<IconSearch size={28}/>} title={data.plan.practices.length?"Подходящих практик пока нет":"Врач пока не добавил практики"} description={data.plan.practices.length?(query.trim()||category!=='Все направления'||duration!=='Любая длительность'?"По этим фильтрам ничего нет. Сбросьте поиск или параметры.":"Все упражнения из плана сейчас отключены. Их можно вернуть в настройках."):data.doctor?"Обсудите с врачом, какие упражнения включить в ваш план":"Практики назначает ваш врач. Подключите врача по приглашению, и они появятся здесь"}
  action={!data.plan.practices.length&&!data.doctor?'Подключить врача':undefined} onAction={()=>navigate('/settings/connect')}/>:null}</>;
}

export function PracticeExperienceList({data}:{data:PatientData}) {
 const logs=data.practices.slice(0,8);
 return logs.length?<div className="practice-experience-list">{logs.map(log=><div className="history-row" key={log.id}><div><strong>{practiceContent.find(p=>p.id===log.practice_id)?.title??'Практика'}</strong><small>{new Date(log.completed_at).toLocaleDateString('ru-RU')}</small>{log.note?<p className="care-prose">{log.note}</p>:null}<small>{log.reviewed_at?(log.reviewer_id===data.doctor?.id?'Врач подтвердил просмотр':'Просмотрено предыдущим врачом'):data.doctor?'Ожидает просмотра':'Сохранено в вашем дневнике'}</small></div><span className={`pill ${log.feedback==='unpleasant'?'warm':''}`}>{log.feedback==='comfortable'?'Комфортно':log.feedback==='same'?'Без изменений':'Неприятно'}</span></div>)}</div>:<Empty icon={<IconLeaf size={28}/>} title="Практик пока нет" description="Здесь появятся оценки выполненных практик из вашего плана." action="К практикам" onAction={()=>navigate('/practices')}/>;
}
