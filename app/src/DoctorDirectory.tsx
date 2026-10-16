import {useCallback,useEffect,useMemo,useState} from 'react';
import {Avatar,Button,Checkbox,Loader,NativeSelect,TextInput,Textarea} from '@mantine/core';
import {IconArrowLeft,IconStar,IconStarFilled} from '@tabler/icons-react';
import {api,errorText} from './api';
import {navigate} from './App';
import {Empty,ErrorBox,PageHead,formatDate, PageLoader} from './ui';
import {specialtyLabels,type SpecialtyKind} from './shared';

const kindFilters=[{label:'Все',value:'all'},{label:'Психологи',value:'psychologist'},{label:'Психотерапевты',value:'psychotherapist'},{label:'Психиатры',value:'psychiatrist'}] as const;

type Card={id:string;name:string;kind:SpecialtyKind|null;city:string;specialty:string;clinic:string;experienceYears:number|null;focusAreas:string;about:string;photoUrl:string|null;rating:number|null;reviewCount:number};
type Review={id:string;rating:number;body:string;createdAt:number;author:string;hidden:boolean};
type Detail={doctor:Card&{address:string;education:string;courses:string;workHistory:string;videoUrl:string|null};reviews:Review[];mine:{rating:number;body:string;hidden:boolean}|null;connection:{linkedToThis:boolean;linkedToOther:boolean;pendingRequestId:string|null}};

const reviewWord=(n:number)=>{const a=n%100,b=n%10;return a>10&&a<20?'отзывов':b===1?'отзыв':b>1&&b<5?'отзыва':'отзывов';};
const years=(n:number)=>{const a=n%100,b=n%10;return a>10&&a<20?'лет':b===1?'год':b>1&&b<5?'года':'лет';};
// Hide free-text specialty when it only repeats the type chip («Психиатр» / «Врач-психиатр» / «Психиатрия»).
function specialtyLine(kind:SpecialtyKind|null,specialty:string){
 if(!specialty)return null;
 if(!kind)return specialty;
 const label=specialtyLabels[kind].toLocaleLowerCase('ru'),text=specialty.trim().toLocaleLowerCase('ru');
 const core=text.replace(/^врач[-\s]*/,'').replace(/[^а-яёa-z]/gi,'');
 if(core===label.replace(/[^а-яёa-z]/gi,'')||core===label.replace(/[^а-яёa-z]/gi,'')+'ия'||core===label.replace(/[^а-яёa-z]/gi,'')+'я')return null;
 return specialty;
}

export function Stars({value,size=18}:{value:number;size?:number}){
 return <span className="stars" role="img" aria-label={`Оценка ${value} из 5`}>{[1,2,3,4,5].map(i=>i<=Math.round(value)?<IconStarFilled key={i} size={size}/>:<IconStar key={i} size={size}/>)}</span>;
}
function Rating({card}:{card:Pick<Card,'rating'|'reviewCount'>}){
 return card.rating===null?<span className="muted small">Отзывов пока нет</span>:<span className="rating-line"><Stars value={card.rating}/><strong>{String(card.rating).replace('.',',')}</strong><span className="muted small">{card.reviewCount} {reviewWord(card.reviewCount)}</span></span>;
}

