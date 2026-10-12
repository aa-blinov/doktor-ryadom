import {useState} from 'react';
import {Button,Group,TextInput} from '@mantine/core';

/** Editable list of lines (stored as \n-separated text). */
export function ProfileEntryList({label,description,value,onChange,disabled,maxLength=200,placeholder}:{label:string;description?:string;value:string;onChange:(next:string)=>void;disabled?:boolean;maxLength?:number;placeholder?:string}){
 const [draft,setDraft]=useState('');
 const lines=value.split('\n').map(s=>s.trim()).filter(Boolean);
 function add(){const line=draft.trim();if(!line||disabled)return;if(lines.includes(line)){setDraft('');return;}onChange([...lines,line].join('\n'));setDraft('');}
 function remove(line:string){if(disabled)return;onChange(lines.filter(l=>l!==line).join('\n'));}
 function edit(oldLine:string,next:string){if(disabled)return;const clean=next.trim();const rest=lines.filter(l=>l!==oldLine);onChange(clean?[...rest,clean].join('\n'):rest.join('\n'));}
 return <fieldset className="profile-entry-list">
  <legend>{label}</legend>
  {description?<p className="muted small">{description}</p>:null}
  <ul className="profile-entry-rows">
   {lines.map((line,i)=><li key={`${line}-${i}`}>
    <TextInput value={line} disabled={disabled} maxLength={maxLength} onChange={e=>edit(line,e.currentTarget.value)} aria-label={`${label}, запись ${i+1}`}/>
    <Button variant="subtle" color="red" size="xs" disabled={disabled} onClick={()=>remove(line)}>Удалить</Button>
   </li>)}
  </ul>
  {!lines.length?<p className="muted small">Пока нет записей</p>:null}
  <Group gap="xs" align="flex-end" wrap="wrap">
   <TextInput className="profile-entry-add" placeholder={placeholder??'Новая запись'} value={draft} disabled={disabled} maxLength={maxLength} onChange={e=>setDraft(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} aria-label={`Добавить: ${label}`}/>
   <Button variant="outline" size="sm" disabled={disabled||!draft.trim()} onClick={add}>Добавить</Button>
  </Group>
 </fieldset>;
}
