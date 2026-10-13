import {useRef,useState} from 'react';
import {Button,FileButton,Group,Modal,Select,Switch} from '@mantine/core';
import {api,errorText} from './api';
import {ErrorBox} from './ui';
import {fileToUpload} from './media';
import type {DoctorProfile,ProfileDocument} from './shared';

const categories=[{value:'education',label:'Образование'},{value:'courses',label:'Курсы'},{value:'workHistory',label:'Опыт работы'}];

export function ProfileDocuments({profile,disabled}:{profile:DoctorProfile;disabled:boolean}){
 const [category,setCategory]=useState<'education'|'courses'|'workHistory'>('education'),[entry,setEntry]=useState(''),[documents,setDocuments]=useState<ProfileDocument[]>(profile.documents??[]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState<ProfileDocument|null>(null);
 const reset=useRef<()=>void>(null),replaceReset=useRef<()=>void>(null),replaceId=useRef<string|null>(null);
 const entries=[...new Set((profile[category]??'').split('\n').map(x=>x.trim()).filter(Boolean))];
 async function reload(){const result=await api<{profile:DoctorProfile}>('/profile');setDocuments(result.profile.documents);}
 async function upload(file:File|null,replaceDoc?:ProfileDocument){if(!file)return;setBusy(true);setError('');setMessage('');try{
  if(file.size>8*1024*1024)throw new Error('Выберите файл размером до 8 МБ');
  const payload=await fileToUpload(file);
  if(replaceDoc){
   await api('/profile/documents/'+replaceDoc.id,undefined,'DELETE');
   await api('/profile/documents',{category:replaceDoc.category,entry:replaceDoc.entry,filename:payload.filename,data:payload.data});
   setMessage('Документ заменён');
  }else{
   await api('/profile/documents',{category,entry,filename:payload.filename,data:payload.data});
   setMessage(file.type.startsWith('image/')||/\.webp$/i.test(file.name)?'Документ прикреплён (изображение сжато в WebP). Пока он виден только вам':'Документ прикреплён. Пока он виден только вам');
  }
  await reload();
 }catch(e){setError(errorText(e));}finally{setBusy(false);reset.current?.();replaceReset.current?.();replaceId.current=null;}}
 async function change(doc:ProfileDocument,shared?:boolean){if(shared!==undefined)setDocuments(list=>list.map(item=>item.id===doc.id?{...item,shared}:item));setBusy(true);setError('');setMessage('');try{await api('/profile/documents/'+doc.id,shared===undefined?{}:{shared},shared===undefined?'DELETE':'PUT');await reload();setMessage(shared===undefined?'Документ удалён':shared?'Документ доступен подключённым пациентам':'Документ виден только вам');if(shared===undefined&&preview?.id===doc.id)setPreview(null);}catch(e){if(shared!==undefined)setDocuments(list=>list.map(item=>item.id===doc.id?doc:item));setError(errorText(e));}finally{setBusy(false);}}
 const isImage=(doc:ProfileDocument)=>doc.mime.startsWith('image/');
 return <section className="profile-documents"><h3>Дипломы и сертификаты</h3><p className="muted">Сначала сохраните запись, затем прикрепите к ней документ. Изображения сжимаются в WebP. PDF, JPG, PNG или WebP, до 8 МБ</p><div className="profile-fields"><Select label="Раздел документа" value={category} onChange={v=>{setCategory(v as typeof category);setEntry('');}} data={categories} disabled={busy||disabled}/><Select label="К какой записи прикрепить" placeholder={entries.length?'Выберите запись':'Добавьте запись в профиль'} value={entry||null} onChange={v=>setEntry(v??'')} data={entries} disabled={busy||disabled||!entries.length}/></div><FileButton resetRef={reset} onChange={file=>void upload(file)} accept="application/pdf,image/jpeg,image/png,image/webp">{props=><Button {...props} variant="outline" disabled={!entry||busy||disabled}>Прикрепить документ</Button>}</FileButton>
 {documents.map(doc=><div className="profile-document" key={doc.id}>
  <strong>{doc.entry}</strong>
  <div className="profile-document-links">
   <a href={'/api/profile/documents/'+doc.id} download>{doc.filename}</a>
   {isImage(doc)?<Button size="xs" variant="light" onClick={()=>setPreview(doc)}>Посмотреть</Button>:<Button size="xs" variant="light" component="a" href={'/api/profile/documents/'+doc.id} target="_blank" rel="noreferrer">Открыть</Button>}
  </div>
  <Group justify="space-between" wrap="wrap">
   <Switch label="Показывать подключённым пациентам" checked={doc.shared} onChange={e=>void change(doc,e.currentTarget.checked)} disabled={busy||disabled}/>
   <Group gap="var(--sp-3)">
    <FileButton resetRef={replaceReset} onChange={file=>void upload(file,doc)} accept="application/pdf,image/jpeg,image/png,image/webp">{props=><Button {...props} variant="outline" size="sm" disabled={busy||disabled}>Заменить</Button>}</FileButton>
    <Button variant="subtle" color="red" size="sm" onClick={()=>void change(doc)} disabled={busy||disabled}>Удалить</Button>
   </Group>
  </Group>
  {profile[('show'+doc.category[0].toUpperCase()+doc.category.slice(1)) as 'showEducation']===false?<p className="muted small">Раздел скрыт от пациентов. Прикреплённые документы тоже не показываются</p>:null}
  {!(profile[doc.category]??'').split('\n').map(x=>x.trim()).includes(doc.entry)?<p className="muted small">Эта запись изменена или удалена из профиля. Пациентам документ не показывается</p>:null}
 </div>)}
 {!documents.length?<p className="muted small">Документов пока нет. Загруженные файлы сначала видны только вам</p>:null}
 {error?<ErrorBox message={error}/>:null}
 {message?<p role="status">{message}</p>:null}
 <Modal opened={!!preview} onClose={()=>setPreview(null)} title={preview?.entry??'Документ'} size="lg" centered>
  {preview?<div className="document-preview">
   {isImage(preview)?<img src={'/api/profile/documents/'+preview.id} alt={preview.filename}/>:<iframe title={preview.filename} src={'/api/profile/documents/'+preview.id}/>}
   <Group mt="var(--sp-4)"><Button component="a" href={'/api/profile/documents/'+preview.id} download variant="outline">Скачать</Button></Group>
  </div>:null}
 </Modal>
 </section>;
}
