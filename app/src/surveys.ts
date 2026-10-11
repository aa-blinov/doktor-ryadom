import {z} from 'zod';
const base={id:z.string().uuid(),label:z.string().trim().min(2,'Напишите вопрос').max(300),required:z.boolean()};
export const surveyQuestionSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('scale'),min:z.number().int().min(0).max(9),max:z.number().int().min(1).max(10),lowLabel:z.string().trim().min(1).max(80),highLabel:z.string().trim().min(1).max(80)}),
 z.object({...base,type:z.literal('choice'),choices:z.array(z.string().trim().min(1).max(100)).min(2).max(8)}),
 z.object({...base,type:z.literal('text')})
]);
export const surveySchema=z.object({title:z.string().trim().min(2,'Укажите название').max(120),prompt:z.string().trim().min(2,'Укажите период и инструкцию').max(300),methodology:z.string().trim().min(10,'Опишите, зачем нужен опрос и как использовать ответы').max(1500),sourceName:z.string().trim().min(2,'Укажите источник или авторство').max(200),sourceUrl:z.union([z.literal(''),z.string().url().max(500).refine(v=>/^https?:\/\//i.test(v),'Нужна ссылка http или https')]),questions:z.array(surveyQuestionSchema).min(1).max(12)}).superRefine((s,ctx)=>{if(new TextEncoder().encode(JSON.stringify(s)).length>14000)ctx.addIssue({code:'custom',message:'Опрос слишком длинный. Сократите вопросы или варианты ответа'});if(new Set(s.questions.map(q=>q.id)).size!==s.questions.length)ctx.addIssue({code:'custom',message:'Вопросы должны иметь разные идентификаторы'});s.questions.forEach((q,i)=>{if(q.type==='scale'&&q.min>=q.max)ctx.addIssue({code:'custom',path:['questions',i],message:'Начало шкалы должно быть меньше конца'});if(q.type==='choice'&&new Set(q.choices).size!==q.choices.length)ctx.addIssue({code:'custom',path:['questions',i],message:'Варианты ответа не должны повторяться'});});});
export type SurveyDefinition=z.infer<typeof surveySchema>;
export type SurveyQuestion=z.infer<typeof surveyQuestionSchema>;
export type SurveySnapshot=SurveyDefinition&{author:string;version:number;templateId:string};
export type SurveyTemplate={id:string;version:number;definition:SurveyDefinition};
export type SurveyAnswer=string|number|null;
export function validSurveyAnswers(s:SurveyDefinition,answers:SurveyAnswer[]){return answers.length===s.questions.length&&s.questions.every((q,i)=>{const v=answers[i];if(v===null)return !q.required;if(q.type==='text')return typeof v==='string'&&v.length<=1000&&(!q.required||!!v.trim());if(typeof v!=='number'||!Number.isInteger(v))return false;return q.type==='scale'?v>=q.min&&v<=q.max:v>=0&&v<q.choices.length;});}
export function surveyAnswerLabel(q:SurveyQuestion,v:SurveyAnswer){if(v===null||v==='')return 'Пропущен';return q.type==='choice'?q.choices[Number(v)]??'Нет ответа':String(v);}
