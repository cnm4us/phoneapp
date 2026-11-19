import { intersect, limitOnly, NON_ULTRA_LIMIT, type VideoLimit } from './quality';

// Small common runtime contract shared by browser WebRTC and RN WebRTC 155.
// Each platform casts its peer/stream once at the boundary; no DOM imports here.
export type Track = {
  id: string; kind: string; enabled: boolean; readyState: string;
  stop(): void; getSettings(): { width?: number; height?: number; frameRate?: number };
  getCapabilities?(): { width?: { max?: number }; height?: { max?: number }; frameRate?: { max?: number } };
  applyConstraints(value: Constraints): Promise<void>;
};
export type Constraints = { width: { ideal: number; max: number }; height: { ideal: number; max: number }; frameRate: { ideal: number; max: number } };
type Encoding = { active: boolean; maxBitrate?: number | null; maxFramerate?: number | null; scaleResolutionDownBy?: number | null; priority?: string; networkPriority?: string };
type Parameters = { encodings: Encoding[]; degradationPreference?: string | null; toJSON?(): unknown };
type Sender = { track: Track | null; getParameters(): Parameters; setParameters(p: Parameters): Promise<void>; replaceTrack(track: Track | null): Promise<void> };
export type Transceiver = { sender: Sender; receiver: { track: Track }; direction: string; currentDirection: string | null };
export type MediaPeer = { getTransceivers(): Transceiver[] };
export type Stream = { getVideoTracks(): Track[]; getTracks(): Track[]; addTrack(t: Track): void; removeTrack(t: Track): void };
export type AppliedVideo = { applied: VideoLimit; supported: boolean; paused: boolean; camera: boolean; hasCamera: boolean; note: string; needsNegotiation: boolean };

export function constraints(limit: VideoLimit, track?: Track): Constraints {
  const settings = track?.getSettings();
  const portrait = (settings?.height ?? 0) > (settings?.width ?? Infinity);
  const w = portrait ? limit.height : limit.width, h = portrait ? limit.width : limit.height;
  return { width: { ideal: w, max: w }, height: { ideal: h, max: h }, frameRate: { ideal: limit.fps, max: limit.fps } };
}

