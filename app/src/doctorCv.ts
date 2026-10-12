import type {DoctorProfile} from './shared';
import type {PdfBlock,PdfReport} from './reportPdf';

const lines=(text:string)=>text.split('\n').map(s=>s.trim()).filter(Boolean);

/** Build a clean CV-style PDF payload from the doctor profile. */
export function doctorCvReport(name:string,profile:DoctorProfile):PdfReport{
 const blocks:PdfBlock[]=[];
 const heading=(text:string)=>blocks.push({text,kind:'heading'});
 const body=(text:string)=>blocks.push({text});
 const note=(text:string)=>blocks.push({text,kind:'note'});
 if(profile.specialty)body(profile.specialty);
 if(profile.clinic)body(profile.clinic);
 if(profile.address)body(profile.address);
 if(profile.experienceYears!==null)body(`Стаж: ${profile.experienceYears} ${profile.experienceYears%10===1&&profile.experienceYears%100!==11?'год':profile.experienceYears%10>=2&&profile.experienceYears%10<=4&&(profile.experienceYears%100<10||profile.experienceYears%100>=20)?'года':'лет'}`);
 if(profile.about){heading('О себе');body(profile.about);}
 if(lines(profile.focusAreas).length){heading('Направления консультаций');for(const line of lines(profile.focusAreas))body(`• ${line}`);}
 if(lines(profile.education).length){heading('Образование');for(const line of lines(profile.education))body(`• ${line}`);}
 if(lines(profile.courses).length){heading('Курсы и повышение квалификации');for(const line of lines(profile.courses))body(`• ${line}`);}
 if(lines(profile.workHistory).length){heading('Опыт работы');for(const line of lines(profile.workHistory))body(`• ${line}`);}
 note('Резюме сформировано в Рядом. Подтверждающие документы доступны в профиле специалиста.');
 return {name,start:'',end:'',headerTitle:name,headerSubtitle:'Резюме специалиста',fileName:`cv-${name.replace(/\s+/g,'-').toLowerCase()}.pdf`,blocks};
}
