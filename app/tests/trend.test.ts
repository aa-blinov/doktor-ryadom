import {expect,it} from 'vitest';
import {trendOf} from '../src/ui';

const day=(n:number)=>`2026-10-${String(n).padStart(2,'0')}`;

it('treats a nearly flat mood series as stable instead of a worsening trend',()=>{
 const rows=[3,4,3,4,3,4,3,4].map((value,i)=>({date:day(i+1),value}));
 expect(trendOf(rows)?.dir).toBe('stable');
});

it('reports a clear drop in mood as a downward trend',()=>{
 const rows=[4,4,3,3,2,2,1,1].map((value,i)=>({date:day(i+1),value}));
 expect(trendOf(rows)?.dir).toBe('down');
});
