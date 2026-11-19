import type {AudioAdapter} from '../messages/controller';
export const clock=(seconds:number)=>{const n=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
export class ScrubSession {
 private epoch=0;private resume=false;private active=false;
 constructor(readonly media:Pick<AudioAdapter,'pause'|'resume'|'seek'|'position'>){}
 begin(resume=this.media.position().playing){this.epoch++;this.active=true;this.resume=resume;this.media.pause();}
 async commit(seconds:number){if(!this.active)return;this.active=false;const epoch=this.epoch;const duration=this.media.position().duration;if(!(duration>0&&Number.isFinite(duration)))return;await this.media.seek(Math.max(0,Math.min(duration,seconds)));if(epoch===this.epoch&&this.resume)await this.media.resume();}
 cancel(){this.active=false;this.epoch++;}
}
