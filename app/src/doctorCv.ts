import type {DoctorProfile} from './shared';
import type {PdfBlock,PdfReport} from './reportPdf';

const lines=(text:string)=>text.split('\n').map(s=>s.trim()).filter(Boolean);
const years=(n:number)=>n%10===1&&n%100!==11?'год':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'года':'лет';

/** HR-friendly CV: name, contact line, clear sections. */
export function doctorCvReport(name:string,profile:DoctorProfile,contactEmail?:string):PdfReport{
 const blocks:PdfBlock[]=[];
 const heading=(text:string)=>blocks.push({text,kind:'heading'});
 const body=(text:string)=>blocks.push({text});
 const note=(text:string)=>blocks.push({text,kind:'note'});
 const bulletList=(title:string,items:string[])=>{if(!items.length)return;heading(title);for(const item of items)body('• '+item);};
 const contact=[profile.specialty,profile.clinic,profile.address,profile.experienceYears!==null?`Стаж ${profile.experienceYears} ${years(profile.experienceYears)}`:'',contactEmail].filter(Boolean);
 if(contact.length)body(contact.join(' · '));
 if(profile.about){heading('О себе');body(profile.about);}
 bulletList('Направления консультаций',lines(profile.focusAreas));
 bulletList('Образование',lines(profile.education));
 bulletList('Курсы и повышение квалификации',lines(profile.courses));
 bulletList('Опыт работы',lines(profile.workHistory));
 note('Резюме подготовлено в Рядом. Подтверждающие документы — в профиле специалиста.');
 return {name,start:'',end:'',headerTitle:name,headerSubtitle:'Резюме специалиста',fileName:`cv-${name.replace(/\s+/g,'-').toLowerCase()}.pdf`,blocks};
}
