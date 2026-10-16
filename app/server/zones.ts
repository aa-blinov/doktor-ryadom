import {one} from './db';
import {DEFAULT_TIMEZONE,isTimezone} from '../src/timezone';

// The zone a person reads times in: their own setting, Asia/Almaty when none is set.
export async function viewerZone(db:D1Database,userId:string){
 const row=await one<{data:string}>(db,'SELECT data FROM settings WHERE user_id=?',userId);
 try{const tz=row?JSON.parse(row.data).timezone:undefined;if(typeof tz==='string'&&isTimezone(tz))return tz;}catch{/* malformed settings fall back to the default */}
 return DEFAULT_TIMEZONE;
}
