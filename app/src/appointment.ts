import {reportPeriod,summarize} from './report';
import {signals, moods, type PatientData, type Entry} from './shared';
import {phq9NeedsReview} from './assessments';

export type OverviewAttention={
 kind:'safety'|'signal'|'pending';
 text:string;
 tab?:string;
 actionLabel?:string;
};
export type OverviewMetric={
 label:string;
 value:string;
 previous:string;
 note:string;
};

function metric(label:string,value:string,previous:string,note:string):OverviewMetric{
 return {label,value,previous,note};
}
function avgMood(entries:Entry[]){
 if(!entries.length)return null;
 return Math.round(entries.reduce((s,e)=>s+e.mood,0)/entries.length*10)/10;
}
function num(n:number,digits=1){
 return String(Math.round(n*10**digits)/10**digits).replace('.',',');
}

export type OverviewPeriod='visit'|14|30;
function lastFollowup(data:PatientData,end:string){return data.followups?.filter(f=>f.created_at<Date.parse(end)+86400000).slice().sort((a,b)=>b.created_at-a.created_at)[0];}
/** Since the last recommendation when it is at least a week old, otherwise the last 30 days. A very short window shows nothing useful. */
export function defaultOverviewPeriod(data:PatientData,end:string):OverviewPeriod{
 const last=lastFollowup(data,end);
 if(!last)return 30;
 const days=(Date.parse(end)-Date.parse(new Date(last.created_at).toISOString().slice(0,10)))/86400000;
 return days>=7?'visit':30;
}
export function appointmentOverview(data:PatientData,end:string,period?:OverviewPeriod){
 const last=lastFollowup(data,end);
 const visitStart=last?new Date(last.created_at).toISOString().slice(0,10):null;
 const start=period===undefined?(visitStart??reportPeriod(end,14).start):period==='visit'?(visitStart??reportPeriod(end,30).start):reportPeriod(end,period).start;
 const length=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 const previousEnd=new Date(Date.parse(start)-86400000).toISOString().slice(0,10);
 const previousStart=reportPeriod(previousEnd,length).start;
 const current=summarize(data.entries,data.practices,start,end),previous=summarize(data.entries,[],previousStart,previousEnd);
 // was a hardcoded empty list: the count reached the badge but nothing could be confirmed
 const pendingReports=(data.reports??[]).filter(r=>!r.reviewed_at);
 const pendingAssessments=data.assessments.filter(a=>a.doctor_id===data.doctor?.id&&a.completed_at&&!a.reviewed_at);
 const pendingPractices=data.practices.filter(p=>!p.reviewed_at||p.reviewer_id!==data.doctor?.id);
 const pendingGoals=(data.goalLogs??[]).filter(g=>!g.reviewed_at||g.reviewer_id!==data.doctor?.id);

 const entriesAsc=[...data.entries].sort((a,b)=>a.date.localeCompare(b.date));
 const lastEntry=entriesAsc.at(-1)??null;
 const signalList=signals(data.entries);
 const attention:OverviewAttention[]=[];
 if(pendingAssessments.some(phq9NeedsReview)){
  attention.push({kind:'safety',text:'PHQ-9: нужно отдельно просмотреть ответ на пункт 9',tab:'assessments',actionLabel:'Открыть результат'});
 }
 for(const text of signalList)attention.push({kind:'signal',text});
 const pendingItems:[string,number,string,string][]=[
  ['Опросники к просмотру',pendingAssessments.filter(a=>!phq9NeedsReview(a)).length,'assessments','К опросникам'],
  ['Отзывы о практиках к просмотру',pendingPractices.length,'history','К отзывам'],
  ['Отметки по целям к просмотру',pendingGoals.length,'goals','К целям']
 ];
 for(const [label,count,tab,actionLabel] of pendingItems){
  if(count>0)attention.push({kind:'pending',text:`${label}: ${count}`,tab,actionLabel});
 }

 const moodNow=avgMood(current.entries),moodWas=avgMood(previous.entries);
 const dynamics:OverviewMetric[]=[
  metric(
   'Самочувствие',
   moodNow===null?'нет данных':num(moodNow),
   moodWas===null?'':`было ${num(moodWas)}`,
   moodNow!==null&&moodWas!==null?(moodNow-moodWas>0.15?'стало лучше':moodNow-moodWas<-0.15?'стало тяжелее':'без заметных изменений'):'по шкале от 1 до 5'
  ),
  metric(
   'Сон',
   current.sleep?`${num(current.sleep.average)} ч`:'нет данных',
   previous.sleep?`было ${num(previous.sleep.average)} ч`:'',
   current.sleep?`ответов ${current.sleep.count}`:'нет ответов'
  ),
  metric(
   'Сильная тревога',
   current.anxietyAnswers?`${current.highAnxiety} из ${current.anxietyAnswers}`:'нет данных',
   previous.anxietyAnswers?`было ${previous.highAnxiety} из ${previous.anxietyAnswers}`:'',
   'ответы «Сильная» и «Очень сильная»'
  ),
  metric(
   'Трудные дела',
   current.functioningAnswers?`${current.difficultTasks} из ${current.functioningAnswers}`:'нет данных',
   previous.functioningAnswers?`было ${previous.difficultTasks} из ${previous.functioningAnswers}`:'',
   'ответ «Очень трудно»'
  )
 ];

 const discussionNotes=current.notes.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
 const moodWord=lastEntry?moods[lastEntry.mood-1]:null;

 return {
  start,end,previousStart,previousEnd,last,days:length,current,previous,
  pendingReports,pendingAssessments,pendingPractices,pendingGoals,
  attention,dynamics,discussionNotes,lastEntry,moodWord,
  chartEntries:current.entries.slice()
 };
}
