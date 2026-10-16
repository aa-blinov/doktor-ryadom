import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {zipStore,bytesOf} from '../server/zip';

it('writes a ZIP that standard tools read back byte for byte',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zip-'));
 const photo=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]);
 const zip=zipStore([{name:'data.json',data:Buffer.from('{"ок":true}','utf8')},{name:'media/фото.jpg',data:photo}]);
 const file=join(dir,'x.zip');writeFileSync(file,zip);
 expect(execFileSync('unzip',['-tq',file]).toString()).toContain('No errors');
 expect(execFileSync('unzip',['-p',file,'media/фото.jpg'])).toEqual(photo);
 expect(execFileSync('unzip',['-p',file,'data.json']).toString()).toBe('{"ок":true}');
});

it('decodes data URLs to bytes and keeps plain text as UTF-8',()=>{
 expect(bytesOf('data:image/jpeg;base64,AQID')).toEqual(Buffer.from([1,2,3]));
 expect(bytesOf('Текст').toString()).toBe('Текст');
 void readFileSync;
});
