import {useCallback,useEffect,useMemo,useState} from 'react';
import {Avatar,Button,Checkbox,Loader,NativeSelect,TextInput,Textarea} from '@mantine/core';
import {IconArrowLeft,IconStar,IconStarFilled} from '@tabler/icons-react';
import {api,errorText} from './api';
import {navigate} from './App';
import {Empty,ErrorBox,PageHead,formatDate, PageLoader} from './ui';
import {specialtyLabels,type SpecialtyKind} from './shared';
import {BookAppointment,MyAppointments} from './Booking';
import {zoneDateTime,DEFAULT_TIMEZONE} from './timezone';

const kindFilters=[{label:'Все',value:'all'},{label:'Психологи',value:'psychologist'},{label:'Психотерапевты',value:'psychotherapist'},{label:'Психиатры',value:'psychiatrist'}] as const;

type Card={id:string;name:string;kind:SpecialtyKind|null;city:string;specialty:string;clinic:string;experienceYears:number|null;focusAreas:string;about:string;photoUrl:string|null;rating:number|null;reviewCount:number;price:number|null;visitFormat:'online'|'offline'|'both';timezone:string;nextSlotAt?:number|null};
type Review={id:string;rating:number;body:string;createdAt:number;author:string;hidden:boolean};
type Detail={doctor:Card&{address:string;education:string;courses:string;workHistory:string;videoUrl:string|null};reviews:Review[];mine:{rating:number;body:string;hidden:boolean}|null;connection:{linkedToThis:boolean;linkedToOther:boolean;pendingRequestId:string|null}};

