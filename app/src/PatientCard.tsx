import {useCallback,useEffect,useState} from 'react';
import {Button} from '@mantine/core';
import {IconArrowLeft} from '@tabler/icons-react';
import {api,errorText} from './api';
import {navigate} from './App';
import {ErrorBox,PageHead,PageLoader} from './ui';

type Card={
 patient:{name:string;birthDate:string|null;about:string};
 history:{at:number;type:'visit'|'assessment'|'medication'|'goal'|'entry';title:string;detail:string}[];
 entries:{id:string;kind:string;kindLabel:string;body:string;occurredOn:string;authorName:string;withdrawn:boolean;withdrawReason:string|null}[];
 medications:{id:string;name:string;instructions:string;asNeeded:boolean;startDate:string;endDate:string|null;doctorName:string}[];
 goals:{id:string;title:string;reason:string;createdAt:number;closedAt:number|null}[];
 assessments:{id:string;title:string;score:number|null;completedAt:number;doctorName:string}[];
 note:string;
};
const dateText=(ms:number)=>new Date(ms).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Almaty'});
const kindLabel:Record<string,string>={visit:'Приём',assessment:'Опросник',medication:'Препарат',goal:'Цель',entry:'Запись врача'};

// The patient's own card: profile, treatment history, medications, goals and questionnaires.
export function PatientCard(){
 const [card,setCard]=useState<Card|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{setCard(await api<Card>('/patient/card'));}catch(e){setError(errorText(e));}},[]);
 useEffect(()=>{void load();},[load]);
 if(!card&&!error)return <PageLoader label="Открываем карточку…"/>;
 return <section className="directory patient-card">
  <button className="back-link" onClick={()=>navigate('/doctors')}><IconArrowLeft size={18}/>Назад</button>
  <PageHead title="Моя карточка" description="Всё, что вы вели и получали в Рядом: приёмы, опросники, препараты и цели"/>
  {error?<ErrorBox message={error} retry={load}/>:null}
  {card?<>
   <section className="doctor-section" aria-labelledby="card-profile">
    <h2 id="card-profile">{card.patient.name}</h2>
    {card.patient.birthDate?<p className="muted">Дата рождения: {card.patient.birthDate}</p>:null}
    {card.patient.about?<p className="profile-prose">{card.patient.about}</p>:null}
    <p className="muted small">{card.note}</p>
   </section>
   <section className="doctor-section" aria-labelledby="card-history">
    <h2 id="card-history">История лечения</h2>
    {!card.history.length?<p className="muted">Пока пусто. Здесь появятся приёмы, опросники и назначения.</p>:null}
    <ol className="card-timeline">{card.history.map((e,i)=><li key={i} className={`card-event card-event-${e.type}`}><span className="muted small">{dateText(e.at)} · {kindLabel[e.type]}</span><strong>{e.title}</strong>{e.detail?<p className="muted small">{e.detail}</p>:null}</li>)}</ol>
   </section>
   <section className="doctor-section" aria-labelledby="card-entries">
    <h2 id="card-entries">Записи врачей</h2>
    {!card.entries.length?<p className="muted">Врач пока не добавлял записей.</p>:null}
    {card.entries.map(e=><article className={e.withdrawn?'request-row card-entry withdrawn':'request-row card-entry'} key={e.id}><div><strong>{e.kindLabel}</strong><p className="muted small">{e.occurredOn} · {e.authorName}</p>{e.withdrawn?<p className="muted small">Отозвано: {e.withdrawReason}</p>:<p className="care-prose">{e.body}</p>}</div></article>)}
   </section>
   <section className="doctor-section" aria-labelledby="card-meds">
    <h2 id="card-meds">Препараты</h2>
    {!card.medications.length?<p className="muted">Назначений нет.</p>:null}
    {card.medications.map(m=><article className="request-row" key={m.id}><div><strong>{m.name}</strong><p className="small">{m.instructions}</p><p className="muted small">{m.doctorName}{m.asNeeded?' · по необходимости':''} · с {m.startDate}{m.endDate?` по ${m.endDate}`:''}</p></div></article>)}
   </section>
   <section className="doctor-section" aria-labelledby="card-goals">
    <h2 id="card-goals">Цели</h2>
    {!card.goals.length?<p className="muted">Целей пока нет.</p>:null}
    {card.goals.map(g=><article className="request-row" key={g.id}><div><strong>{g.title}</strong><p className="small">{g.reason}</p><p className="muted small">{g.closedAt?`Закрыта ${dateText(g.closedAt)}`:'В работе'}</p></div></article>)}
   </section>
   <section className="doctor-section" aria-labelledby="card-assess">
    <h2 id="card-assess">Опросники</h2>
    {!card.assessments.length?<p className="muted">Заполненных опросников пока нет.</p>:null}
    {card.assessments.map(a=><article className="request-row" key={a.id}><div><strong>{a.title}</strong><p className="muted small">{dateText(a.completedAt)} · {a.score===null?'Ответы сохранены':`балл ${a.score}`} · {a.doctorName}</p></div></article>)}
   </section>
   <div className="connect-actions"><Button variant="default" onClick={()=>navigate('/doctors')}>К врачам и записям</Button></div>
  </>:null}
 </section>;
}
