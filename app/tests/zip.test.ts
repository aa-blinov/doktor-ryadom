import {expect,it} from 'vitest';
import {zipStore,bytesOf} from '../server/zip';
import {readZip} from './helpers/zip-read';

it('writes a ZIP whose entries read back byte for byte, with valid CRCs',()=>{
 const photo=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]);
 const zip=zipStore([{name:'data.json',data:Buffer.from('{"ок":true}','utf8')},{name:'media/фото.jpg',data:photo}]);
 const files=readZip(zip);
 expect([...files.keys()]).toEqual(['data.json','media/фото.jpg']);
 expect(files.get('media/фото.jpg')).toEqual(photo);
 expect(files.get('data.json')!.toString('utf8')).toBe('{"ок":true}');
});

it('decodes data URLs to bytes and keeps plain text as UTF-8',()=>{
 expect(bytesOf('data:image/jpeg;base64,AQID')).toEqual(Buffer.from([1,2,3]));
 expect(bytesOf('Текст').toString()).toBe('Текст');
});
