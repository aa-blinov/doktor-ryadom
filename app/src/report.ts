import type { Entry, PracticeLog } from './shared';
export function reportPeriod(endDate:string,days:number){return {start:new Date(Date.parse(endDate)-(days-1)*86400000).toISOString().slice(0,10),end:endDate};}
export function summarize(entries:Entry[],practices:PracticeLog[],start:string,end:string){
 const selected=entries.filter(e=>e.date>=start&&e.date<=end);
 const sleeps=selected.flatMap(e=>e.sleep===null?[]:[e.sleep]);
 return {entries:selected,practices:practices.filter(p=>p.completed_at>=Date.parse(start)&&p.completed_at<Date.parse(end)+86400000),sleep:sleeps.length?{count:sleeps.length,min:Math.min(...sleeps),max:Math.max(...sleeps),average:Math.round(sleeps.reduce((a,b)=>a+b,0)/sleeps.length*10)/10}:null,difficult:selected.filter(e=>e.mood<=2).length,anxietyAnswers:selected.filter(e=>e.anxiety!==null).length,highAnxiety:selected.filter(e=>e.anxiety!==null&&e.anxiety<=1).length,functioningAnswers:selected.filter(e=>e.functioning!==null).length,difficultTasks:selected.filter(e=>e.functioning===1).length,notes:selected.filter(e=>e.note.trim())};
}
export function downloadText(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csvCell(value:unknown){let text=String(value??'');if(typeof value==='string'&&/^\s*[=+\-@]|^[\t\r\n]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;}

import type {PatientData,Report} from './shared';
const goalStatus={step:'Сделал(а) шаг',difficult:'Возникла трудность',reached:'Достиг(ла) цели'};
import {assessmentTitle,assessmentScore,assessmentAnswerLines,assessmentMethodology,standardKind,phq9NeedsReview} from './assessments';
export function selectCareData(data:PatientData,snapshot:Report|undefined,start:string,end:string){
 const source=snapshot??data;return {assessments:(source.assessments??[]).filter(a=>a.completed_at&&a.completed_at>=Date.parse(start)&&a.completed_at<Date.parse(end)+86400000),medications:(source.medications??[]).filter(m=>m.start_date<=end&&(!m.end_date||m.end_date>=start)),logs:(source.medicationLogs??[]).filter(l=>l.date>=start&&l.date<=end),experiences:(source.experiences??[]).filter(e=>e.date>=start&&e.date<=end),followups:(source.followups??[]).filter(f=>f.created_at>=Date.parse(start)&&f.created_at<Date.parse(end)+86400000)};
}
export function careTextLines(data:PatientData,snapshot:Report|undefined,start:string,end:string){
 const care=selectCareData(data,snapshot,start,end);return [
  'Опросники:',...care.assessments.map(a=>`${assessmentTitle(a)}: ${assessmentScore(a)}; ${new Date(a.completed_at!).toISOString().slice(0,10)}; исходные ответы: ${assessmentAnswerLines(a).join('; ')}${phq9NeedsReview(a)?'; Пункт 9: нужна отдельная оценка врачом':''}${a.safety?`; связь: ${a.safety.contact}; просмотр: ${a.safety.reviewNote}`:''}; методика: ${a.definition?.methodology??assessmentMethodology[standardKind(a.kind)].methodology}; источник: ${a.definition?.sourceUrl||a.definition?.sourceName|| assessmentMethodology[standardKind(a.kind)].publication}`),
  'Назначения:',...care.medications.flatMap(m=>[`${m.name}: ${m.instructions}; с ${m.start_date}${m.end_date?` по ${m.end_date}`:''}`, ...care.logs.filter(l=>l.medication_id===m.id).map(l=>`${l.date}: ${l.status==='taken'?'по назначению':l.status==='missed'?'был пропуск':'по необходимости не понадобился'}${l.note?`; ${l.note}`:''}`)]),
  'Ощущения и события:',...care.experiences.map(e=>`${e.date}: ${e.note}`),
  'Личные цели:',...(snapshot?(snapshot.goalLogs??[]):(data.goalLogs??[])).filter(g=>g.created_at>=Date.parse(start)&&g.created_at<Date.parse(end)+86400000).map(g=>`${new Date(g.created_at).toISOString().slice(0,10)}: ${(snapshot?(snapshot.goals??[]):(data.goals??[])).find(goal=>goal.id===g.goal_id)?.title??'Личная цель'}; ${goalStatus[g.status]}; ${g.note}`),
  'После приёма:',...care.followups.map(f=>`${new Date(f.created_at).toISOString().slice(0,10)}: ${f.data.notes}; цель: ${f.data.goal||'не указана'}; следующий приём: ${f.data.nextDate||'не указан'}; связь: ${f.data.contact||'не указана'}`)
 ];
}

import {moods} from './shared';
import {practiceContent} from './practices';
import type {PdfReport,PdfBlock} from './reportPdf';
export function reportPdfData(data:PatientData,snapshot:Report|undefined,name:string,start:string,end:string):PdfReport{
 const summary=summarize(snapshot?.entries??data.entries,snapshot?.practices??data.practices,start,end);
 const blocks:PdfBlock[]=[];
 const heading=(text:string)=>blocks.push({text,kind:'heading'});
 const body=(text:string)=>blocks.push({text:text.replace(/^(\d{4})-(\d{2})-(\d{2})(?=:)/,'$3.$2.$1')});
 heading('Краткая сводка');
 body(`Отметок: ${summary.entries.length}. Тяжело или очень тяжело: ${summary.difficult} из ${summary.entries.length}`);
 body(summary.sleep?`Сон: ${summary.sleep.average} ч в среднем, от ${summary.sleep.min} до ${summary.sleep.max} ч, ответов: ${summary.sleep.count}`:'Сон: нет ответов');
 body(summary.anxietyAnswers?`Сильная или очень сильная тревога: ${summary.highAnxiety} из ${summary.anxietyAnswers} ответов`:'Тревога: нет ответов');
 body(summary.functioningAnswers?`Обычные дела давались очень трудно: ${summary.difficultTasks} из ${summary.functioningAnswers} ответов`:'Обычные дела: нет ответов');
 heading('Что хочется обсудить');
 if(!summary.notes.length)body('Заметок за период нет');
 for(const e of [...summary.notes].sort((a,b)=>a.date.localeCompare(b.date)))body(`${e.date}: ${e.note}`);
 heading('Ответы по дням');
 for(const e of [...summary.entries].sort((a,b)=>a.date.localeCompare(b.date))){
  body(`${e.date}: ${moods[e.mood-1]}. Сон: ${e.sleep===null?'нет ответа':`${e.sleep} ч`}. Тревога: ${e.anxiety===null?'нет ответа':['очень сильная','сильная','умеренная','небольшая','не замечал(а)'][e.anxiety]}. Энергия: ${e.energy===null?'нет ответа':`${e.energy}/5`}. Обычные дела: ${e.functioning===null?'нет ответа':e.functioning===1?'без трудностей':e.functioning===2?'с трудностями':'очень трудно'}${e.sleepContext?`. После короткого сна: ${e.sleepContext==='tired'?'усталость':e.sleepContext==='active'?'необычно много энергии':'как обычно'}`:''}${e.habit===null?'':`. Небольшое действие: ${e.habit?'получилось':'не получилось'}`}`);
 }
 const careHeadings=new Set(['Опросники:','Назначения:','Ощущения и события:','Личные цели:','После приёма:']);
 const careLines=careTextLines(data,snapshot,start,end);
 for(let i=0;i<careLines.length;i++){const text=careLines[i];if(careHeadings.has(text)){if(careLines[i+1]&&!careHeadings.has(careLines[i+1]))heading(text.slice(0,-1));}else body(text);}
 if(summary.practices.length){heading('Опыт практик');for(const p of summary.practices)body(`${new Date(p.completed_at).toISOString().slice(0,10)}: ${practiceContent.find(x=>x.id===p.practice_id)?.title??p.practice_id}, ${p.feedback==='comfortable'?'комфортно':p.feedback==='same'?'без изменений':'неприятно'}${p.note?`. ${p.note}`:''}`);}
 blocks.push({text:'Сводка содержит самоотчёты. Пропуски не заменяются ответами. Баллы отдельных опросников интерпретирует врач',kind:'note'});
 return {name,start,end,blocks};
}
