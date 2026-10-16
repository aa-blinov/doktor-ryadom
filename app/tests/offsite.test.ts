import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error plain ESM script, no types
import {encryptBackup,decryptBackup,signRequest,syncOnce} from '../scripts/offsite.mjs';

const key=Buffer.alloc(32,9);

it('encrypts a backup so the bucket never sees plaintext, and decrypts only with the right key',()=>{
 const plain=Buffer.from('SQLite format 3\0 personal notes');
 const blob=encryptBackup(plain,key);
 expect(blob.includes(plain)).toBe(false);
 expect(decryptBackup(blob,key).equals(plain)).toBe(true);
 expect(()=>decryptBackup(blob,Buffer.alloc(32,1))).toThrow();
 const tampered=Buffer.from(blob);tampered[tampered.length-1]^=1;
 expect(()=>decryptBackup(tampered,key)).toThrow();
});

it('signs S3 requests with SigV4 scope for the configured region and keeps the payload hash',()=>{
 const headers=signRequest({method:'PUT',url:'https://s3.eu-central-003.backblazeb2.com/petzy-1/ryadom/a.enc',region:'eu-central-003',accessKey:'KEY',secretKey:'SECRET',body:Buffer.from('x'),now:new Date('2026-10-16T09:00:00Z')});
 expect(headers['x-amz-date']).toBe('20261016T090000Z');
 expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=KEY\/20261016\/eu-central-003\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
});

it('keeps the newest copy of each of the last fourteen days and uploads only what is missing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'offsite-'));
 for(const d of ['2026-10-14T01-00-00.000Z','2026-10-15T01-00-00.000Z','2026-10-16T02-59-36.963Z'])writeFileSync(join(dir,`ryadom-${d}.sqlite`),`db ${d}`);
 // Fifteen days of old copies, two of them on the same day: the older one of that pair must go.
const remote=[...Array.from({length:15},(_,i)=>`ryadom/ryadom-2026-09-${String(i+1).padStart(2,'0')}T10-00-00.000Z.sqlite.enc`),'ryadom/ryadom-2026-09-15T08-00-00.000Z.sqlite.enc'].sort();
 const calls:string[]=[];
 const request=async(method:string,key:string='',opts:{query?:Record<string,string>}={})=>{
  calls.push(`${method} ${key}`);
  if(method==='GET')return {text:async()=>`<ListBucketResult>${remote.map(k=>`<Key>${k}</Key>`).join('')}</ListBucketResult>`};
  return {};
 };
 await syncOnce({request,directory:dir,key,retain:14,log:()=>{}});
 expect(calls.filter(c=>c.startsWith('PUT'))).toHaveLength(3);
 // Day 1 falls outside the fourteen kept days; on day 15 the earlier copy (08:00) goes, the 10:00 copy stays.
expect(calls.filter(c=>c.startsWith('DELETE'))).toEqual([`DELETE ${remote[0]}`,'DELETE ryadom/ryadom-2026-09-15T08-00-00.000Z.sqlite.enc']);
});
