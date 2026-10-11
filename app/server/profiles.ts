import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from './env';
import {doctorProfileSchema,patientProfileSchema,type User,type DoctorProfile,type PatientProfile} from '../src/shared';
import {database,one,logAction} from './db';
type App=Hono<{Bindings:Env;Variables:{user:User}}>;
type Stored={birthDate?:string|null;specialty?:string;clinic?:string;address?:string;experienceYears?:number|null;about?:string;education?:string;courses?:string;workHistory?:string;focusAreas?:string;showEducation?:boolean;showCourses?:boolean;showWorkHistory?:boolean;photo?:string|null};
export async function storedProfile(db:D1Database,id:string){const row=await one<{data:string;updated_at:number}>(db,'SELECT data,updated_at FROM profiles WHERE user_id=?',id);return {data:row?JSON.parse(row.data) as Stored:{},updated:row?.updated_at??0};}
export async function doctorProfile(db:D1Database,id:string,owner=false):Promise<DoctorProfile>{const {data,updated}=await storedProfile(db,id);const documents=await db.prepare('SELECT id,category,entry,filename,mime,shared,created_at FROM profile_documents WHERE user_id=? ORDER BY created_at DESC').bind(id).all<{id:string;category:'education'|'courses'|'workHistory';entry:string;filename:string;mime:string;shared:number;created_at:number}>();return {specialty:data.specialty??'',clinic:data.clinic??'',address:data.address??'',experienceYears:data.experienceYears??null,about:data.about??'',education:owner||data.showEducation!==false?data.education??'':'',courses:owner||data.showCourses!==false?data.courses??'':'',workHistory:owner||data.showWorkHistory!==false?data.workHistory??'':'',focusAreas:data.focusAreas??'',showEducation:data.showEducation!==false,showCourses:data.showCourses!==false,showWorkHistory:data.showWorkHistory!==false,documents:documents.results.filter(doc=>owner||(doc.shared&&data[('show'+doc.category[0].toUpperCase()+doc.category.slice(1)) as 'showEducation']!==false&&(data[doc.category]??'').split('\n').map(x=>x.trim()).includes(doc.entry))).map(({created_at,shared,...doc})=>({...doc,shared:!!shared,createdAt:created_at})),photoUrl:data.photo?`/api/profiles/${id}/photo?v=${updated}`:null};}
export async function patientProfile(db:D1Database,id:string):Promise<PatientProfile>{const {data}=await storedProfile(db,id);return {birthDate:data.birthDate??null,about:data.about??''};}
function validJpeg(photo:string){
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))return false;
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(photo.slice(23)),c=>c.charCodeAt(0));}catch{return false;}
 if(bytes.length>135000||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return false;
 let offset=2;while(offset+3<bytes.length){if(bytes[offset++]!==255)return false;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)return false;if(marker===1||(marker>=208&&marker<=216))continue;const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)return false;if([192,193,194].includes(marker)){if(length<8)return false;const h=(bytes[offset+3]<<8)|bytes[offset+4],w=(bytes[offset+5]<<8)|bytes[offset+6];return h>0&&w>0&&h<=512&&w<=512;}offset+=length;}return false;
}
export function profileRoutes(app:App){
 app.get('/api/profile',async c=>{const user=c.get('user'),db=database(c.env);return c.json({user,profile:user.role==='doctor'?await doctorProfile(db,user.id,true):await patientProfile(db,user.id)});});
 app.put('/api/profile',async c=>{
  const user=c.get('user'),db=database(c.env),input=await c.req.json(),parsed=(user.role==='doctor'?doctorProfileSchema:patientProfileSchema).safeParse(input);if(!parsed.success)return c.json({error:parsed.error.issues[0].message},400);
  const {name,...fields}=parsed.data,{data:old}=await storedProfile(db,user.id),recheck=user.role==='doctor'&&(name!==user.name||('specialty' in fields&&fields.specialty!==(old.specialty??''))),updated=Date.now();
  if(user.role==='doctor'&&'education' in fields){for(const key of ['address','education','courses','workHistory','focusAreas','showEducation','showCourses','showWorkHistory'] as const)if(!Object.prototype.hasOwnProperty.call(input,key))(fields as Record<string,unknown>)[key]=old[key]??(key.startsWith('show')?true:'');}
  await db.batch([db.prepare('INSERT INTO profiles VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=json_set(excluded.data,\'$.photo\',json_extract(profiles.data,\'$.photo\')),updated_at=excluded.updated_at').bind(user.id,JSON.stringify({...fields,...(user.role==='doctor'?{photo:old.photo??null}:{})}),updated),db.prepare('UPDATE users SET name=?,specialist_verified_at=CASE WHEN ? THEN NULL ELSE specialist_verified_at END WHERE id=?').bind(name,recheck?1:0,user.id)]);
  await logAction(db,user.id,'update_profile',user.id);const current={...user,name,specialist_verified_at:recheck?null:user.specialist_verified_at};const profile=user.role==='doctor'?await doctorProfile(db,user.id,true):await patientProfile(db,user.id);return c.json({user:{...current,...('photoUrl' in profile?{photoUrl:profile.photoUrl}:{})},profile});
 });
 app.put('/api/profile/photo',async c=>{
  const user=c.get('user');if(user.role!=='doctor')return c.json({error:'Фото профиля доступно для врача'},403);
  const parsed=z.object({photo:z.string().max(180000).refine(validJpeg,'Не удалось прочитать фото. Выберите другое изображение').nullable()}).strict().safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Выберите JPG, PNG или WebP размером до 5 МБ'},400);
  const db=database(c.env),{data}=await storedProfile(db,user.id);await db.prepare('INSERT INTO profiles VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=json_set(profiles.data,\'$.photo\',json_extract(excluded.data,\'$.photo\')),updated_at=excluded.updated_at').bind(user.id,JSON.stringify({...data,photo:parsed.data.photo}),Date.now()).run();await logAction(db,user.id,'update_profile_photo',user.id);const profile=await doctorProfile(db,user.id,true);return c.json({profile,user:{...user,photoUrl:profile.photoUrl}});
 });
 app.get('/api/profiles/:id/photo',async c=>{
  const id=c.req.param('id'),user=c.get('user'),db=database(c.env);if(id!==user.id&&!await one(db,'SELECT patient_id FROM links WHERE revoked_at IS NULL AND ((patient_id=? AND doctor_id=?) OR (doctor_id=? AND patient_id=?))',user.id,id,user.id,id)&&!(user.role!=='doctor'&&await one(db,"SELECT id FROM users WHERE id=? AND role='doctor' AND specialist_verified_at IS NOT NULL AND blocked_at IS NULL",id)))return c.json({error:'Фото недоступно'},403);
  const {data}=await storedProfile(db,id);if(!data.photo)return c.notFound();const bytes=Uint8Array.from(atob(data.photo.slice(23)),ch=>ch.charCodeAt(0));return c.body(bytes,200,{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 });
}
