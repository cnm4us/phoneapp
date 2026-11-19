import type { ClientMessage, QualityMessage } from '../../shared/protocol';
import { AudioGuard, describeLimit, intersect, limitOnly, NON_ULTRA_LIMIT, PRESETS, validLimit, type Preset, type VideoLimit } from './quality';
import { describeVideo, type MediaStats } from './stats';
import { VideoDriver, type AppliedVideo } from './video';

export type QualityState = {
  preset: Preset; custom: boolean; send: VideoLimit; receive: VideoLimit; audioOnly: boolean; peerAudioOnly: boolean;
  peerSupported: boolean; cameraIntent: boolean; busy: boolean; status: string; error: string;
  sendDescription: string; receiveDescription: string; sent: string; received: string;
  ultraAvailable: boolean; applied?: AppliedVideo; stats?: MediaStats;
};
export const initialQuality = (): QualityState => ({
  preset: 'auto', custom: false, send: limitOnly(PRESETS.auto), receive: limitOnly(PRESETS.auto), audioOnly: false, peerAudioOnly: false,
  peerSupported: false, cameraIntent: true, busy: false, status: 'Audio first · automatic quality', error: '',
  sendDescription: describeLimit(PRESETS.auto), receiveDescription: describeLimit(PRESETS.auto),
  sent: 'Waiting for measurements', received: 'Waiting for measurements', ultraAvailable: false,
});

