// Synthetic MOV fixture: relabel a generated subtitle track as opaque iPhone timed metadata.
// Its sample bytes are never decoded; the production normalizer explicitly drops the track.
export function withCameraMetadata(input:Buffer,tag='mebx'):Buffer{
 const data=Buffer.from(input);let changed=false;
 function boxes(start:number,end:number):{offset:number;size:number;type:string}[]{const result=[];while(start+8<=end){const size=data.readUInt32BE(start);if(size<8||start+size>end)throw new Error('Invalid fixture box');result.push({offset:start,size,type:data.toString('ascii',start+4,start+8)});start+=size;}return result;}
 for(const moov of boxes(0,data.length).filter(b=>b.type==='moov'))for(const trak of boxes(moov.offset+8,moov.offset+moov.size).filter(b=>b.type==='trak'))for(const mdia of boxes(trak.offset+8,trak.offset+trak.size).filter(b=>b.type==='mdia')){
  const children=boxes(mdia.offset+8,mdia.offset+mdia.size),handler=children.find(b=>b.type==='hdlr');if(!handler||!['sbtl','text'].includes(data.toString('ascii',handler.offset+16,handler.offset+20)))continue;
  data.write('meta',handler.offset+16,4,'ascii');
  for(const minf of children.filter(b=>b.type==='minf'))for(const stbl of boxes(minf.offset+8,minf.offset+minf.size).filter(b=>b.type==='stbl'))for(const stsd of boxes(stbl.offset+8,stbl.offset+stbl.size).filter(b=>b.type==='stsd')){data.write(tag,stsd.offset+20,4,'ascii');changed=true;}
 }
 if(!changed)throw new Error('Synthetic subtitle track missing');return data;
}
