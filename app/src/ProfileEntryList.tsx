import {useState} from 'react';
import {Button,Group,TextInput,Textarea} from '@mantine/core';

/** Hybrid entry editor: single-line add, optional bulk paste, per-row edit/remove. */
export function ProfileEntryList({label,description,value,onChange,disabled,maxLength=200,placeholder,bulkPlaceholder}:{label:string;description?:string;value:string;onChange:(next:string)=>void;disabled?:boolean;maxLength?:number;placeholder?:string;bulkPlaceholder?:string}){
 const [draft,setDraft]=useState(''),[bulkOpen,setBulkOpen]=useState(false),[bulk,setBulk]=useState('');
 const lines=value.split('\n').map(s=>s.trim()).filter(Boolean);
 function commit(list:string[]){onChange(list.join('\n'));}
 function add(){const line=draft.trim();if(!line||disabled)return;const next=lines.includes(line)?lines:[...lines,line];commit(next);setDraft('');}
 function addBulk(){if(disabled)return;const parts=bulk.split('\n').map(s=>s.trim()).filter(Boolean);if(!parts.length)return;const merged=[...lines];for(const p of parts)if(!merged.includes(p))merged.push(p);commit(merged);setBulk('');setBulkOpen(false);}
 function remove(line:string){if(disabled)return;commit(lines.filter(l=>l!==line));}
 function edit(oldLine:string,next:string){if(disabled)return;const clean=next.trim();const rest=lines.filter(l=>l!==oldLine);commit(clean?[...rest,clean]:rest);}
 return <fieldset className="profile-entry-list">
  <legend>{label}</legend>
  {description?<p className="muted small">{description}</p>:null}
  {bulkOpen?<>
   <Textarea label="Вставить списком" description="Каждая запись — с новой строки" autosize minRows={4} maxRows={10} value={bulk} disabled={disabled} onChange={e=>setBulk(e.currentTarget.value)} placeholder={bulkPlaceholder??'Например:\n2014 · Медицинский университет\n2020 · Ординатура'} autoFocus/>
   <Group gap="var(--sp-3)" mt={8}>
    <Button size="sm" disabled={disabled||!bulk.trim()} onClick={addBulk}>Добавить записи</Button>
    <Button size="sm" variant="subtle" onClick={()=>{setBulkOpen(false);setBulk('');}}>Отмена</Button>
   </Group>
  </>:<>
   <ul className="profile-entry-rows">
    {lines.map((line,i)=><li key={`${line}-${i}`}>
     <TextInput value={line} disabled={disabled} maxLength={maxLength} onChange={e=>edit(line,e.currentTarget.value)} aria-label={`${label}, запись ${i+1}`}/>
     <Button variant="subtle" color="red" size="sm" disabled={disabled} onClick={()=>remove(line)}>Удалить</Button>
    </li>)}
   </ul>
   {!lines.length?<p className="muted small">Пока нет записей</p>:null}
   <Group gap="var(--sp-3)" align="flex-end" wrap="wrap">
    <TextInput className="profile-entry-add" placeholder={placeholder??'Новая запись'} value={draft} disabled={disabled} maxLength={maxLength} onChange={e=>setDraft(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} aria-label={`Добавить: ${label}`}/>
    <Button variant="outline" size="sm" disabled={disabled||!draft.trim()} onClick={add}>Добавить</Button>
    <Button variant="subtle" size="sm" disabled={disabled} onClick={()=>setBulkOpen(true)}>Вставить списком</Button>
   </Group>
  </>}
 </fieldset>;
}

/** Tag chips for short items (focus areas). */
export function ProfileChipList({label,description,value,onChange,disabled,maxLength=80,placeholder}:{label:string;description?:string;value:string;onChange:(next:string)=>void;disabled?:boolean;maxLength?:number;placeholder?:string}){
 const [draft,setDraft]=useState('');
 const items=value.split('\n').map(s=>s.trim()).filter(Boolean);
 function add(){const t=draft.trim();if(!t||disabled)return;const next=items.includes(t)?items:[...items,t];onChange(next.join('\n'));setDraft('');}
 function remove(t:string){if(disabled)return;onChange(items.filter(x=>x!==t).join('\n'));}
 return <fieldset className="profile-entry-list">
  <legend>{label}</legend>
  {description?<p className="muted small">{description}</p>:null}
  <div className="profile-chips" role="list">
   {items.map(item=><span key={item} role="listitem" className="profile-chip">
    {item}
    {!disabled?<button type="button" aria-label={`Убрать ${item}`} onClick={()=>remove(item)}>×</button>:null}
   </span>)}
  </div>
  {!items.length?<p className="muted small">Пока нет направлений</p>:null}
  <Group gap="var(--sp-3)" mt={8} align="flex-end">
   <TextInput className="profile-entry-add" placeholder={placeholder??'Например: Тревога'} value={draft} disabled={disabled} maxLength={maxLength} onChange={e=>setDraft(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} aria-label={`Добавить: ${label}`}/>
   <Button variant="outline" size="sm" disabled={disabled||!draft.trim()} onClick={add}>Добавить</Button>
  </Group>
 </fieldset>;
}
