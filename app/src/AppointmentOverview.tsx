import {useState} from 'react';
import {Button,SegmentedControl} from '@mantine/core';
import {formatDate,Face,HistoryChart} from './ui';
import {api} from './api';
import {appointmentOverview,defaultOverviewPeriod,type OverviewPeriod} from './appointment';
import {todayInTimezone,type PatientData} from './shared';

const plural=(n:number,forms:[string,string,string])=>{const a=Math.abs(n)%100,b=a%10;return a>10&&a<20?forms[2]:b>1&&b<5?forms[1]:b===1?forms[0]:forms[2];};
const dayWord=(n:number)=>`${n} ${plural(n,['день','дня','дней'])}`;

export function AppointmentOverview({data,onOpen,patientId,onSaved}:{data:PatientData;onOpen:(tab:string)=>void;patientId?:string;onSaved?:()=>Promise<void>}){
 const end=todayInTimezone(data.settings.timezone);
 const hasVisit=!!data.followups?.length;
 const [period,setPeriod]=useState<OverviewPeriod>(()=>defaultOverviewPeriod(data,end));
 const summary=appointmentOverview(data,end,period);
 const [reviewing,setReviewing]=useState<string|null>(null);
 async function reviewReport(id:string){if(!patientId)return;setReviewing(id);try{await api(`/doctor/patients/${patientId}/reports/${id}/review`,{});await onSaved?.();}finally{setReviewing(null);}}
 const {current,previous,attention,dynamics,discussionNotes,lastEntry,moodWord,chartEntries,days}=summary;
 const sinceLast=lastEntry?Math.round((Date.parse(summary.end)-Date.parse(lastEntry.date))/86400000):null;
 const signalCount=attention.filter(x=>x.kind!=='pending').length;
 const medicationLogs=data.medicationLogs.filter(l=>l.date>=summary.start&&l.date<=summary.end);
 const experiences=data.experiences.filter(e=>e.date>=summary.start&&e.date<=summary.end);

 const moodPoints=chartEntries.filter(e=>e.mood!==null);
 const anxietyPoints=chartEntries.filter(e=>e.anxiety!==null);
 const showCharts=moodPoints.length>=3||anxietyPoints.length>=3;
 const noData='нет данных';

 return <section className="appointment-overview">
  <header className="overview-toolbar">
   <div>
    <h2>Перед приёмом</h2>
    <p className="muted">Период: с {formatDate(summary.start,true)} по {formatDate(summary.end,true)}, {dayWord(days)}</p>
   </div>
   <SegmentedControl aria-label="Период обзора" value={String(period)} onChange={v=>setPeriod(v==='visit'?'visit':Number(v) as 14|30)} data={[...(hasVisit?[{value:'visit',label:'С рекомендации'}]:[]),{value:'14',label:'14 дней'},{value:'30',label:'30 дней'}]}/>
  </header>
   <ul className="triage-line triage-list" aria-label="Состояние сейчас">
    <li>Последняя отметка: {lastEntry?<><strong>{moodWord}</strong>, {formatDate(lastEntry.date,true)}{sinceLast===0?' (сегодня)':sinceLast===1?' (вчера)':sinceLast!==null?` (${dayWord(sinceLast)} назад)`:''}</>:<strong>пока нет</strong>}</li>
    <li>Дней с отметкой: <strong>{current.entries.length} из {days}</strong></li>
    <li>Обращений: <strong>{signalCount}</strong></li>
   </ul>

  <section className="overview-panel overview-attention" aria-labelledby="attention-title">
   <h2 id="attention-title">На что обратить внимание</h2>
   {attention.length?<div className="attention-list">
    {attention.map((item,i)=><div key={i} className={`attention-row attention-${item.kind}`}>
     <p>{item.text}</p>
     {item.tab?<Button size="xs" variant="subtle" onClick={()=>onOpen(item.tab!)}>{item.actionLabel??'Открыть'}</Button>:null}
    </div>)}
   </div>:<p className="muted">Явных сигналов нет. Ждут просмотра появятся здесь.</p>}
   {summary.pendingReports.length?<div className="attention-pending">
    <h3>Ждут просмотра: сводки</h3>
    {summary.pendingReports.map(r=><div className="attention-row" key={r.id}>
     <p>Сводка за период {formatDate(r.from_date,true)} — {formatDate(r.to_date,true)}</p>
     <Button size="xs" variant="outline" loading={reviewing===r.id} onClick={()=>void reviewReport(r.id)}>Подтвердить просмотр</Button>
    </div>)}
   </div>:null}
   {attention.some(a=>a.kind==='signal')?<p className="muted small attention-note">Наблюдаемые ответы. Клиническую значимость оценивает врач.</p>:null}
  </section>

  {showCharts?<section className="overview-panel overview-charts-wrap">
   <h3>Ход периода</h3>
   <div className="chart-grid overview-charts">
    {moodPoints.length>=3?<section className="chart-panel">
     <h3>Самочувствие</h3>
     <p className="chart-caption">От «очень тяжело» до «очень хорошо»</p>
     <HistoryChart entries={chartEntries} kind="mood" showTrend/>
    </section>:null}

    {anxietyPoints.length>=3?<section className="chart-panel">
     <h3>Тревога</h3>
     <p className="chart-caption">Вверху меньше тревоги (4: без тревоги), внизу больше (0: очень сильная)</p>
     <HistoryChart entries={chartEntries} kind="anxiety" showTrend/>
    </section>:null}
   </div>
  </section>:null}

  <div className="overview-columns">
   <section className="overview-panel overview-state" aria-labelledby="state-title">
    <h3 id="state-title">Состояние</h3>
    {lastEntry?<div className="overview-state-row">
     <Face value={lastEntry.mood} size={40}/>
     <div>
      <strong>{moodWord}</strong>
      <p className="muted">{formatDate(lastEntry.date,true)}</p>
     </div>
    </div>:<p className="muted">Пока нет отметок</p>}
    <dl className="overview-metrics">
     <div><dt>Дней с отметкой</dt><dd>{current.entries.length} из {days}</dd></div>
     <div><dt>Тяжёлое самочувствие</dt><dd>{current.entries.length?`${current.difficult} из ${current.entries.length}`:noData}</dd></div>
     <div><dt>Средний сон</dt><dd>{current.sleep?`${String(current.sleep.average).replace('.',',')} ч`:noData}</dd></div>
     <div><dt>Сильная тревога</dt><dd>{current.anxietyAnswers?`${current.highAnxiety} из ${current.anxietyAnswers}`:noData}</dd></div>
     <div><dt>Трудные дела</dt><dd>{current.functioningAnswers?`${current.difficultTasks} из ${current.functioningAnswers}`:noData}</dd></div>
    </dl>
    <p className="muted small">Только заполненные ответы. Пропуски не заменяются.</p>
   </section>

   <section className="overview-panel overview-dynamics" aria-labelledby="dynamics-title">
    <h3 id="dynamics-title">Динамика</h3>
    <p className="muted">Сравнение с предыдущим периодом: с {formatDate(summary.previousStart,true)} по {formatDate(summary.previousEnd,true)}</p>
    <dl className="overview-metrics">
     {dynamics.map(d=><div key={d.label}>
      <dt>{d.label}</dt>
      <dd>
       <strong>{d.value}</strong>
       {d.previous?<span className="dynamics-prev">{d.previous}</span>:null}
       <span className="muted small dynamics-note">{d.note}</span>
      </dd>
     </div>)}
    </dl>
   </section>
  </div>

  <section className="overview-panel overview-discuss" aria-labelledby="discuss-title">
   <h3 id="discuss-title">Что хочет обсудить пациент</h3>
   {discussionNotes.length?<div className="discuss-list">
    {discussionNotes.map(n=><article key={n.id}>
     <p className="care-prose">{n.note}</p>
     <span className="muted small">{formatDate(n.date,true)}</span>
    </article>)}
   </div>:<p className="muted">Заметок за период нет</p>}
  </section>

  {summary.last?.data.goal?<section className="overview-panel overview-goal">
   <h3>Согласованная цель</h3>
   <p className="overview-goal-text">{summary.last.data.goal}</p>
   {summary.last.data.nextDate?<p className="muted">Следующий приём: {formatDate(summary.last.data.nextDate,true)}</p>:null}
  </section>:null}

  <section className="overview-panel overview-details">
   <h3>Как считаются показатели</h3>
   <p className="muted">Тяжёлое самочувствие: ответы «Тяжело» и «Очень тяжело». Сильная тревога: «Сильная» и «Очень сильная». Трудные дела: «Очень трудно».</p>
   {current.sleep&&previous.sleep?<p className="muted">Сон в предыдущем периоде: {String(previous.sleep.average).replace('.',',')} ч, ответов {previous.sleep.count}</p>:null}
   <p className="muted">Приём препаратов: отметок {medicationLogs.length}{medicationLogs.length?`, с пропуском ${medicationLogs.filter(l=>l.status==='missed').length}`:''}. Практик пациента: {experiences.length}.</p>
  </section>
 </section>;
}
