export const AUDIO_PREFERENCES = ['automatic', 'speaker', 'earpiece'] as const;
export type AudioPreference = typeof AUDIO_PREFERENCES[number];
export type AudioOutput = 'speaker' | 'earpiece' | 'headset' | 'bluetooth' | 'unknown';
export type AudioSnapshot = { active: boolean; route: AudioOutput; preference: AudioPreference; choices: AudioPreference[] };
export type AudioOutputState = AudioSnapshot & { available: boolean; busy: boolean; error: string };
export const initialAudioOutput = (available = false): AudioOutputState => ({ available, active: false, busy: false, error: '', route: 'unknown', preference: 'automatic', choices: [] });
export type AudioDriver = {
  start(session: number): Promise<unknown>; setRoute(route: AudioPreference): Promise<unknown>; stop(): Promise<void>;
  subscribe(listener: (snapshot: unknown) => void): () => void;
};
export function audioSnapshot(value: unknown): AudioSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid audio output');
  const v = value as Record<string, unknown>;
  if (typeof v.active !== 'boolean' || !['speaker', 'earpiece', 'headset', 'bluetooth', 'unknown'].includes(String(v.route)) || !AUDIO_PREFERENCES.includes(v.preference as AudioPreference) || !Array.isArray(v.choices) || !v.choices.every(p => AUDIO_PREFERENCES.includes(p))) throw new Error('Invalid audio output');
  return { active: v.active, route: v.route as AudioOutput, preference: v.preference as AudioPreference, choices: [...new Set(v.choices)] };
}
export function audioOutputLabel(output: AudioOutput) {
  return { speaker: 'Speaker', earpiece: 'Phone earpiece', headset: 'Wired / USB headset', bluetooth: 'Bluetooth', unknown: 'Not confirmed' }[output];
}

// Serialize start/selection/stop across calls. Generation checks prevent a late
// native response or event from restoring stale UI after hangup/rejoin.
export class AudioRouting {
  state: AudioOutputState;
  private generation = 0;
  private running = false;
  private queue = Promise.resolve();
  private unsubscribe?: () => void;
  constructor(private driver: AudioDriver | undefined, private changed: (state: AudioOutputState) => void) {
    this.state = initialAudioOutput(Boolean(driver));
  }
  private update(patch: Partial<AudioOutputState>) { this.state = { ...this.state, ...patch }; this.changed(this.state); }
  settled() { return this.queue; }
  start() {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation, driver = this.driver;
    if (!driver) {
      this.update({ ...initialAudioOutput(), error: 'Audio output controls need the updated app.' });
      return;
    }
    this.update({ ...initialAudioOutput(true), busy: true });
    try {
      this.unsubscribe = driver.subscribe(value => {
        if (generation !== this.generation || !this.running || this.state.busy || !this.state.active) return;
        if (!value || typeof value !== 'object' || (value as Record<string, unknown>).session !== generation) return;
        try { this.update(audioSnapshot(value)); } catch { /* Bad route data cannot end a media call. */ }
      });
    } catch {
      this.update({ busy: false, error: 'Audio output controls are unavailable. The call can continue.' });
      return;
    }
    this.queue = this.queue.then(async () => {
      if (generation !== this.generation || !this.running) return;
      try {
        const snapshot = audioSnapshot(await driver.start(generation));
        if (generation === this.generation) this.update({ ...snapshot, busy: false });
      } catch {
        try { await driver.stop(); } catch { /* Best-effort release after partial native start. */ }
        if (generation === this.generation) this.update({ busy: false, active: false, error: 'Audio output controls are unavailable. The call can continue.' });
      }
    });
  }
  select(preference: AudioPreference) {
    if (!this.driver || !this.running || !this.state.active || this.state.busy || !this.state.choices.includes(preference)) return;
    const generation = this.generation, driver = this.driver;
    this.update({ busy: true, error: '' });
    this.queue = this.queue.then(async () => {
      if (generation !== this.generation || !this.running) return;
      try {
        const snapshot = audioSnapshot(await driver.setRoute(preference));
        if (generation === this.generation) this.update({ ...snapshot, busy: false });
      } catch {
        if (generation === this.generation) this.update({ busy: false, route: 'unknown', error: 'Could not confirm that audio output. Try Automatic or another available option.' });
      }
    });
  }
  toggleSpeaker() {
    this.select(this.state.route === 'speaker' ? (this.state.choices.includes('earpiece') ? 'earpiece' : 'automatic') : 'speaker');
  }
  stop() {
    if (!this.running) return;
    this.running = false;
    ++this.generation;
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.update(initialAudioOutput(Boolean(this.driver)));
    const driver = this.driver;
    this.queue = this.queue.then(async () => {
      try { await driver?.stop(); } catch { /* No late UI update or failed-call cascade during teardown. */ }
    });
  }
}
