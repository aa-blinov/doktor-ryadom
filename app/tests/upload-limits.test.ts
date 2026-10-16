import {expect,it} from 'vitest';
import {requestBodyLimit} from '../server/upload-limits';
const MB=1024*1024;

// The Node adapter used to cap every PUT at 64 KB because of an operator-precedence slip, so a real clip was refused in production.
it('gives binary routes their own limit and JSON routes the small caps',()=>{
 expect(requestBodyLimit('PUT','/api/profile/video','video/mp4')).toBe(50*MB);
 expect(requestBodyLimit('PUT','/api/doctor/practices/abc/media/photo','image/png')).toBe(5*MB);
 expect(requestBodyLimit('PUT','/api/doctor/practices/abc/media/video','video/webm')).toBe(50*MB);
 expect(requestBodyLimit('POST','/api/patient/assessments/abc','application/json')).toBe(65536);
 expect(requestBodyLimit('POST','/api/profile/documents','application/octet-stream')).toBe(7*MB);
 expect(requestBodyLimit('PUT','/api/profile/photo','image/jpeg')).toBe(200000);
 expect(requestBodyLimit('PUT','/api/profile/video','text/plain')).toBe(16000);
 expect(requestBodyLimit('PATCH','/api/anything','application/json')).toBe(16000);
});
