export type AlertPreferences = { sound: boolean; vibration: boolean };
export type IncomingAlertInput = { callId?: string; updatedAt?: number; foreground: boolean; mediaActive: boolean; busy: boolean };
export interface IncomingAlertDriver {
  load(): Promise<AlertPreferences>;
  save(preferences: AlertPreferences): Promise<void>;
  ring(id: string, preferences: AlertPreferences, leaseMs: number): Promise<void>;
  silence(id: string): Promise<void>;
}
export type IncomingAlertState = { available: boolean; ready: boolean; saving: boolean; preferences: AlertPreferences; error: string };
export const ALERT_LEASE_MS = 6_000;

// One serial owner, outside settings/screens. Native also expires the renewable lease.
export class IncomingAlerts {
  state: IncomingAlertState;
  private input: IncomingAlertInput = { foreground: false, mediaActive: false, busy: false };
  private listeners = new Set<(state: IncomingAlertState) => void>();
  private dismissed = new Set<string>();
  private nativeId?: string;
  private revision = 0;
  private foregroundSince = 0;
  private pending = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  private disposed = false;
  readonly initialized: Promise<void>;

  constructor(private driver?: IncomingAlertDriver, private now: () => number = () => performance.now(), autoExpire = true) {
    this.state = { available: Boolean(driver), ready: !driver, saving: false, preferences: { sound: true, vibration: true }, error: '' };
    this.initialized = driver ? Promise.resolve().then(() => driver.load()).then(preferences => {
      if (typeof preferences.sound !== 'boolean' || typeof preferences.vibration !== 'boolean') throw new Error('Invalid preferences');
      if (!this.disposed) { this.update({ ready: true, preferences }); this.reconcile(); }
    }).catch(() => { if (!this.disposed) this.update({ error: 'Incoming alert settings could not load.' }); }) : Promise.resolve();
    if (autoExpire) this.timer = setInterval(() => {
      if (this.nativeId && !this.desired()) this.reconcile();
    }, 250);
  }
  subscribe(listener: (state: IncomingAlertState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private update(patch: Partial<IncomingAlertState>): void { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(this.state); }
  observe(input: IncomingAlertInput): void { if (input.foreground && !this.input.foreground) this.foregroundSince = this.now(); this.input = input; this.reconcile(); }
  private desired(): string | undefined {
    const { callId, updatedAt, foreground, mediaActive, busy } = this.input;
    const preferences = this.state.preferences;
    if (this.disposed || !this.state.ready || !this.driver || !callId || updatedAt === undefined || updatedAt < this.foregroundSince || !foreground || mediaActive || busy || this.dismissed.has(callId) || this.now() - updatedAt >= ALERT_LEASE_MS || !(preferences.sound || preferences.vibration)) return;
    return callId;
  }
  private reconcile(): void {
    const revision = ++this.revision;
    this.pending = this.pending.then(async () => {
      if (revision !== this.revision || !this.driver) return;
      const desired = this.desired();
      if (this.nativeId && this.nativeId !== desired) {
        await this.driver.silence(this.nativeId);
        this.nativeId = undefined;
      }
      if (revision !== this.revision || !desired) return;
      this.nativeId = desired;
      await this.driver.ring(desired, this.state.preferences, Math.max(1, Math.floor(ALERT_LEASE_MS - (this.now() - this.input.updatedAt!))));
      // A late native start cannot outlive an answer/background/cancellation.
      if (revision !== this.revision || this.desired() !== desired) {
        await this.driver.silence(desired);
        if (this.nativeId === desired) this.nativeId = undefined;
      }
    }).catch(() => { if (!this.disposed) this.update({ error: 'Incoming alert could not update. Check sound settings or update the app.' }); });
  }
  async setPreferences(preferences: AlertPreferences): Promise<void> {
    if (!this.driver || !this.state.ready || this.state.saving) return;
    this.update({ saving: true });
    try {
      await this.driver.save(preferences);
      if (this.disposed) return;
      this.update({ preferences, error: '' });
      this.reconcile();
    } catch { this.update({ error: 'Incoming alert settings could not be saved.' }); }
    finally { if (!this.disposed) this.update({ saving: false }); }
  }
  async silence(): Promise<void> {
    if (this.input.callId) {
      this.dismissed.add(this.input.callId);
      if (this.dismissed.size > 32) this.dismissed.delete(this.dismissed.values().next().value!);
    }
    this.reconcile();
    let tail = this.pending;
    await tail;
    while (tail !== this.pending) { tail = this.pending; await tail; }
    if (this.nativeId) throw new Error('Incoming sound is still stopping. End the call and try again.');
  }
  async flush(): Promise<void> { await this.pending; }
  dispose(): void {
    this.disposed = true;
    clearInterval(this.timer);
    this.reconcile();
    this.listeners.clear();
  }
}
