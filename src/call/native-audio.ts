import { requireOptionalNativeModule } from 'expo';
import type { AudioDriver, AudioPreference } from './audio-routing';

type AudioModule = {
  start(session: number): Promise<unknown>; setRoute(route: AudioPreference): Promise<unknown>; stop(): Promise<void>;
  addListener(event: 'onRouteChanged', listener: (value: unknown) => void): { remove(): void };
};
export function nativeAudioDriver(): AudioDriver | undefined {
  try {
    const module = requireOptionalNativeModule<AudioModule>('PhoneappAudio');
    if (!module) return undefined;
    return {
      start: session => module.start(session), setRoute: route => module.setRoute(route), stop: () => module.stop(),
      subscribe: listener => { const subscription = module.addListener('onRouteChanged', listener); return () => subscription.remove(); },
    };
  } catch { return undefined; }
}
