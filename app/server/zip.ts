// CRC-32 (the ZIP polynomial), written out so the same code runs in Node and in the Worker bundle.
const CRC_TABLE=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(data:Uint8Array):number{let c=0xffffffff;for(const b of data)c=CRC_TABLE[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}

// A plain ZIP writer with no compression: photos and videos are already compressed, and this keeps the export dependency-free.
// Entries are written with UTF-8 names (flag 0x0800), which every common unzip tool reads.
export function zipStore(entries:{name:string;data:Buffer}[],when=new Date()):Buffer{
 const dosTime=((when.getHours()<<11)|(when.getMinutes()<<5)|(when.getSeconds()>>1))&0xffff;
 const dosDate=((Math.max(1980,when.getFullYear())-1980)<<9|((when.getMonth()+1)<<5)|when.getDate())&0xffff;
 const parts:Buffer[]=[],central:Buffer[]=[];
 let offset=0;
 for(const e of entries){
  const name=Buffer.from(e.name,'utf8'),crc=crc32(e.data),size=e.data.length;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(0,8);
  local.writeUInt16LE(dosTime,10);local.writeUInt16LE(dosDate,12);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(size,18);local.writeUInt32LE(size,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
  parts.push(local,name,e.data);
  const dir=Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x0800,8);dir.writeUInt16LE(0,10);
  dir.writeUInt16LE(dosTime,12);dir.writeUInt16LE(dosDate,14);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(size,20);dir.writeUInt32LE(size,24);
  dir.writeUInt16LE(name.length,28);dir.writeUInt16LE(0,30);dir.writeUInt16LE(0,32);dir.writeUInt16LE(0,34);dir.writeUInt16LE(0,36);dir.writeUInt32LE(0,38);dir.writeUInt32LE(offset,42);
  central.push(dir,name);
  offset+=local.length+name.length+size;
 }
 const directory=Buffer.concat(central);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,directory,end]);
}

// Stored data URLs (`data:image/jpeg;base64,...`) and plain text both become bytes.
export function bytesOf(value:string):Buffer{
 const m=/^data:[^;]+;base64,(.*)$/s.exec(value);
 return m?Buffer.from(m[1],'base64'):Buffer.from(value,'utf8');
}