export class MediaQuality {
  state: QualityState;
  private driver?: VideoDriver;
  private serverSupported = false;
  private ultraEnabled = false;
  private relayLimit = 6_000_000;
  private remote?: Extract<QualityMessage, { type: 'media-policy' }>;
  private revision = 0;
  private lastPolicy = '';
  private lastApply = '';
  private generation = 0;
  private disposed = false;
  private sendGuard = new AudioGuard();
  private receiveGuard = new AudioGuard();
  private queue = Promise.resolve();
  private ackTimer?: ReturnType<typeof setTimeout>;
  private acknowledged?: Extract<QualityMessage, { type: 'policy-applied' }>;
  private lastAck = '';
  private negotiated = false;
  private needsNegotiation = false;
  constructor(private changed: (state: QualityState) => void, private send: (m: ClientMessage) => void, initial = initialQuality()) {
    this.state = { ...initial, peerSupported: false, peerAudioOnly: false, error: '', busy: false, applied: undefined, stats: undefined };
  }
  private update(patch: Partial<QualityState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; this.changed(this.state);
  }
  dispose() { this.disposed = true; clearTimeout(this.ackTimer); this.driver?.dispose(); }
  warn(error: string) { this.update({ error }); }
  configure(driver: VideoDriver, server: { protocolVersion?: 2; relayVideoMaxBitrate?: number; ultraEnabled?: boolean }) {
    this.driver = driver; this.serverSupported = server.protocolVersion === 2;
    this.relayLimit = server.relayVideoMaxBitrate ?? 6_000_000; this.ultraEnabled = server.ultraEnabled ?? false;
    this.update({ ultraAvailable: this.ultraEnabled && driver.canUltra() });
    if (this.serverSupported) this.send({ type: 'capabilities', version: 2 });
    void this.apply();
  }
  async handledDescription() {
    this.negotiated = true;
    await this.driver?.prioritizeAudio();
    await this.apply(true);
  }
  setPreset(preset: Preset) {
    if (preset === 'ultra' && !this.state.ultraAvailable) { this.update({ error: 'Experimental 4K requires verified device and server support.' }); return; }
    const limit = limitOnly(PRESETS[preset]);
    this.update({ preset, custom: false, send: limit, receive: limit, sendDescription: describeLimit(limit), receiveDescription: describeLimit(limit), error: '' });
    this.publish(); void this.apply();
  }
  setLimits(send: VideoLimit, receive: VideoLimit) {
    if (!validLimit(send) || !validLimit(receive)) { this.update({ error: 'Use valid resolution, frame-rate, and video bitrate limits (0.15–30 Mbps).' }); return; }
    // The UI also bounds input; the protocol validator independently rejects invalid values.
    const max = this.state.ultraAvailable ? PRESETS.ultra : NON_ULTRA_LIMIT;
    send = intersect(send, max); receive = intersect(receive, max);
    this.update({ custom: true, send: limitOnly(send), receive: limitOnly(receive), sendDescription: describeLimit(send), receiveDescription: describeLimit(receive), error: '' });
    this.publish(); void this.apply();
  }
  setCamera(enabled: boolean) {
    if (!enabled) this.driver?.disableImmediately();
    this.update({ cameraIntent: enabled, error: '' }); void this.apply();
  }
  setAudioOnly(enabled: boolean) {
    if (enabled) this.driver?.disableImmediately();
    // Returning from manual audio-only requires an explicit local Camera on action.
    this.update({ audioOnly: enabled, cameraIntent: false, error: '' });
    this.publish(); void this.apply();
    if (!enabled && this.state.peerSupported) this.send({ type: 'request-video' });
  }
  async handle(message: QualityMessage | { type: 'peer-capabilities'; version: 2 }): Promise<void> {
    if (message.type === 'peer-capabilities') {
      this.update({ peerSupported: true }); this.publish();
      if (this.needsNegotiation && this.negotiated) { this.needsNegotiation = false; this.send({ type: 'renegotiate' }); }
    } else if (message.type === 'media-policy') {
      if (message.revision <= (this.remote?.revision ?? 0)) return;
      const newlyAudioOnly = message.audioOnly && !this.state.peerAudioOnly;
      if (newlyAudioOnly) this.driver?.disableImmediately();
      this.remote = message;
      this.update({ peerAudioOnly: message.audioOnly, ...(newlyAudioOnly ? { cameraIntent: false } : {}) });
      await this.apply(true);
      return;
    } else if (message.type === 'policy-applied') {
      if (message.revision !== this.revision) return;
      this.acknowledged = message; clearTimeout(this.ackTimer);
      await this.apply(true);
      return;
    } else if (message.type === 'request-video') {
      this.update({ error: 'The other participant requests video. Leave audio-only and choose Camera on when ready.' });
    }
    await this.apply();
  }
  sample(stats: MediaStats, now: number) {
    const outgoingHeadroom = this.sendGuard.paused || (stats.availableBitrate !== undefined && stats.availableBitrate > 128_000 + (stats.sent.bitrate ?? 0) * 1.1);
    this.sendGuard.observe(stats.outgoingAudio, now, outgoingHeadroom, stats.cpu);
    // For incoming traffic, sustained clean audio and a moving stream support cautious recovery.
    this.receiveGuard.observe(stats.incomingAudio, now, (stats.received.bitrate ?? 0) > 0 || this.receiveGuard.paused);
    this.update({ stats, sent: describeVideo(stats.sent), received: describeVideo(stats.received) });
    this.publish(); void this.apply();
  }
  private receivingLimit() { return intersect(this.state.receive, this.receiveGuard.limit(), this.state.ultraAvailable ? PRESETS.ultra : NON_ULTRA_LIMIT); }
  private publish() {
    if (!this.state.peerSupported || this.disposed) return;
    const policy = { receive: this.receivingLimit(), audioOnly: this.state.audioOnly, pauseIncoming: this.receiveGuard.paused };
    const key = JSON.stringify(policy);
    if (key === this.lastPolicy) return;
    this.lastPolicy = key; this.revision++; this.acknowledged = undefined;
    this.send({ type: 'media-policy', revision: this.revision, ...policy });
    clearTimeout(this.ackTimer);
    this.ackTimer = setTimeout(() => this.update({ status: 'Incoming limit is unconfirmed · remote acknowledgment timed out' }), 5_000);
  }
  private effective() {
    let limit = intersect(this.state.send, this.sendGuard.limit(), this.remote?.receive ?? PRESETS.ultra, this.state.ultraAvailable ? PRESETS.ultra : NON_ULTRA_LIMIT);
    const stats = this.state.stats;
    if (stats?.relay !== false) limit.bitrate = Math.min(limit.bitrate, this.relayLimit);
    // Startup estimates are often ~300 kbps before probing. Pausing from that
    // estimate alone prevents probes and can permanently suppress healthy video.
    // Spend the estimated budget conservatively when audio actually needs help;
    // otherwise let WebRTC probe below the bounded user/guard ceiling.
    const audioTrouble = (stats?.outgoingAudio?.loss ?? 0) > .03 || this.sendGuard.level < 3;
    if (audioTrouble && stats?.availableBitrate !== undefined && stats.availableBitrate > 0) {
      const budget = Math.floor(stats.availableBitrate * .75 - 128_000);
      limit.bitrate = Math.max(150_000, Math.min(limit.bitrate, budget));
    }
    const manual = this.state.audioOnly || this.state.peerAudioOnly;
    const protectedAudio = this.sendGuard.paused || Boolean(this.remote?.pauseIncoming);
    let reason = manual ? 'Audio only' : protectedAudio ? 'Video paused to protect audio' : !this.state.cameraIntent ? 'Camera off' : 'Audio first · automatic quality';
    if (!manual && !protectedAudio && this.state.cameraIntent) {
      if (this.remote && (['width', 'height', 'fps', 'bitrate'] as const).some(key => this.remote!.receive[key] < this.state.send[key])) reason = 'Limited by other participant';
      else if (limit.height < this.state.send.height || limit.bitrate < this.state.send.bitrate) reason = 'Video reduced · protecting audio / checking headroom';
      if (stats?.relay !== false && this.state.send.bitrate > this.relayLimit) reason += ' · relay ceiling';
    }
    return { limit, paused: manual || protectedAudio, reason };
  }
  apply(force = false): Promise<void> {
    if (!this.driver || this.disposed) return Promise.resolve();
    const effective = this.effective();
    // Quantize bandwidth feedback; avoid parameter churn for every tiny estimate change.
    effective.limit.bitrate = Math.max(150_000, Math.floor(effective.limit.bitrate / 50_000) * 50_000);
    const key = JSON.stringify({ ...effective, camera: this.state.cameraIntent, release: this.state.audioOnly || this.state.peerAudioOnly });
    if (!force && key === this.lastApply) return this.queue;
    this.lastApply = key;
    const generation = ++this.generation;
    this.update({ busy: true });
    this.queue = this.queue.then(async () => {
      if (this.disposed || generation !== this.generation) return;
      const current = this.effective();
      current.limit.bitrate = Math.max(150_000, Math.floor(current.limit.bitrate / 50_000) * 50_000);
      const applied = await this.driver!.apply(current.limit, current.paused, this.state.cameraIntent, this.state.audioOnly || this.state.peerAudioOnly);
      if (this.disposed || generation !== this.generation) return;
      const ack = this.acknowledged;
      let status = current.reason;
      if (!this.state.peerSupported) status += ' · remote quality controls unavailable';
      else if (this.revision && !ack) status += ' · incoming request pending';
      else if (ack && (!ack.supported || ((this.state.audioOnly || this.receiveGuard.paused) && !ack.videoPaused))) status += ' · incoming limit unconfirmed';
      else if (this.state.audioOnly && applied.paused && ack?.videoPaused) status = 'Audio only · confirmed in both directions';
      if (applied.note) status += ` · ${applied.note}`;
      this.update({ applied, status, busy: false });
      if (applied.needsNegotiation) {
        this.needsNegotiation = true;
        if (this.negotiated && this.state.peerSupported) { this.needsNegotiation = false; this.send({ type: 'renegotiate' }); }
      }
      if (this.remote) {
        const acknowledgment = { type: 'policy-applied' as const, revision: this.remote.revision, applied: applied.applied, supported: applied.supported, videoPaused: applied.paused };
        const key = JSON.stringify(acknowledgment);
        if (key !== this.lastAck) { this.lastAck = key; this.send(acknowledgment); }
      }
    }).catch(() => {
      this.lastApply = '';
      this.update({ busy: false, cameraIntent: false, error: 'Could not apply this video change. Audio can continue; try a lower quality or Camera on again.' });
    });
    return this.queue;
  }
}
