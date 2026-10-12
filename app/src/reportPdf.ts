/** Local, selectable-text PDF export. Font assets are bundled; no patient data leaves the browser. */
export type PdfBlock = {text:string;kind?:'heading'|'note'|'body'};
export type PdfReport = {name:string;start:string;end:string;blocks:PdfBlock[];headerTitle?:string;headerSubtitle?:string;fileName?:string;photo?:{data:Uint8Array;width:number;height:number};contactLines?:string[]};
type FontMetrics={characters:Record<string,[number,number]>;bbox:number[];ascent:number;descent:number};
const encoder=new TextEncoder();
const bytes=(s:string)=>encoder.encode(s);
function join(parts:Uint8Array[]){const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;}
function hex(n:number){return n.toString(16).padStart(4,'0').toUpperCase();}
function unicode(cp:number){if(cp<=65535)return hex(cp);cp-=65536;return hex(0xD800+(cp>>10))+hex(0xDC00+(cp&1023));}
function date(value:string){return value.split('-').reverse().join('.');}
export async function loadReportFont(){
 const base=import.meta.env.BASE_URL;
 const results=await Promise.all([fetch(`${base}fonts/report-manrope.ttf`,{signal:AbortSignal.timeout(20000)}),fetch(`${base}fonts/report-manrope.json`,{signal:AbortSignal.timeout(20000)})]);
 if(results.some(r=>!r.ok))throw new Error('Не удалось загрузить шрифт для PDF. Проверьте соединение и попробуйте ещё раз');
 return {font:new Uint8Array(await results[0].arrayBuffer()),metrics:await results[1].json() as FontMetrics};
}
export function createReportPdf(report:PdfReport,font:Uint8Array,metrics:FontMetrics){
 const objects:Uint8Array[]=[];
 const reserve=()=>{objects.push(new Uint8Array());return objects.length;};
 const put=(id:number,value:string|Uint8Array)=>{objects[id-1]=typeof value==='string'?bytes(value):value;};
 const stream=(data:Uint8Array,extra='')=>join([bytes(`<< /Length ${data.length} ${extra} >>\nstream\n`),data,bytes('\nendstream')]);
 const catalog=reserve(),pages=reserve(),type0=reserve(),cidFont=reserve(),descriptor=reserve(),fontFile=reserve(),cidMap=reserve(),toUnicode=reserve();
 const characters=new Map<number,number>();
 const encode=(text:string)=>[...text].map(char=>{const cp=char.codePointAt(0)!;if(!characters.has(cp))characters.set(cp,characters.size+1);return hex(characters.get(cp)!);}).join('');
 const width=(text:string,size:number)=>[...text].reduce((n,c)=>n+(metrics.characters[c.codePointAt(0)!]?.[1]??metrics.characters[63]?.[1]??600),0)*size/1000;
 const wrap=(text:string,size:number,max=499)=>{
  const output:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').split('\n')){
   let line='';
   for(const word of paragraph.split(/\s+/).filter(Boolean)){
    if(line&&width(line+' '+word,size)>max){output.push(line);line='';}
    if(width(word,size)<=max){line+=(line?' ':'')+word;continue;}
    for(const char of word){if(line&&width(line+char,size)>max){output.push(line);line='';}line+=char;}
   }
   output.push(line);
  }
  return output;
 };
 const pageStreams:string[][]=[];let commands:string[]=[],y=0;
 const draw=(text:string,x:number,baseline:number,size:number,color='0.12 0.19 0.16')=>commands.push(`${color} rg BT /F1 ${size} Tf 1 0 0 1 ${x} ${baseline} Tm <${encode(text)}> Tj ET`);
 const newPage=()=>{
  commands=[];pageStreams.push(commands);y=750;
  commands.push('0.94 0.97 0.95 rg 0 786 595 56 re f');
  draw('Рядом',48,805,18,'0.13 0.35 0.26');draw(report.headerSubtitle??'Сводка к приёму',360,809,11);
 };
 newPage();
 const paragraph=(text:string,size=11,kind:PdfBlock['kind']='body')=>{
  const leading=size*1.55;const lines=wrap(text,size);
  // Keep short dated entries together; long notes can flow across pages.
  if(kind!=='heading'&&y-leading*Math.min(lines.length,4)<60)newPage();
  if(kind==='heading'){
   if(y-leading*3<60)newPage();
   y-=12;commands.push(`0.76 0.84 0.79 RG 48 ${y+20} m 547 ${y+20} l S`);
  }
  for(const line of lines){if(y-leading<60)newPage();draw(line,48,y,size,kind==='heading'?'0.13 0.35 0.26':kind==='note'?'0.30 0.36 0.33':'0.12 0.19 0.16');y-=leading;}
  y-=kind==='heading'?10:kind==='note'?6:7;
 };
  let photoXObject=0;
  if(report.photo){
   photoXObject=reserve();
   put(photoXObject,stream(report.photo.data,`/Type /XObject /Subtype /Image /Width ${report.photo.width} /Height ${report.photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`));
   const box=96;
   commands.push(`q ${box} 0 0 ${box} 451 640 cm /Im0 Do Q`);
   commands.push(`0.76 0.84 0.79 RG 48 722 m 430 722 l S`);
  }
  if(report.photo){draw(report.headerTitle??report.name,48,700,26);y=658;}
  else paragraph(report.headerTitle??report.name,24);
  if(report.contactLines?.length){
   for(const line of report.contactLines){draw(line,48,y,11,'0.30 0.36 0.33');y-=16;}
   y-=8;
  }else if(report.start&&report.end)paragraph(`${date(report.start)} — ${date(report.end)}`,12,'note');
  else if(report.name&&report.name!==(report.headerTitle??report.name))paragraph(report.name,13,'note');
 for(const block of report.blocks)paragraph(block.text,block.kind==='heading'?14:block.kind==='note'?10:11,block.kind);
 const pageIds:number[]=[];
 pageStreams.forEach((page,index)=>{
  commands=page;draw(report.start&&report.end?`Рядом, ${date(report.start)} — ${date(report.end)}`:'Рядом — резюме специалиста',48,30,8,'0.30 0.36 0.33');draw(`${index+1} / ${pageStreams.length}`,510,30,9,'0.30 0.36 0.33');
  const pageId=reserve(),contentId=reserve();pageIds.push(pageId);
  put(contentId,stream(bytes(page.join('\n'))));
  put(pageId,`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${type0} 0 R >>${photoXObject?` /XObject << /Im0 ${photoXObject} 0 R >>`:''} >> /Contents ${contentId} 0 R >>`);
 });
 const mapping=new Uint8Array((characters.size+1)*2),widths:string[]=[],unicodeLines:string[]=[];
 for(const [cp,cid] of characters){const [gid,w]=metrics.characters[cp]??metrics.characters[63]??[0,600];mapping[cid*2]=gid>>8;mapping[cid*2+1]=gid&255;widths.push(`${cid} [${w}]`);unicodeLines.push(`<${hex(cid)}> <${unicode(cp)}>`);}
 const batches:string[]=[];for(let i=0;i<unicodeLines.length;i+=100){const batch=unicodeLines.slice(i,i+100);batches.push(`${batch.length} beginbfchar\n${batch.join('\n')}\nendbfchar`);}
 put(toUnicode,stream(bytes(`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /RyadomUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${batches.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`)));
 put(cidMap,stream(mapping));put(fontFile,stream(font,`/Length1 ${font.length}`));
 put(descriptor,`<< /Type /FontDescriptor /FontName /Manrope /Flags 32 /FontBBox [${metrics.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${metrics.ascent} /Descent ${metrics.descent} /CapHeight 700 /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
 put(cidFont,`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Manrope /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap ${cidMap} 0 R /DW 600 /W [${widths.join(' ')}] >>`);
 put(type0,`<< /Type /Font /Subtype /Type0 /BaseFont /Manrope /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
 put(catalog,`<< /Type /Catalog /Pages ${pages} 0 R >>`);put(pages,`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`);
 const parts=[bytes('%PDF-1.7\n%Ryadom\n')],offsets=[0];let offset=parts[0].length;
 objects.forEach((object,index)=>{offsets.push(offset);const part=join([bytes(`${index+1} 0 obj\n`),object,bytes('\nendobj\n')]);parts.push(part);offset+=part.length;});
 parts.push(bytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
 return join(parts);
}
export async function downloadReportPdf(report:PdfReport){
 const {font,metrics}=await loadReportFont();const pdf=createReportPdf(report,font,metrics);
 const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
 const link=document.createElement('a');link.href=url;link.download=report.fileName||`ryadom-report-${report.end||'cv'}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
