import {expect,it} from 'vitest';
import {appointmentOverview} from '../src/appointment';
import {defaultPlan,defaultSettings,type Entry,type PatientData} from '../src/shared';
it('appointment overview compares explicit periods with real answer counts and separates pending materials',()=>{
 const entry=(date:string,sleep:number|null):Entry=>({id:date,date,sleep,mood:3,anxiety:null,energy:null,functioning:null,sleepContext:null,note:'',habit:null,created_at:0});
 const data:PatientData={entries:[entry('2026-10-08',6),entry('2026-10-07',null),entry('2026-10-06',4),entry('2026-10-05',9),entry('2026-10-03',7)],practices:[{id:'practice',practice_id:'ground',feedback:'same',completed_at:0,reviewed_at:2,reviewer_id:'old-doctor'}],plan:defaultPlan,settings:defaultSettings,doctor:{id:'doctor',name:'Врач'},draft:null,reports:[],assessments:[],followups:[{id:'visit',doctor_id:'doctor',created_at:Date.parse('2026-10-06T12:00:00Z'),data:{notes:'Обсудили план',goal:'',nextDate:null,contact:''}}],medications:[],medicationLogs:[],experiences:[]};
 const result=appointmentOverview(data,'2026-10-08');
 expect(result.start).toBe('2026-10-06');expect(result.current.entries).toHaveLength(3);expect(result.current.sleep).toMatchObject({average:5,count:2});expect(result.previous.sleep).toMatchObject({average:8,count:2});expect(result.pendingPractices).toHaveLength(1);
 expect(data.entries[0].date).toBe('2026-10-08');
 data.followups=[];expect(appointmentOverview(data,'2026-10-08').start).toBe('2026-09-25');
});
