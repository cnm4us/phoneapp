import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VideoDiagnosticsReader } from '../../web/video-diagnostics';

const reports = (at: number, n: number) => new Map<string, Record<string, unknown>>([
  ['codec', { id: 'codec', type: 'codec', mimeType: 'video/H264' }],
  ['source', { id: 'source', type: 'media-source', framesPerSecond: 30 }],
  ['in', { id: 'in', type: 'inbound-rtp', kind: 'video', codecId: 'codec', timestamp: at,
    bytesReceived: n * 1000, packetsReceived: n * 9, packetsLost: n,
    framesReceived: n * 3, framesDecoded: n * 2, framesDropped: n, totalDecodeTime: n * .02,
    frameWidth: 1920, frameHeight: 1080, jitter: .015, freezeCount: n }],
  ['out', { id: 'out', type: 'outbound-rtp', kind: 'video', codecId: 'codec', mediaSourceId: 'source', timestamp: at,
    bytesSent: n * 1000, framesEncoded: n * 3, totalEncodeTime: n * .015, qualityLimitationReason: 'cpu' }],
]);

test('browser diagnostics distinguish complete frames, decoding, drops and interval packet loss with correct units', () => {
  const reader = new VideoDiagnosticsReader();
  assert.equal(reader.read(reports(1000, 10)).received.fps, undefined);
  const sample = reader.read(reports(2000, 20));
  assert.equal(sample.received.codec, 'H264');
  assert.equal(sample.received.completeFramesFps, 30);
  assert.equal(sample.received.fps, 20); assert.equal(sample.received.droppedFps, 10);
  assert.equal(sample.received.lossPercent, 10); assert.equal(sample.received.jitterMs, 15);
  assert.equal(sample.received.processingMs, 10); assert.equal(sample.received.bitrate, 80_000);
  assert.equal(sample.sent.processingMs, 5); assert.equal(sample.sent.fps, 30);
  assert.equal(sample.sent.captureFps, 30); assert.equal(sample.sent.limitation, 'cpu');
});

test('stale timestamps, long gaps, counter resets and missing fields remain unknown', () => {
  const reader = new VideoDiagnosticsReader();
  reader.read(reports(1000, 10));
  for (const snapshot of [reports(1000, 20), reports(20_000, 30), reports(21_000, 0)]) {
    const sample = reader.read(snapshot);
    assert.equal(sample.received.fps, undefined); assert.equal(sample.received.processingMs, undefined);
    assert.equal(sample.received.lossPercent, undefined);
  }
  assert.deepEqual(reader.read(new Map()), { sent: {}, received: {} });
});

test('old SSRCs and repair streams cannot overwrite an active video measurement', () => {
  const reader = new VideoDiagnosticsReader();
  const before = reports(1000, 10);
  before.set('old', { ...before.get('in'), id: 'old', bytesReceived: 1_000_000, framesDecoded: 1000, framesReceived: 1000 });
  reader.read(before);
  const next = reports(2000, 20);
  next.set('old', { ...before.get('old'), timestamp: 2000 });
  next.set('repair-codec', { type: 'codec', mimeType: 'video/rtx' });
  next.set('repair', { id: 'repair', type: 'inbound-rtp', kind: 'video', codecId: 'repair-codec', timestamp: 2000, bytesReceived: 50_000_000, framesPerSecond: 0 });
  const sample = reader.read(next);
  assert.equal(sample.received.fps, 20); assert.equal(sample.received.width, 1920);
});

test('diagnostics expose only selected numeric counters and allowlisted codec/limitation labels', () => {
  const reader = new VideoDiagnosticsReader(), snapshot = reports(1000, 10);
  snapshot.set('codec', { type: 'codec', mimeType: 'secret-codec-label' });
  Object.assign(snapshot.get('in')!, { address: 'secret-address', trackIdentifier: 'secret-track', arbitrary: 'secret-token' });
  Object.assign(snapshot.get('out')!, { qualityLimitationReason: 'secret-reason' });
  const json = JSON.stringify(reader.read(snapshot));
  assert(!json.includes('secret')); assert(!json.includes('codecId')); assert(!json.includes('trackIdentifier'));
});
