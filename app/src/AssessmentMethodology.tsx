import type {Assessment} from './shared';
import {assessmentContent,standardKind} from './assessments';

export function AssessmentSource({assessment}:{assessment:Pick<Assessment,'kind'|'definition'>}){
 const d=assessment.definition,kind=standardKind(assessment.kind);
 if(d?.sourceUrl||d?.sourceName){
  return <p className="assessment-source">{d.sourceUrl?<a href={d.sourceUrl} target="_blank" rel="noreferrer">Источник: {d.sourceName}</a>:<span className="muted small">Источник: {d.sourceName}</span>}</p>;
 }
 const href=assessmentContent[kind].source;
 const label=kind==='who5'?'Источник: ВОЗ':'Источник: NHS';
 return <p className="assessment-source"><a href={href} target="_blank" rel="noreferrer">{label}</a></p>;
}

export function AssessmentMethodology({assessment}:{assessment:Pick<Assessment,'kind'|'definition'>}){
 return <AssessmentSource assessment={assessment}/>;
}