export function DoctorDirectory(){
 const [doctors,setDoctors]=useState<Card[]>([]),[cities,setCities]=useState<string[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[city,setCity]=useState('');
 const load=useCallback(async()=>{setError('');try{const r=await api<{doctors:Card[];cities:string[]}>('/directory');setDoctors(r.doctors);setCities(r.cities);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const shown=useMemo(()=>doctors.filter(d=>(kind==='all'||d.kind===kind)&&(!city||d.city===city)&&(!query.trim()||[d.name,d.specialty,d.clinic,d.focusAreas].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))),[doctors,kind,city,query]);
 return <section className="directory">
  <button className="back-link" onClick={()=>navigate('/doctor')}><IconArrowLeft size={18}/>Мой врач</button>
  <PageHead title="Найти врача" description="Психологи, психотерапевты и психиатры, чью квалификацию проверил администратор"/>
  <div className="directory-filters">
   <div className="kind-filter" role="group" aria-label="Специальность">
    {kindFilters.map(option=><button key={option.value} type="button" className={kind===option.value?'kind-chip selected':'kind-chip'} aria-pressed={kind===option.value} onClick={()=>setKind(option.value)}>{option.label}</button>)}
   </div>
   <div className="directory-search">
    <TextInput aria-label="Поиск врача" placeholder="Имя, направление или клиника" value={query} onChange={e=>setQuery(e.currentTarget.value)}/>
    {cities.length>1?<NativeSelect aria-label="Город" value={city} onChange={e=>setCity(e.currentTarget.value)} data={[{value:'',label:'Все города'},...cities.map(c=>({value:c,label:c}))]}/>:null}
   </div>
  </div>
  <p className="muted small directory-note">Препараты назначает только психиатр. Психологи и психотерапевты работают разговором и практиками.</p>
  {loading?<PageLoader/>:null}
  {error?<ErrorBox message={error} retry={load}/>:null}
  {!loading&&!error&&!shown.length?<Empty title="Врачей не найдено" description="Измените фильтры или поиск" icon={<IconStar/>} action="Сбросить" onAction={()=>{setKind('all');setQuery('');setCity('');}}/>:null}
  <div className="doctor-list">{shown.map(d=><a key={d.id} className="doctor-card" href={`#/doctors/${d.id}`}>
   <Avatar src={d.photoUrl} size={64} radius="xl" alt="">{d.name.slice(0,1)}</Avatar>
   <div className="doctor-card-main">
    <h2>{d.name}</h2>
    <p className="doctor-card-meta"><span className={`pill kind-${d.kind??'none'}`}>{d.kind?specialtyLabels[d.kind]:'Специалист'}</span>{specialtyLine(d.kind,d.specialty)?<span>{specialtyLine(d.kind,d.specialty)}</span>:null}</p>
    <p className="muted small">{[d.city,d.clinic,d.experienceYears!==null?`стаж ${d.experienceYears} ${years(d.experienceYears)}`:''].filter(Boolean).join(' · ')}</p>
    {d.about?<p className="doctor-card-about">{d.about}{d.about.length>=180?'…':''}</p>:null}
    <Rating card={d}/>
   </div>
  </a>)}</div>
 </section>;
}

export function DoctorPage({id,onChanged}:{id:string;onChanged:()=>Promise<void>}){
 const [data,setData]=useState<Detail|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{setData(await api<Detail>(`/directory/${id}`));}catch(e){setError(errorText(e));}finally{setLoading(false);}},[id]);
 useEffect(()=>{void load();},[load]);
 if(loading)return <PageLoader label="Загружаем карточку врача…"/>;
 if(!data)return <section className="directory"><button className="back-link" onClick={()=>navigate('/doctors')}><IconArrowLeft size={18}/>Все врачи</button>{error?<ErrorBox message={error} retry={load}/>:null}</section>;
 const d=data.doctor;
 const sections=[{title:'Направления консультаций',text:d.focusAreas},{title:'Образование',text:d.education},{title:'Курсы',text:d.courses},{title:'Опыт работы',text:d.workHistory},{title:'Адрес приёма',text:d.address}].filter(s=>s.text);
 return <section className="directory doctor-page-public">
  <button className="back-link" onClick={()=>navigate('/doctors')}><IconArrowLeft size={18}/>Все врачи</button>
  <header className="doctor-hero">
   <Avatar src={d.photoUrl} size={96} radius="xl" alt={`Фото ${d.name}`}>{d.name.slice(0,1)}</Avatar>
   <div>
    <h1>{d.name}</h1>
    <p className="doctor-card-meta"><span className={`pill kind-${d.kind??'none'}`}>{d.kind?specialtyLabels[d.kind]:'Специалист'}</span>{specialtyLine(d.kind,d.specialty)?<span>{specialtyLine(d.kind,d.specialty)}</span>:null}</p>
    <p className="muted">{[d.city,d.clinic,d.experienceYears!==null?`стаж ${d.experienceYears} ${years(d.experienceYears)}`:''].filter(Boolean).join(' · ')}</p>
    <Rating card={d}/>
   </div>
  </header>
  {error?<ErrorBox message={error}/>:null}
  <ConnectPanel name={d.name} connection={data.connection}/>
  {d.videoUrl?<section className="doctor-section"><h2>Видео о себе</h2><video className="profile-video-player" src={d.videoUrl} controls playsInline preload="metadata" aria-label={`Видео о ${d.name}`}/></section>:null}
  {d.about?<section className="doctor-section"><h2>О враче</h2><p className="profile-prose">{d.about}</p></section>:null}
  {sections.map(s=><section className="doctor-section" key={s.title}><h2>{s.title}</h2><p className="profile-prose">{s.text}</p></section>)}
  <Reviews doctorId={id} reviews={data.reviews} mine={data.mine} onChanged={load}/>
 </section>;
}

function ConnectPanel({name,connection}:{name:string;connection:Detail['connection']}){
 return <section className="connect-panel" aria-label="Подключение">
  {connection.linkedToThis?<><p><strong>Это ваш врач</strong></p><Button variant="default" onClick={()=>navigate('/doctor')}>Открыть мой кабинет с врачом</Button></>
  :connection.linkedToOther?<p className="muted">У вас уже подключён другой врач. Чтобы выбрать нового, сначала отзовите доступ в настройках.</p>
  :<><p><strong>Подключение по приглашению</strong></p><p className="muted small">{name} отправит вам одноразовую ссылку. Только после неё появится доступ к обмену записями.</p></>}
 </section>;
}

function Reviews({doctorId,reviews,mine,onChanged}:{doctorId:string;reviews:Review[];mine:Detail['mine'];onChanged:()=>Promise<void>}){
 const [rating,setRating]=useState(mine?.rating??0),[body,setBody]=useState(mine?.body??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 async function save(){setBusy(true);setError('');setSaved(false);try{await api(`/directory/${doctorId}/review`,{rating,body},'PUT');setSaved(true);await onChanged();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function remove(){setBusy(true);setError('');try{await api(`/directory/${doctorId}/review`,undefined,'DELETE');setRating(0);setBody('');await onChanged();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <section className="doctor-section reviews">
  <h2>Отзывы</h2>
  {reviews.length?<div className="review-list">{reviews.map(r=><article className="review" key={r.id}><div className="review-head"><strong>{r.author}</strong><Stars value={r.rating} size={16}/><span className="muted small">{formatDate(new Date(r.createdAt).toISOString().slice(0,10))}</span></div>{r.body?<p className="care-prose">{r.body}</p>:null}</article>)}</div>:<p className="muted">{mine?.hidden?'Ваш отзыв скрыт модерацией. Остальные его не видят.':'Пока нет отзывов. Вы можете оставить первый.'}</p>}
  <form className="care-form review-form" onSubmit={e=>{e.preventDefault();if(rating)void save();}}>
   <h3>{mine?'Ваш отзыв':'Оставить отзыв'}</h3>{mine?.hidden?<p className="muted small">Отзыв скрыт администратором, поэтому его не видно в каталоге. Обновить его можно, но он останется скрытым, пока администратор не вернёт его.</p>:null}
   <div className="rating-input" role="group" aria-label="Оценка врачу">{[1,2,3,4,5].map(i=><button type="button" key={i} className={i<=rating?'rating-star selected':'rating-star'} aria-label={`${i} из 5`} aria-pressed={rating===i} onClick={()=>setRating(i)}>{i<=rating?<IconStarFilled size={28}/>:<IconStar size={28}/>}</button>)}</div>
   <Textarea label="Текст отзыва" description="Необязательно. Опишите, как прошла работа, без диагнозов и личных данных других людей" value={body} onChange={e=>setBody(e.currentTarget.value)} maxLength={1000} minRows={3}/>
   {error?<ErrorBox message={error}/>:null}
   {saved?<p className="muted small" role="status">Отзыв сохранён</p>:null}
   <div className="connect-actions"><Button type="submit" loading={busy} disabled={!rating}>{mine?'Обновить отзыв':'Опубликовать отзыв'}</Button>{mine?<Button variant="default" onClick={remove} disabled={busy}>Удалить отзыв</Button>:null}</div>
   <p className="muted small">Отзыв виден другим пациентам под вашим именем без фамилии.</p>
  </form>
 </section>;
}

type Req={id:string;message:string;createdAt:number;name:string};
export function ConnectionRequests({onChanged}:{onChanged:()=>Promise<void>}){
 const [items,setItems]=useState<Req[]>([]),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setItems((await api<{requests:Req[]}>('/doctor/requests')).requests);}catch(e){setError(errorText(e));}},[]);
 useEffect(()=>{void load();},[load]);
 async function decide(id:string,decision:'accept'|'decline'){setBusy(id);setError('');try{await api(`/doctor/requests/${id}/decision`,{decision});await load();await onChanged();}catch(e){setError(errorText(e));await load();}finally{setBusy(null);}}
 if(!items.length&&!error)return null;
 return <section className="connection-requests" aria-labelledby="requests-title">
  <h2 id="requests-title">Запросы на подключение: {items.length}</h2>
  {error?<ErrorBox message={error}/>:null}
  {items.map(r=><article className="request-row" key={r.id}>
   <div><strong>{r.name}</strong><span className="muted small"> · {formatDate(new Date(r.createdAt).toISOString().slice(0,10))}</span>{r.message?<p className="care-prose">{r.message}</p>:<p className="muted small">Без сообщения</p>}</div>
   <div className="request-actions"><Button loading={busy===r.id} disabled={busy!==null} onClick={()=>void decide(r.id,'accept')}>Принять</Button><Button variant="default" disabled={busy!==null} onClick={()=>void decide(r.id,'decline')}>Отклонить</Button></div>
  </article>)}
  <p className="muted small">После принятия вы увидите отметки и записи пациента, как после приглашения.</p>
 </section>;
}
