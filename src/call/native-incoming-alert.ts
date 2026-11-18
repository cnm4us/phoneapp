import { requireOptionalNativeModule } from 'expo';
import type { AlertPreferences, IncomingAlertDriver } from './incoming-alert';

type Module = {
  incomingAlertVersion?: number;
  getAlertPreferences?: () => Promise<AlertPreferences>;
  setAlertPreferences?: (sound: boolean, vibration: boolean) => Promise<void>;
  ring?: (id: string, sound: boolean, vibration: boolean, leaseMs: number) => Promise<void>;
  silence?: (id: string) => Promise<void>;
};
export function nativeIncomingAlertDriver(): IncomingAlertDriver | undefined {
  try {
    const module = requireOptionalNativeModule<Module>('PhoneappAudio');
    if (module?.incomingAlertVersion !== 1 || typeof module.getAlertPreferences !== 'function' || typeof module.setAlertPreferences !== 'function' || typeof module.ring !== 'function' || typeof module.silence !== 'function') return;
    return {
      load: () => module.getAlertPreferences!(),
      save: preferences => module.setAlertPreferences!(preferences.sound, preferences.vibration),
      ring: (id, preferences, leaseMs) => module.ring!(id, preferences.sound, preferences.vibration, leaseMs),
      silence: id => module.silence!(id),
    };
  } catch { return; }
}
