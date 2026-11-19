// Shared policy; rates are video payload bits/s, dimensions are landscape envelopes.
export type VideoLimit = { width: number; height: number; fps: number; bitrate: number };
export const PRESETS = {
  auto: { label: 'Auto', width: 1920, height: 1080, fps: 30, bitrate: 6_000_000 },
  ultra: { label: 'Ultra · 4K/60 experimental', width: 3840, height: 2160, fps: 60, bitrate: 30_000_000 },
  high: { label: 'High · 1080p/30', width: 1920, height: 1080, fps: 30, bitrate: 8_000_000 },
  hd: { label: 'HD · 720p/30', width: 1280, height: 720, fps: 30, bitrate: 3_000_000 },
  standard: { label: 'Standard · 480p/30', width: 854, height: 480, fps: 30, bitrate: 1_200_000 },
  saver: { label: 'Data saver · 360p/24', width: 640, height: 360, fps: 24, bitrate: 450_000 },
  minimum: { label: 'Minimum · 240p/15', width: 426, height: 240, fps: 15, bitrate: 200_000 },
} satisfies Record<string, VideoLimit & { label: string }>;
export type Preset = keyof typeof PRESETS;
// Advanced controls retain their existing bounds independently of the preset.
export const NON_ULTRA_LIMIT: VideoLimit = { ...limitOnly(PRESETS.high), fps: 60 };
export const START_LIMIT: VideoLimit = { ...PRESETS.hd, fps: 24 };
export function limitOnly(v: VideoLimit): VideoLimit {
  return { width: v.width, height: v.height, fps: v.fps, bitrate: v.bitrate };
}
export function intersect(...values: VideoLimit[]): VideoLimit {
  return {
    width: Math.min(...values.map(v => v.width)), height: Math.min(...values.map(v => v.height)),
    fps: Math.min(...values.map(v => v.fps)), bitrate: Math.min(...values.map(v => v.bitrate)),
  };
}
export function validLimit(value: unknown): value is VideoLimit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 4 || !['width', 'height', 'fps', 'bitrate'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]))) return false;
  return Number.isInteger(v.width) && Number.isInteger(v.height) &&
    (v.width as number) >= 160 && (v.width as number) <= 3840 &&
    (v.height as number) >= 120 && (v.height as number) <= 2160 &&
    (v.width as number) >= (v.height as number) &&
    (v.fps as number) >= 1 && (v.fps as number) <= 60 &&
    (v.bitrate as number) >= 150_000 && (v.bitrate as number) <= 30_000_000;
}
export function describeLimit(v: VideoLimit) {
  return `${v.height}p / ${v.fps} fps / ${(v.bitrate / 1_000_000).toFixed(2)} Mbps max`;
}
export type AudioHealth = { loss?: number; concealment?: number; jitterDelay?: number; packets: number; rtt?: number };
const ladder: VideoLimit[] = [PRESETS.minimum, PRESETS.saver, PRESETS.standard, PRESETS.hd, PRESETS.auto, PRESETS.high, PRESETS.ultra];

// Fast reduction, slow recovery. No synthetic minimum bitrate competes with audio.
export class AudioGuard {
  level = 3;
  paused = false;
  private samples: { at: number; bad: boolean; severe: boolean }[] = [];
  private stableSince?: number;
  private lastChange = -Infinity;
  private warmed = false;
  private lastObserved?: number;
  observe(audio: AudioHealth | undefined, now: number, headroom = false, cpu = false) {
    const observable = Boolean(audio && audio.packets > 0 &&
      [audio.loss, audio.concealment, audio.jitterDelay].some(v => v !== undefined));
    if (!observable) {
      // RTCP feedback can be less frequent than polling. Brief gaps must not
      // erase recovery progress; a genuinely stale stream cannot establish it.
      if (this.lastObserved === undefined || now - this.lastObserved > 15_000) { this.stableSince = undefined; this.samples = []; }
      return;
    }
    this.lastObserved = now;
    const delayedWithImpairment = (audio!.jitterDelay ?? 0) > .12 && ((audio!.loss ?? 0) > .01 || (audio!.concealment ?? 0) > .02);
    const bad = cpu || (audio!.loss ?? 0) > .03 || (audio!.concealment ?? 0) > .05 || delayedWithImpairment;
    const severe = (audio!.loss ?? 0) > .08 || (audio!.concealment ?? 0) > .10;
    this.samples = [...this.samples.filter(s => now - s.at <= 5_000), { at: now, bad, severe }];
    const sustained = (key: 'bad' | 'severe') => {
      const consecutive = this.samples.slice(-3);
      return consecutive.length === 3 && consecutive.every(s => s[key]) && now - consecutive[0].at >= 1_800;
    };
    if (bad) {
      this.stableSince = undefined;
      if (now - this.lastChange >= 3_000 && sustained('bad')) {
        if (sustained('severe') || this.level === 0) this.paused = true;
        else this.level--;
        this.lastChange = now;
      }
    } else if ((audio!.loss ?? 0) < .01 && (audio!.concealment ?? 0) < .01 && headroom) {
      this.stableSince ??= now;
      if (now - this.stableSince >= 20_000 && now - this.lastChange >= 10_000) {
        if (this.paused) { this.paused = false; this.level = 0; }
        else this.level = Math.min(ladder.length - 1, this.level + 1);
        this.warmed = true;
        this.lastChange = now;
      }
    } else this.stableSince = undefined;
  }
  limit(): VideoLimit { return !this.warmed && this.level === 3 ? START_LIMIT : ladder[this.level]; }
}
