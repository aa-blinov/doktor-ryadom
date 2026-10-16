// The only binary uploads: each route, its allowed MIME types and its byte limit. Everything else must be JSON.
const MB=1024*1024;
const PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
const VIDEO_TYPES=['video/mp4','video/webm'];
export function binaryUploadLimit(method:string,path:string,contentType:string):number|null{
 if(method!=='PUT')return null;
 const type=contentType.split(';')[0].trim();
 if(path==='/api/profile/video'&&VIDEO_TYPES.includes(type))return 50*MB;
 if(/^\/api\/doctor\/practices\/[^/]+\/media\/photo$/.test(path)&&PHOTO_TYPES.includes(type))return 5*MB;
 if(/^\/api\/doctor\/practices\/[^/]+\/media\/video$/.test(path)&&VIDEO_TYPES.includes(type))return 50*MB;
 return null;
}
