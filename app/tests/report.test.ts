import { expect,it } from 'vitest';
import { summarize,reportPeriod,csvCell } from '../src/report';
import { entrySchema,type Entry } from '../src/shared';
it('summary uses answer denominators and calendar boundaries without imputing missing values',()=>{
 const entry=(id:string,date:string,extra:Partial<Entry>):Entry=>({id,date,created_at:0,mood:3,sleep:null,anxiety:null,energy:null,functioning:null,sleepContext:null,note:'',habit:null,...extra});
 const entries=[entry('a','2026-10-07',{mood:2,sleep:5,anxiety:4}),entry('b','2026-10-06',{mood:4}),entry('c','2026-09-01',{sleep:20,anxiety:0})];
 const {start,end}=reportPeriod('2026-10-07',14);expect(start).toBe('2026-09-24');const result=summarize(entries,[],start,end);
 expect(result.entries).toHaveLength(2);expect(result.sleep).toEqual({count:1,min:5,max:5,average:5});expect(result.anxietyAnswers).toBe(1);expect(result.highAnxiety).toBe(0);expect(result.difficult).toBe(1);
 expect(entrySchema.safeParse({...entries[0],functioning:4}).success).toBe(false);
});
it('CSV export quotes notes and neutralizes spreadsheet formulas',()=>{expect(csvCell('  =1+1')).toBe('"\'  =1+1"');expect(csvCell('=1+1')).toBe('"\'=1+1"');expect(csvCell('one; "two"')).toBe('"one; ""two"""');expect(csvCell(0)).toBe('"0"');expect(csvCell(null)).toBe('""');});

import {reportPdfData} from '../src/report';
import {defaultPlan,type PatientData,type Report} from '../src/shared';
it('PDF exports the chosen immutable snapshot, omits unrelated dates and keeps missing answers explicit',()=>{
 const entry:Entry={id:'saved',date:'2026-10-07',created_at:0,mood:3,sleep:null,anxiety:0,energy:null,functioning:null,sleepContext:null,note:'Заметка из отправленной сводки',habit:null};
 const snapshot:Report={id:'snapshot',doctor_id:'doctor',from_date:'2026-10-01',to_date:'2026-10-07',created_at:0,reviewed_at:null,entries:[entry],practices:[],plan:defaultPlan,experiences:[{id:'old',date:'2026-10-07',note:'Сохранённое наблюдение',created_at:0}]};
 const data={entries:[{...entry,note:'Новая правка после отправки'}],practices:[],experiences:[{id:'new',date:'2026-10-07',note:'Новое наблюдение',created_at:0}],assessments:[],medications:[],medicationLogs:[],followups:[],goals:[],goalLogs:[]} as unknown as PatientData;
 const output=reportPdfData(data,snapshot,'Александр','2026-10-01','2026-10-07').blocks.map(b=>b.text).join('\n');
 expect(output).toContain('Заметка из отправленной сводки');expect(output).toContain('Сохранённое наблюдение');expect(output).not.toContain('Новая правка');expect(output).not.toContain('Новое наблюдение');expect(output).toContain('Тревога: очень сильная');expect(output).toContain('Сон: нет ответа');
});
