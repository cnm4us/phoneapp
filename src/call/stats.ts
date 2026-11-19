import type { AudioHealth } from './quality';

type Report = Record<string, unknown>;
export type Reports = { forEach(callback: (v: Report) => void): void; get(id: string): Report | undefined };
export type VideoStats = { bitrate?: number; width?: number; height?: number; fps?: number; bytes: number; packets: number };
export type MediaStats = {
  sent: VideoStats; received: VideoStats; incomingAudio?: AudioHealth; outgoingAudio?: AudioHealth;
  availableBitrate?: number; relay?: boolean; path: string; receivedBytes: number;
  audioReceivedBytes: number; audioSentBytes: number; cpu: boolean;
};
const number = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const emptyVideo = (): VideoStats => ({ bytes: 0, packets: 0 });
export class StatsReader {
  private previous = new Map<string, Report>();
  read(reports: Reports): MediaStats {
    const next = new Map<string, Report>();
    const result: MediaStats = { sent: emptyVideo(), received: emptyVideo(), path: 'Selected path not available yet', receivedBytes: 0, audioReceivedBytes: 0, audioSentBytes: 0, cpu: false };
    let pair: Report | undefined;
    const delta = (r: Report, key: string) => {
      const old = this.previous.get(String(r.id));
      const t = number(r.timestamp), pt = number(old?.timestamp), v = number(r[key]), pv = number(old?.[key]);
      if (t === undefined || pt === undefined || t <= pt || t - pt > 10_000 || v === undefined || pv === undefined || v < pv) return undefined;
      return v - pv;
    };
    const worst = (a: AudioHealth | undefined, b: AudioHealth): AudioHealth => {
      if (!a) return b;
      const max = (x?: number, y?: number) => x === undefined ? y : y === undefined ? x : Math.max(x, y);
      return { packets: a.packets + b.packets, loss: max(a.loss, b.loss), concealment: max(a.concealment, b.concealment), jitterDelay: max(a.jitterDelay, b.jitterDelay), rtt: max(a.rtt, b.rtt) };
    };
    reports.forEach(r => {
      // Retain only numeric counters/metadata used here; never retain IPs, SDP, or credentials.
      const clean: Report = {};
      for (const [k, v] of Object.entries(r)) if (typeof v === 'number') clean[k] = v;
      next.set(String(r.id), clean);
      if (r.type === 'transport' && typeof r.selectedCandidatePairId === 'string') pair = reports.get(r.selectedCandidatePairId);
      if (r.type === 'inbound-rtp' && !r.isRemote) result.receivedBytes += number(r.bytesReceived) ?? 0;
      const kind = r.kind ?? r.mediaType;
      const inbound = r.type === 'inbound-rtp', outbound = r.type === 'outbound-rtp';
      if ((inbound || outbound) && kind === 'video') {
        const v = inbound ? result.received : result.sent;
        const key = inbound ? 'bytesReceived' : 'bytesSent';
        v.bytes += number(r[key]) ?? 0;
        v.packets += number(r[inbound ? 'packetsReceived' : 'packetsSent']) ?? 0;
        const dt = delta(r, 'timestamp'), bytes = delta(r, key);
        if (dt && bytes !== undefined) v.bitrate = (v.bitrate ?? 0) + bytes * 8_000 / dt;
        v.width = number(r.frameWidth); v.height = number(r.frameHeight);
        v.fps = number(r.framesPerSecond);
        if (v.fps === undefined && dt) {
          const frames = delta(r, inbound ? 'framesDecoded' : 'framesEncoded');
          if (frames !== undefined) v.fps = frames * 1_000 / dt;
        }
        if (r.qualityLimitationReason === 'cpu') result.cpu = true;
      }
      if (kind !== 'audio') return;
      if (inbound) result.audioReceivedBytes += number(r.bytesReceived) ?? 0;
      if (outbound) result.audioSentBytes += number(r.bytesSent) ?? 0;
      if (inbound) {
        const received = delta(r, 'packetsReceived');
        const old = this.previous.get(String(r.id));
        const lostNow = number(r.packetsLost), lostBefore = number(old?.packetsLost);
        const lost = delta(r, 'timestamp') && lostNow !== undefined && lostBefore !== undefined ? Math.max(0, lostNow - lostBefore) : undefined;
        const samples = delta(r, 'totalSamplesReceived'), concealed = delta(r, 'concealedSamples');
        const emitted = delta(r, 'jitterBufferEmittedCount'), delay = delta(r, 'jitterBufferDelay');
        result.incomingAudio = worst(result.incomingAudio, {
          packets: received ?? 0,
          loss: received !== undefined && lost !== undefined && received + lost > 0 ? lost / (received + lost) : undefined,
          concealment: samples && concealed !== undefined ? concealed / samples : undefined,
          jitterDelay: emitted && delay !== undefined ? delay / emitted : undefined,
        });
      } else if (r.type === 'remote-inbound-rtp') {
        const local = reports.get(String(r.localId));
        const packets = local ? delta(local, 'packetsSent') : undefined;
        // fractionLost is fresh RTCP feedback; an unchanged report is unknown, not stable audio.
        const fresh = delta(r, 'timestamp');
        result.outgoingAudio = worst(result.outgoingAudio, {
          packets: fresh ? packets ?? 0 : 0,
          loss: fresh ? number(r.fractionLost) : undefined, rtt: number(r.roundTripTime),
        });
      }
    });
    if (!pair) reports.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r; });
    if (pair) {
      const local = reports.get(String(pair.localCandidateId)), remote = reports.get(String(pair.remoteCandidateId));
      result.relay = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
      result.availableBitrate = number(pair.availableOutgoingBitrate);
      result.path = `${local?.candidateType ?? 'unknown'} → ${remote?.candidateType ?? 'unknown'} · ${local?.protocol ?? 'unknown'}`;
    }
    this.previous = next;
    return result;
  }
}
export function describeVideo(v?: VideoStats): string {
  if (!v) return 'Waiting for measurements';
  const size = v.width && v.height ? `${v.width}×${v.height}` : 'No video frames';
  return `${size} · ${v.fps === undefined ? 'fps unknown' : `${v.fps.toFixed(0)} fps`} · ${v.bitrate === undefined ? 'rate unknown' : `${(v.bitrate / 1_000_000).toFixed(2)} Mbps`}`;
}
export function describeAudio(v?: AudioHealth): string {
  if (!v || v.packets <= 0) return 'Audio quality feedback unavailable';
  const parts = [v.loss === undefined ? 'loss unknown' : `${(v.loss * 100).toFixed(1)}% loss`];
  if (v.concealment !== undefined) parts.push(`${(v.concealment * 100).toFixed(1)}% concealed`);
  if (v.jitterDelay !== undefined) parts.push(`${(v.jitterDelay * 1000).toFixed(0)} ms jitter buffer`);
  return parts.join(' · ');
}
