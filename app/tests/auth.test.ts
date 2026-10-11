import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, digest, randomToken } from '../server/auth';
import { entrySchema, signals, type Entry } from '../src/shared';
describe('account security',()=>{
 it('uses unique salts and rejects a wrong password',async()=>{const password='a sufficiently long test password';const [a,b]=await Promise.all([hashPassword(password),hashPassword(password)]);expect(a).not.toBe(b);expect(await verifyPassword(password,a)).toBe(true);expect(await verifyPassword('wrong password',a)).toBe(false);},15000);
 it('stores invitation and session fingerprints instead of the bearer token',async()=>{const token=randomToken();expect(token).toHaveLength(64);expect(await digest(token)).not.toBe(token);expect(await digest(token)).toBe(await digest(token));});
});
describe('patient records',()=>{
 const record={date:'2026-10-07',mood:3,sleep:null,anxiety:0,energy:null,functioning:null,sleepContext:null,note:'',habit:null};
 it('retains a zero-valued anxiety answer and skipped measurements',()=>{const parsed=entrySchema.parse(record);expect(parsed.anxiety).toBe(0);expect(parsed.sleep).toBeNull();});
 it('rejects impossible dates and invalid measurement values',()=>{expect(entrySchema.safeParse({...record,date:'2026-02-30'}).success).toBe(false);expect(entrySchema.safeParse({...record,mood:0}).success).toBe(false);expect(entrySchema.safeParse({...record,sleep:25}).success).toBe(false);});
 it('does not turn missing sleep data into short sleep or a risk classification',()=>{const entries=[{...record,id:'1',created_at:0},{...record,id:'2',created_at:0,sleep:5}] as Entry[];expect(signals(entries)).toEqual([]);expect(signals([...entries,{...record,id:'3',created_at:0,sleep:4}])).toEqual(['2 из последних 3 отметок: сон менее 6 часов']);});
});
