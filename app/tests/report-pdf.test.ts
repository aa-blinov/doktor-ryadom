import {expect,it} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createReportPdf} from '../src/reportPdf';
const font=new Uint8Array(readFileSync('public/fonts/report-manrope.ttf'));
const metrics=JSON.parse(readFileSync('public/fonts/report-manrope.json','utf8'));
it('PDF has readable Cyrillic and Kazakh, paginates long notes and preserves Unicode text',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ryadom-pdf-'));
 try{
  const text='Блинов Александр, настроение и сон. Ә Ғ Қ Ң Ө Ұ Ү Һ І. (скобки) \\ заметка 😊';
  const pdf=createReportPdf({name:'Блинов Александр',start:'2026-09-24',end:'2026-10-07',blocks:[{text:'Что хочется обсудить',kind:'heading'},...Array.from({length:40},(_,i)=>({text:`Запись ${i}: ${text} `+('Длинная заметка о состоянии. '.repeat(8))})),{text:'Последняя запись без потерь'}]},font,metrics);
  const file=join(dir,'report.pdf');writeFileSync(file,pdf);
  expect(Buffer.from(pdf.subarray(0,8)).toString()).toBe('%PDF-1.7');
  const info=execFileSync('pdfinfo',[file],{encoding:'utf8'});expect(info).toMatch(/Pages:\s+[2-9]\d*/);expect(info).toMatch(/595 x 842 pts/);
  const extracted=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
  expect(extracted).toContain('Блинов Александр');expect(extracted).toContain('Ә Ғ Қ Ң Ө Ұ Ү Һ І');expect(extracted).toContain('😊');expect(extracted).toContain('Последняя запись без потерь');expect(extracted).toContain('Запись 39');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('PDF wraps long unbroken strings without exceeding the printable width',()=>{
 const pdf=createReportPdf({name:'Пациент',start:'2026-10-01',end:'2026-10-07',blocks:[{text:'я'.repeat(1800)}]},font,metrics);
 const source=Buffer.from(pdf).toString('latin1');expect(source.match(/ Tj ET/g)!.length).toBeGreaterThan(20);
 const widths=new Map([...source.matchAll(/(\d+) \[(\d+)\]/g)].map(m=>[Number(m[1]),Number(m[2])]));
 for(const line of source.matchAll(/\/F1 ([\d.]+) Tf[^\n]*?<([0-9A-F]+)> Tj/g)){const ids=line[2].match(/.{4}/g)!;const width=ids.reduce((sum:number,id:string)=>sum+(widths.get(parseInt(id,16))??600),0)*Number(line[1])/1000;expect(width).toBeLessThanOrEqual(499.01);}
});
