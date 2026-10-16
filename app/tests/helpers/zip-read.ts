import {crc32} from '../../server/zip';

// Reads a stored (uncompressed) ZIP the way a tool would: end record, central directory, then each local entry.
// Checks every CRC, so a broken archive fails here rather than on someone's computer.
export function readZip(input:Uint8Array):Map<string,Buffer>{
 const buf=Buffer.from(input);
 const eocd=buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(eocd<0)throw new Error('no end record');
 const count=buf.readUInt16LE(eocd+10);
 let at=buf.readUInt32LE(eocd+16);
 const files=new Map<string,Buffer>();
 for(let i=0;i<count;i++){
  if(buf.readUInt32LE(at)!==0x02014b50)throw new Error('bad central entry');
  const size=buf.readUInt32LE(at+24),crc=buf.readUInt32LE(at+16),nameLen=buf.readUInt16LE(at+28),localAt=buf.readUInt32LE(at+42);
  const name=buf.subarray(at+46,at+46+nameLen).toString('utf8');
  if(buf.readUInt32LE(localAt)!==0x04034b50)throw new Error('bad local header');
  const localName=buf.readUInt16LE(localAt+26),localExtra=buf.readUInt16LE(localAt+28);
  const data=buf.subarray(localAt+30+localName+localExtra,localAt+30+localName+localExtra+size);
  if(crc32(data)!==crc)throw new Error(`crc mismatch for ${name}`);
  files.set(name,Buffer.from(data));
  at+=46+nameLen+buf.readUInt16LE(at+30)+buf.readUInt16LE(at+32);
 }
 return files;
}