const formatText={online:'Онлайн',offline:'Очно',both:'Онлайн и очно'} as const;
const priceText=(price:number|null)=>price===null?'Стоимость уточняйте у врача':`${price.toLocaleString('ru-RU')} ₸ за приём`;
const sortOptions=[{value:'',label:'Сначала с отзывами'},{value:'rating',label:'По рейтингу'},{value:'experience',label:'По стажу'},{value:'price',label:'По цене'},{value:'nearest',label:'Ближайшая запись'}];
const formatOptions=[{value:'all',label:'Любой формат'},{value:'online',label:'Онлайн'},{value:'offline',label:'Очно'}];
const priceOptions=[{value:'0',label:'Любая цена'},{value:'2000',label:'До 2 000 ₸'},{value:'5000',label:'До 5 000 ₸'},{value:'10000',label:'До 10 000 ₸'}];
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
 const [filtersOpen,setFiltersOpen]=useState(()=>typeof window==='undefined'||!window.matchMedia('(max-width:700px)').matches);
 const [items,setItems]=useState<Card[]>([]),[viewerTz,setViewerTz]=useState(DEFAULT_TIMEZONE),[total,setTotal]=useState(0),[page,setPage]=useState(1),[cities,setCities]=useState<string[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[city,setCity]=useState(''),[sort,setSort]=useState(''),[format,setFormat]=useState('all'),[maxPrice,setMaxPrice]=useState('0'),[free,setFree]=useState(false);
 const qs=(p:number)=>{const s=new URLSearchParams({page:String(p)});if(kind!=='all')s.set('kind',kind);if(query.trim())s.set('q',query.trim());if(city)s.set('city',city);if(sort)s.set('sort',sort);if(format!=='all')s.set('format',format);if(maxPrice!=='0')s.set('maxPrice',maxPrice);if(free)s.set('free','1');return s.toString();};
 const fetchPage=useCallback(async(p:number,append:boolean)=>{
  setError('');setLoading(true);
  try{const r=await api<{doctors:Card[];total:number;cities:string[];viewerTimezone:string}>(`/directory?${qs(p)}`);setViewerTz(r.viewerTimezone);setItems(prev=>append?[...prev,...r.doctors]:r.doctors);setTotal(r.total);setPage(p);setCities(r.cities);}
  catch(e){setError(errorText(e));}finally{setLoading(false);}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[kind,query,city,sort,format,maxPrice,free]);
 // Typing waits 300 ms before asking the server; other filters answer at once.
 useEffect(()=>{const timer=setTimeout(()=>void fetchPage(1,false),query?300:0);return()=>clearTimeout(timer);},[fetchPage,query]);
 const reset=()=>{setKind('all');setQuery('');setCity('');setSort('');setFormat('all');setMaxPrice('0');setFree(false);};
 return <section className="directory">
  <button className="back-link" onClick={()=>navigate('/doctor')}><IconArrowLeft size={18}/>Мой врач</button>
  <PageHead title="Найти врача" description="Психологи, психотерапевты и психиатры, чью квалификацию проверил администратор"/>
  <MyAppointments/>
  <div className="connect-actions"><Button variant="default" onClick={()=>navigate('/card')}>Моя карточка и история лечения</Button></div>
  <button type="button" className="filters-toggle" aria-expanded={filtersOpen} aria-controls="directory-filters" onClick={()=>setFiltersOpen(o=>!o)}>{filtersOpen?'Скрыть фильтры':'Фильтры и сортировка'}</button>
  <div id="directory-filters" className={filtersOpen?'directory-filters':'directory-filters is-collapsed'}>
   <div className="kind-filter" role="group" aria-label="Специальность">
    {kindFilters.map(option=><button key={option.value} type="button" className={kind===option.value?'kind-chip selected':'kind-chip'} aria-pressed={kind===option.value} onClick={()=>setKind(option.value)}>{option.label}</button>)}
   </div>
   <div className="directory-search directory-bar">
    <TextInput aria-label="Поиск врача" placeholder="Имя, направление или клиника" value={query} onChange={e=>setQuery(e.currentTarget.value)}/>
    {cities.length>1?<NativeSelect aria-label="Город" value={city} onChange={e=>setCity(e.currentTarget.value)} data={[{value:'',label:'Все города'},...cities.map(c=>({value:c,label:c}))]}/>:null}
    <NativeSelect aria-label="Сортировка" value={sort} onChange={e=>setSort(e.currentTarget.value)} data={sortOptions}/>
    <NativeSelect aria-label="Формат приёма" value={format} onChange={e=>setFormat(e.currentTarget.value)} data={formatOptions}/>
    <NativeSelect aria-label="Стоимость" value={maxPrice} onChange={e=>setMaxPrice(e.currentTarget.value)} data={priceOptions}/>
    <Checkbox label="Только с свободным временем" checked={free} onChange={e=>setFree(e.currentTarget.checked)}/>
   </div>
  </div>
  <p className="muted small directory-note">Препараты назначает только психиатр. Психологи и психотерапевты работают разговором и практиками.</p>
  <p className="muted small" aria-live="polite">{loading&&!items.length?'':`Найдено врачей: ${total}`}</p>
  {loading&&!items.length?<PageLoader/>:null}
  {error?<ErrorBox message={error} retry={()=>void fetchPage(1,false)}/>:null}
  {!loading&&!error&&!items.length?<Empty title="Врачей не найдено" description="Измените фильтры или поиск" icon={<IconStar/>} action="Сбросить" onAction={reset}/>:null}
  <div className="doctor-list">{items.map(d=><a key={d.id} className="doctor-card" href={`#/doctors/${d.id}`}>
   <Avatar src={d.photoUrl} size={64} radius="xl" alt="">{d.name.slice(0,1)}</Avatar>
   <div className="doctor-card-main">
    <h2>{d.name}</h2>
    <p className="doctor-card-meta"><span className={`pill kind-${d.kind??'none'}`}>{d.kind?specialtyLabels[d.kind]:'Специалист'}</span>{specialtyLine(d.kind,d.specialty)?<span>{specialtyLine(d.kind,d.specialty)}</span>:null}</p>
    <p className="muted small">{[d.city,d.clinic,d.experienceYears!==null?`стаж ${d.experienceYears} ${years(d.experienceYears)}`:''].filter(Boolean).join(' · ')}</p>
    <p className="small doctor-card-price">{priceText(d.price)} · {formatText[d.visitFormat]}</p>
    {d.about?<p className="doctor-card-about">{d.about}{d.about.length>=180?'…':''}</p>:null}
    <Rating card={d}/>
    <p className="small">{d.nextSlotAt?<strong>Ближайшая запись: {zoneDateTime(d.nextSlotAt,viewerTz)}</strong>:<span className="muted">Свободного времени пока нет</span>}</p>
   </div>
  </a>)}</div>
  {items.length<total?<div className="connect-actions"><Button variant="default" loading={loading} onClick={()=>void fetchPage(page+1,true)}>Показать ещё</Button></div>:null}
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
  <p className="small doctor-card-price">{priceText(d.price)} · {formatText[d.visitFormat]}</p>
  <BookAppointment doctorId={id} doctorName={d.name}/>
  <ConnectPanel name={d.name} connection={data.connection}/>
  {d.videoUrl?<section className="doctor-section"><h2>Видео-представление</h2><video className="profile-video-player" src={d.videoUrl} controls playsInline preload="metadata" aria-label={`Видео о ${d.name}`}/></section>:null}
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
