import type {DoctorProfile} from './shared';
import type {PdfBlock,PdfReport} from './reportPdf';

const lines=(text:string)=>text.split('\n').map(s=>s.trim()).filter(Boolean);
const years=(n:number)=>n%10===1&&n%100!==11?'год':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'года':'лет';

async function loadPhoto(photoUrl:string|null){
 if(!photoUrl)return undefined;
 try{
  const res=await fetch(photoUrl,{signal:AbortSignal.timeout(15000)});
  if(!res.ok)return undefined;
  const blob=await res.blob();
  const bmp=await createImageBitmap(blob);
  const width=bmp.width,height=bmp.height;bmp.close();
  const data=new Uint8Array(await blob.arrayBuffer());
  return {data,width,height};
 }catch{return undefined;}
}

/** HR-style CV: photo, name, contact header, clear sections. */
export async function doctorCvReport(name:string,profile:DoctorProfile,contactEmail?:string):Promise<PdfReport>{
 const blocks:PdfBlock[]=[];
 const heading=(text:string)=>blocks.push({text,kind:'heading'});
 const body=(text:string)=>blocks.push({text});
 const note=(text:string)=>blocks.push({text,kind:'note'});
 const bulletList=(title:string,items:string[])=>{if(!items.length)return;heading(title);for(const item of items)body('• '+item);};
 const contactLines=[
  profile.specialty,
  [profile.clinic,profile.address].filter(Boolean).join(', '),
  [profile.experienceYears!==null?`Стаж ${profile.experienceYears} ${years(profile.experienceYears)}`:'',contactEmail].filter(Boolean).join(' · '),
 ].filter(Boolean);
 if(profile.about){heading('О себе');body(profile.about);}
 bulletList('Направления консультаций',lines(profile.focusAreas));
 bulletList('Образование',lines(profile.education));
 bulletList('Курсы и повышение квалификации',lines(profile.courses));
 bulletList('Опыт работы',lines(profile.workHistory));
 note('Резюме подготовлено в Рядом. Подтверждающие документы — в профиле специалиста.');
 return {name,start:'',end:'',headerTitle:name,headerSubtitle:'Резюме специалиста',fileName:`cv-${name.replace(/\s+/g,'-').toLowerCase()}.pdf`,photo:await loadPhoto(profile.photoUrl),contactLines,blocks};
}