export class VideoDriver {
  private disposed = false;
  private track?: Track;
  private captureKey = '';
  constructor(private peer: MediaPeer, private stream: Stream,
    private acquire: (limit: VideoLimit) => Promise<Stream>, private changed: () => void) {
    this.track = stream.getVideoTracks()[0];
  }
  dispose() { this.disposed = true; }
  disableImmediately() { if (this.track) this.track.enabled = false; }
  canUltra() {
    try {
      const c = this.track?.getCapabilities?.();
      return (c?.width?.max ?? 0) >= 3840 && (c?.height?.max ?? 0) >= 2160 && (c?.frameRate?.max ?? 0) >= 60;
    } catch { return false; }
  }
  async apply(request: VideoLimit, pause: boolean, cameraIntent: boolean, release: boolean): Promise<AppliedVideo> {
    let limit = limitOnly(request), note = '', supported = true, needsNegotiation = false;
    const transceiver = this.peer.getTransceivers().find(t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video');
    const sender = transceiver?.sender;
    if (limit.height > 1080 && !this.canUltra()) { limit = intersect(limit, NON_ULTRA_LIMIT); note = '4K capture is not verified on this device'; }
    const off = pause || !cameraIntent;
    if (off) {
      this.disableImmediately();
      if (sender?.track) {
        try {
          await sender.replaceTrack(null);
          if (sender.track !== null) throw new Error('Video detach was not applied');
        } catch { supported = false; note = 'Video suppression could not be confirmed'; }
      }
      if (release && this.track) {
        this.stream.removeTrack(this.track); this.track.stop(); this.track = undefined; this.captureKey = ''; this.changed();
      }
    } else if (sender && transceiver) {
      if (!this.track || this.track.readyState === 'ended') {
        const stream = await this.acquire(limit);
        if (this.disposed) { stream.getTracks().forEach(t => t.stop()); throw new Error('Call ended'); }
        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error('Camera unavailable');
        this.track = track; this.stream.addTrack(track); this.changed();
      }
      this.track.enabled = true;
      if (sender.track?.id !== this.track.id) {
        await sender.replaceTrack(this.track);
        if (sender.track?.id !== this.track.id) { this.track.enabled = false; throw new Error('Camera replacement was not applied'); }
      }
      if (transceiver.direction !== 'sendrecv') { transceiver.direction = 'sendrecv'; needsNegotiation = true; }
      // A direction change can be waiting for a serialized offer/answer already.
      if (transceiver.currentDirection === 'recvonly' || transceiver.currentDirection === 'inactive') needsNegotiation = true;
      const key = JSON.stringify({ width: limit.width, height: limit.height, fps: limit.fps });
      if (key !== this.captureKey) {
        try { await this.track.applyConstraints(constraints(limit, this.track)); this.captureKey = key; }
        catch { note = 'Capture limit unavailable; sender scaling requested'; }
      }
    }
    if (this.disposed) throw new Error('Call ended');
    if (sender) {
      const p = sender.getParameters();
      if (p.encodings?.length) {
        const settings = this.track?.getSettings();
        const long = Math.max(settings?.width ?? limit.width, settings?.height ?? limit.height);
        const short = Math.min(settings?.width ?? limit.width, settings?.height ?? limit.height);
        const scale = Math.max(1, long / limit.width, short / limit.height);
        for (const e of p.encodings) {
          e.active = !off; e.maxBitrate = limit.bitrate; e.maxFramerate = limit.fps; e.scaleResolutionDownBy = scale;
          if ('priority' in e) e.priority = 'very-low';
          if ('networkPriority' in e) e.networkPriority = 'low';
        }
        if ('degradationPreference' in p) p.degradationPreference = 'maintain-framerate';
        try { await sender.setParameters(p); }
        catch {
          // Retry mandatory controls without optional priority/degradation hints.
          const retry = sender.getParameters();
          for (const e of retry.encodings) {
            e.active = !off; e.maxBitrate = limit.bitrate; e.maxFramerate = limit.fps; e.scaleResolutionDownBy = scale;
            delete e.priority; delete e.networkPriority;
          }
          // RN's serializer uses null as its omission sentinel; deleting the
          // field makes that serializer try to convert undefined to native.
          if (typeof retry.toJSON === 'function') retry.degradationPreference = null;
          else delete retry.degradationPreference;
          try { await sender.setParameters(retry); }
          catch {
            supported = false; note = 'Sender limits unsupported · video stopped to protect audio';
            this.disableImmediately();
            try { await sender.replaceTrack(null); } catch { /* Report unconfirmed suppression below. */ }
          }
        }
        const applied = sender.getParameters().encodings;
        if (!off && applied.some(e => e.maxBitrate == null || e.maxBitrate > limit.bitrate || e.maxFramerate == null || e.maxFramerate > limit.fps)) {
          supported = false; note = 'Sender did not confirm all requested limits';
        }
      } else if (!off) { supported = false; note = 'Waiting for negotiated video controls'; }
    } else if (!off) { supported = false; note = 'Video sender unavailable'; }
    if (this.disposed) throw new Error('Call ended');
    return { applied: limit, supported, paused: !sender?.track, camera: !off && Boolean(this.track?.enabled), hasCamera: Boolean(this.track), note, needsNegotiation };
  }
  async prioritizeAudio() {
    for (const t of this.peer.getTransceivers()) {
      if (t.sender.track?.kind !== 'audio') continue;
      const p = t.sender.getParameters();
      let supported = false;
      for (const e of p.encodings) {
        if ('priority' in e) { e.priority = 'high'; supported = true; }
        if ('networkPriority' in e) { e.networkPriority = 'high'; supported = true; }
      }
      if (supported) { try { await t.sender.setParameters(p); } catch { /* Priority is optional; video budget remains authoritative. */ } }
    }
  }
}
