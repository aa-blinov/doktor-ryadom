// Wall-clock helpers for clinic time zones. Slots are stored as UTC instants; people see and enter clinic-local time.
export const clinicTimezones=[
 {value:'Asia/Almaty',label:'Алматы (UTC+5)'},
 {value:'Asia/Qyzylorda',label:'Кызылорда (UTC+5)'},
 {value:'Asia/Aqtobe',label:'Актобе (UTC+5)'},
 {value:'Asia/Atyrau',label:'Атырау (UTC+5)'},
 {value:'Asia/Oral',label:'Уральск (UTC+5)'},
 {value:'Asia/Aqtau',label:'Актау (UTC+5)'},
 {value:'Asia/Bishkek',label:'Бишкек (UTC+6)'},
 {value:'Asia/Tashkent',label:'Ташкент (UTC+5)'},
 {value:'Europe/Moscow',label:'Москва (UTC+3)'},
] as const;
export const DEFAULT_TIMEZONE='Asia/Almaty';

export function isTimezone(tz:string){
 try{new Intl.DateTimeFormat('en-US',{timeZone:tz});return true;}catch{return false;}
}
// Offset of a zone from UTC at an instant, in minutes east of UTC.
export function offsetMinutes(ms:number,tz:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ms));
 const get=(t:string)=>Number(parts.find(p=>p.type===t)!.value);
 const asUtc=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
 return Math.round((asUtc-ms)/60000);
}
// The instant at which a clinic wall clock shows date (YYYY-MM-DD) and time (HH:MM).
export function zonedToUtc(date:string,hhmm:string,tz:string){
 const wall=Date.parse(`${date}T${hhmm}:00Z`);
 const first=wall-offsetMinutes(wall,tz)*60000;
 return wall-offsetMinutes(first,tz)*60000; // second pass settles the instant around DST changes
}
export function zoneDayKey(ms:number,tz:string){
 return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
}
export function zoneDayTitle(ms:number,tz:string){
 return new Intl.DateTimeFormat('ru-RU',{timeZone:tz,weekday:'short',day:'numeric',month:'long'}).format(new Date(ms));
}
export function zoneTime(ms:number,tz:string){
 return new Intl.DateTimeFormat('ru-RU',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
}
// "пн, 19 октября, 09:30": the clinic's clock, the only clock a booking shows.
export function zoneDateTime(ms:number,tz:string){
 return `${zoneDayTitle(ms,tz)}, ${zoneTime(ms,tz)}`;
}
