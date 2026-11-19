import type { Reports } from '../src/call/stats';

type Report = Record<string, unknown>;
export type VideoDiagnostic = {
  codec?: string; width?: number; height?: number; fps?: number; completeFramesFps?: number;
  droppedFps?: number; processingMs?: number; lossPercent?: number; jitterMs?: number;
  freezes?: number; bitrate?: number; limitation?: string; captureFps?: number;
};
export type VideoDiagnostics = { sent: VideoDiagnostic; received: VideoDiagnostic };
const numeric = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const codecs = ['video/vp8', 'video/vp9', 'video/h264', 'video/h265', 'video/av1', 'video/av1x'];
const repairCodecs = ['video/rtx', 'video/red', 'video/ulpfec', 'video/flexfec-03'];

// Browser-only, read-only measurements. No raw reports, addresses, identifiers,
// SDP, or device labels leave this reader. No media policy changes are made.
export class VideoDiagnosticsReader {
  private previous = new Map<string, Report>();
  read(reports: Reports): VideoDiagnostics {
    const delta = (r: Report, key: string) => {
      const old = this.previous.get(String(r.id));
      const at = numeric(r.timestamp), before = numeric(old?.timestamp);
      const value = numeric(r[key]), prior = numeric(old?.[key]);
      if (at === undefined || before === undefined || at <= before || at - before > 10_000 || value === undefined || prior === undefined || value < prior) return undefined;
      return value - prior;
    };
    const read = (inbound: boolean): VideoDiagnostic => {
      let chosen: Report | undefined, best = -1;
      reports.forEach(r => {
        if (r.type !== (inbound ? 'inbound-rtp' : 'outbound-rtp') || r.isRemote || (r.kind ?? r.mediaType) !== 'video') return;
        const mime = String(reports.get(String(r.codecId))?.mimeType ?? '').toLowerCase();
        if (repairCodecs.includes(mime)) return;
        const key = inbound ? 'bytesReceived' : 'bytesSent';
        // An old SSRC may remain after camera changes; prefer current traffic.
        const score = delta(r, key) ?? (this.previous.size ? 0 : numeric(r[key]) ?? 0);
        if (score > best) { best = score; chosen = r; }
      });
      if (!chosen) return {};
      const r = chosen, dt = delta(r, 'timestamp');
      const rate = (key: string) => { const n = delta(r, key); return dt && n !== undefined ? n * 1000 / dt : undefined; };
      const frames = delta(r, inbound ? 'framesDecoded' : 'framesEncoded');
      const processing = delta(r, inbound ? 'totalDecodeTime' : 'totalEncodeTime');
      const packets = delta(r, 'packetsReceived'), lost = delta(r, 'packetsLost');
      const bytes = delta(r, inbound ? 'bytesReceived' : 'bytesSent');
      const mime = String(reports.get(String(r.codecId))?.mimeType ?? '').toLowerCase();
      const source = reports.get(String(r.mediaSourceId));
      return {
        codec: codecs.includes(mime) ? mime.slice(6).toUpperCase() : undefined,
        width: numeric(r.frameWidth), height: numeric(r.frameHeight),
        fps: rate(inbound ? 'framesDecoded' : 'framesEncoded') ?? (dt ? numeric(r.framesPerSecond) : undefined),
        completeFramesFps: inbound ? rate('framesReceived') : undefined,
        droppedFps: inbound ? rate('framesDropped') : undefined,
        processingMs: frames && processing !== undefined ? processing * 1000 / frames : undefined,
        lossPercent: packets !== undefined && lost !== undefined && packets + lost > 0 ? lost * 100 / (packets + lost) : undefined,
        jitterMs: inbound && numeric(r.jitter) !== undefined ? numeric(r.jitter)! * 1000 : undefined,
        freezes: inbound ? delta(r, 'freezeCount') : undefined,
        bitrate: dt && bytes !== undefined ? bytes * 8000 / dt : undefined,
        limitation: ['none', 'cpu', 'bandwidth', 'other'].includes(String(r.qualityLimitationReason)) ? String(r.qualityLimitationReason) : undefined,
        captureFps: !inbound ? numeric(source?.framesPerSecond) : undefined,
      };
    };
    const result = { sent: read(false), received: read(true) };
    const next = new Map<string, Report>();
    reports.forEach(r => {
      if (r.type !== 'inbound-rtp' && r.type !== 'outbound-rtp') return;
      const counters: Report = {};
      for (const [key, value] of Object.entries(r)) if (numeric(value) !== undefined) counters[key] = value;
      next.set(String(r.id), counters);
    });
    this.previous = next;
    return result;
  }
}

export function describeVideoDiagnostic(v?: VideoDiagnostic, inbound = true): string {
  if (!v || !Object.keys(v).length) return 'Waiting for measurements';
  const parts = [v.codec ?? 'Codec unknown'];
  if (v.fps !== undefined) parts.push(`${v.fps.toFixed(1)} fps ${inbound ? 'decoded' : 'encoded'}`);
  if (v.completeFramesFps !== undefined) parts.push(`${v.completeFramesFps.toFixed(1)} complete frames/s received`);
  if (v.droppedFps !== undefined) parts.push(`${v.droppedFps.toFixed(1)} frames/s dropped`);
  if (v.lossPercent !== undefined) parts.push(`${v.lossPercent.toFixed(1)}% packet loss`);
  if (v.processingMs !== undefined) parts.push(`${v.processingMs.toFixed(1)} ms/${inbound ? 'decode' : 'encode'}`);
  if (v.limitation !== undefined) parts.push(`encoder limit: ${v.limitation}`);
  return parts.join(' · ');
}
