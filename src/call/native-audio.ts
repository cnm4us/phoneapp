import { requireOptionalNativeModule } from 'expo';
import { calling } from '../accounts/native';
import type { AudioDriver, AudioPreference } from './audio-routing';

type AudioModule = {
  start(session: number): Promise<unknown>; setRoute(route: AudioPreference): Promise<unknown>; stop(): Promise<void>;
  addListener(event: 'onRouteChanged', listener: (value: unknown) => void): { remove(): void };
};
export function nativeAudioDriver(): AudioDriver | undefined {
  try {
    const module = requireOptionalNativeModule<AudioModule>('PhoneappAudio');
    if (!module) return undefined;
    let native=false,sessionId=0;
    return {
      start: async session => {sessionId=session;const snapshot=await calling?.getAudioRoute(session);native=Boolean(snapshot);return snapshot??module.start(session);},
      setRoute: route => native&&calling?calling.setRoute!(route):module.setRoute(route),
      stop: async () => {if(!native)await module.stop();native=false;},
      subscribe: listener => {const subscription=module.addListener('onRouteChanged',listener);const timer=setInterval(()=>{if(native)void calling?.getAudioRoute(sessionId).then(v=>{if(v)listener(v);});},1000);return ()=>{subscription.remove();clearInterval(timer);};},
    };
  } catch { return undefined; }
}
