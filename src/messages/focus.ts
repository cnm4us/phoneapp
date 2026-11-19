// Live calls own audio. Recorder/player implementations register a bounded release operation.
let release:()=>Promise<void>=async()=>{};
export function ownMessageAudio(stop:()=>Promise<void>):()=>void{release=stop;return ()=>{if(release===stop)release=async()=>{};};}
export async function releaseMessageAudio(){await release();}
