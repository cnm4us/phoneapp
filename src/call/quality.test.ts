import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioGuard, intersect, PRESETS, validLimit } from './quality';
import { StatsReader } from './stats';
import { MediaQuality } from './media-quality';
import { VideoDriver, type Stream, type Track, type Transceiver } from './video';
import type { ClientMessage } from '../../shared/protocol';

test('directional ceilings intersect independently; unsafe network values are rejected', () => {
  assert.deepEqual(intersect(PRESETS.ultra, PRESETS.high, PRESETS.saver), { width: 640, height: 360, fps: 24, bitrate: 450_000 });
  assert(validLimit({ width: 1920, height: 1080, fps: 60, bitrate: 8_000_000 }));
  for (const bad of [NaN, Infinity, -1, 0, 31_000_000]) assert(!validLimit({ width: 1920, height: 1080, fps: 30, bitrate: bad }));
  assert(!validLimit({ ...PRESETS.auto })); // UI labels are not permitted on the wire.
  assert(!validLimit({ width: 1080, height: 1920, fps: 30, bitrate: 6_000_000 }));
});

test('audio guard pauses quickly, restores slowly, and unknown/silent stats never cause escalation', () => {
  const guard = new AudioGuard();
  for (const at of [0, 1000, 2000]) guard.observe({ packets: 50, loss: .12 }, at, false);
  assert.equal(guard.paused, true);
  for (let at = 3000; at < 23_000; at += 1000) guard.observe({ packets: 50, loss: 0 }, at, true);
  assert.equal(guard.paused, true);
  guard.observe({ packets: 50, loss: 0 }, 23_000, true);
  assert.equal(guard.paused, false); assert.equal(guard.level, 0);
  guard.observe({ packets: 50, loss: 0 }, 24_000, true); assert.equal(guard.level, 0);
  const unknown = new AudioGuard();
  for (let at = 0; at < 120_000; at += 1000) unknown.observe({ packets: 0 }, at, true);
  assert.equal(unknown.level, 3); assert.equal(unknown.paused, false);
});

test('moderate loss reduces pixels before video pause; RTT alone does not cause reduction', () => {
  const guard = new AudioGuard();
  for (const at of [0, 1000, 2000]) guard.observe({ packets: 50, loss: .04 }, at);
  assert.equal(guard.level, 2); assert.equal(guard.paused, false);
  const rtt = new AudioGuard();
  for (let at = 0; at < 10_000; at += 1000) rtt.observe({ packets: 50, loss: 0, rtt: .8 }, at);
  assert.equal(rtt.level, 3);
  const delay = new AudioGuard();
  for (let at = 0; at < 10_000; at += 1000) delay.observe({ packets: 50, loss: 0, concealment: 0, jitterDelay: .2 }, at);
  assert.equal(delay.level, 3); // A stable high-latency route alone is not congestion.
});

test('spaced RTCP feedback permits cautious recovery; long gaps prevent it', () => {
  const guard = new AudioGuard();
  for (let at = 0; at <= 21_000; at += 1000) guard.observe(at % 3000 === 0 ? { packets: 50, loss: 0 } : undefined, at, true);
  assert.equal(guard.level, 4);
  const stale = new AudioGuard();
  stale.observe({ packets: 50, loss: 0 }, 0, true);
  stale.observe(undefined, 30_000, true);
  stale.observe({ packets: 50, loss: 0 }, 31_000, true);
  assert.equal(stale.level, 3);
});

test('stats use interval counters, correct units, and treat reset or stale feedback as unknown', () => {
  const reader = new StatsReader();
  const reports = (at: number, n: number, lost: number) => new Map([
    ['video', { id: 'video', timestamp: at, type: 'outbound-rtp', kind: 'video', bytesSent: n * 1000, packetsSent: n, frameWidth: 640, frameHeight: 360, framesEncoded: n }],
    ['audio', { id: 'audio', timestamp: at, type: 'inbound-rtp', kind: 'audio', packetsReceived: n, packetsLost: lost, totalSamplesReceived: n * 480, concealedSamples: n * 24, jitterBufferEmittedCount: n * 480, jitterBufferDelay: n * 48 }],
  ]);
  reader.read(reports(1000, 100, 0));
  const next = reader.read(reports(2000, 150, 5));
  assert.equal(next.sent.bitrate, 400_000); assert.equal(next.sent.fps, 50);
  assert.equal(next.incomingAudio?.loss, 5 / 55); assert.equal(next.incomingAudio?.concealment, .05); assert.equal(next.incomingAudio?.jitterDelay, .1);
  assert.equal(reader.read(reports(2000, 150, 5)).sent.bitrate, undefined);
  const reset = reader.read(reports(3000, 5, 0)); assert.equal(reset.sent.bitrate, undefined); assert.equal(reset.incomingAudio?.loss, undefined);
  const correction = reader.read(reports(4000, 55, -1)); assert.equal(correction.incomingAudio?.loss, 0);
});

function cameraFixture() {
  const tracks: Track[] = [];
  const track = (): Track => ({ id: `camera-${tracks.length}`, kind: 'video', enabled: true, readyState: 'live', stop() { this.readyState = 'ended'; }, getSettings: () => ({ width: 1280, height: 720, frameRate: 24 }), applyConstraints: async () => {} });
  tracks.push(track());
  const stream: Stream = { getVideoTracks: () => tracks, getTracks: () => tracks, addTrack: t => { tracks.push(t); }, removeTrack: t => { tracks.splice(tracks.indexOf(t), 1); } };
  let parameters = { encodings: [{ active: true, maxBitrate: 3_000_000, maxFramerate: 24, scaleResolutionDownBy: 1 }] };
  const transceiver: Transceiver = { direction: 'sendrecv', currentDirection: 'sendrecv', receiver: { track: { ...track(), kind: 'video' } }, sender: {
    track: tracks[0], getParameters: () => structuredClone(parameters), setParameters: async p => { parameters = p as typeof parameters; },
    async replaceTrack(t) { this.track = t; },
  } };
  const driver = new VideoDriver({ getTransceivers: () => [transceiver] }, stream, async () => {
    const t = track(); return { getVideoTracks: () => [t], getTracks: () => [t], addTrack() {}, removeTrack() {} };
  }, () => {});
  return { driver, transceiver, stream };
}

test('manual two-way audio-only releases capture; remote video requests never enable a camera', async t => {
  const f = cameraFixture(), messages: ClientMessage[] = [];
  const quality = new MediaQuality(() => {}, m => messages.push(m)); t.after(() => quality.dispose());
  quality.configure(f.driver, { protocolVersion: 2 });
  await quality.handle({ type: 'peer-capabilities', version: 2 });
  quality.setAudioOnly(true); await quality.apply();
  assert.equal(f.stream.getVideoTracks().length, 0); assert.equal(f.transceiver.sender.track, null);
  await quality.handle({ type: 'media-policy', revision: 1, receive: PRESETS.saver, audioOnly: true, pauseIncoming: false });
  quality.setAudioOnly(false); await quality.apply();
  quality.setCamera(true); await quality.apply();
  assert.equal(f.transceiver.sender.track, null); // Peer still requires audio-only.
  await quality.handle({ type: 'media-policy', revision: 2, receive: PRESETS.saver, audioOnly: false, pauseIncoming: false });
  quality.setCamera(false); await quality.apply();
  await quality.handle({ type: 'request-video' });
  assert.equal(quality.state.cameraIntent, false); assert.equal(f.transceiver.sender.track, null);
  quality.setCamera(true); await quality.apply();
  assert(f.transceiver.sender.track); assert.equal(f.transceiver.sender.getParameters().encodings[0].maxBitrate, 450_000);
  const count = messages.length;
  await quality.handle({ type: 'media-policy', revision: 1, receive: PRESETS.ultra, audioOnly: false, pauseIncoming: false });
  assert.equal(messages.length, count); // Stale update cannot relax the active restriction.
});

test('silent native replaceTrack failure is reported as unconfirmed instead of claiming audio-only', async t => {
  const f = cameraFixture(); f.transceiver.sender.replaceTrack = async () => {};
  const quality = new MediaQuality(() => {}, () => {}); t.after(() => quality.dispose());
  quality.configure(f.driver, { protocolVersion: 2 });
  quality.setAudioOnly(true); await quality.apply();
  assert.equal(quality.state.applied?.supported, false); assert.equal(quality.state.applied?.paused, false);
});

test('acknowledgments clear pending state without an acknowledgment loop', async t => {
  const f = cameraFixture(), sent: ClientMessage[] = [];
  const quality = new MediaQuality(() => {}, m => sent.push(m)); t.after(() => quality.dispose());
  quality.configure(f.driver, { protocolVersion: 2 }); await quality.handle({ type: 'peer-capabilities', version: 2 });
  await quality.handle({ type: 'media-policy', revision: 1, receive: PRESETS.auto, audioOnly: false, pauseIncoming: false });
  const revision = sent.filter(m => m.type === 'media-policy').at(-1)!.revision;
  const count = sent.length;
  await quality.handle({ type: 'policy-applied', revision, applied: PRESETS.hd, supported: true, videoPaused: false });
  assert.equal(sent.length, count); assert(!quality.state.status.includes('pending'));
});

test('a low startup bandwidth estimate alone does not permanently suppress healthy video', async t => {
  const f = cameraFixture();
  const quality = new MediaQuality(() => {}, () => {}); t.after(() => quality.dispose());
  quality.configure(f.driver, {}); await quality.apply();
  quality.sample({ sent: { bytes: 0, packets: 0 }, received: { bytes: 0, packets: 0 }, availableBitrate: 300_000, relay: false, path: 'test', receivedBytes: 0, audioReceivedBytes: 1000, audioSentBytes: 1000, cpu: false }, 1000);
  await quality.apply();
  assert.equal(quality.state.applied?.paused, false); assert(f.transceiver.sender.track);
});

test('automatic video pause can probe again after stable audio even when the bandwidth estimate vanished', async t => {
  const f = cameraFixture(), quality = new MediaQuality(() => {}, () => {}); t.after(() => quality.dispose());
  quality.configure(f.driver, {}); await quality.apply();
  const sample = (loss: number) => ({ sent: { bytes: 1000, packets: 10 }, received: { bytes: 1000, packets: 10 }, outgoingAudio: { packets: 50, loss }, incomingAudio: { packets: 50, loss }, relay: false, path: 'test', receivedBytes: 1000, audioReceivedBytes: 1000, audioSentBytes: 1000, cpu: false });
  for (const at of [0, 1000, 2000]) { quality.sample(sample(.12), at); await quality.apply(); }
  assert.equal(quality.state.applied?.paused, true); assert.equal(quality.state.cameraIntent, true);
  for (let at = 3000; at <= 23_000; at += 1000) { quality.sample(sample(0), at); await quality.apply(); }
  assert.equal(quality.state.applied?.paused, false); assert(f.transceiver.sender.track);
});

test('optional native degradation hint failure retries with the native null omission sentinel', async () => {
  const f = cameraFixture(), sender = f.transceiver.sender;
  const get = sender.getParameters.bind(sender), set = sender.setParameters.bind(sender);
  sender.getParameters = () => ({ ...get(), degradationPreference: null, toJSON() {
    if (this.degradationPreference === undefined) throw new Error('Native serializer cannot convert undefined');
    return { encodings: this.encodings, ...(this.degradationPreference !== null ? { degradationPreference: this.degradationPreference } : {}) };
  } });
  sender.setParameters = async p => {
    const value = JSON.parse(JSON.stringify(p));
    if (value.degradationPreference) throw new Error('Unsupported hint');
    await set(value);
  };
  const result = await f.driver.apply(PRESETS.hd, false, true, false);
  assert.equal(result.supported, true); assert.equal(result.paused, false); f.driver.dispose();
});

test('unsupported mandatory sender limits stop video while leaving audio/connection ownership with the caller', async () => {
  const f = cameraFixture();
  f.transceiver.sender.setParameters = async () => { throw new Error('Unsupported limits'); };
  const result = await f.driver.apply(PRESETS.saver, false, true, false);
  assert.equal(result.supported, false); assert.equal(result.paused, true); assert.equal(f.transceiver.sender.track, null);
  f.driver.dispose();
});

test('changing only outgoing 1080p High FPS from 60 to 30 updates the sender and preserves the incoming ceiling', async t => {
  const f = cameraFixture(), quality = new MediaQuality(() => {}, () => {}); t.after(() => quality.dispose());
  quality.configure(f.driver, {}); quality.setPreset('high'); await quality.apply();
  // Allow stable feedback to lift the conservative startup guard to High.
  for (let at = 0; at <= 30_000; at += 1000) {
    quality.sample({
      sent: { bytes: 1000, packets: 10, bitrate: 2_000_000 }, received: { bytes: 1000, packets: 10, bitrate: 2_000_000 },
      outgoingAudio: { packets: 50, loss: 0 }, incomingAudio: { packets: 50, loss: 0 }, availableBitrate: 100_000_000,
      relay: false, path: 'synthetic', receivedBytes: 1000, audioReceivedBytes: 1000, audioSentBytes: 1000, cpu: false,
    }, at);
    await quality.apply();
  }
  assert.equal(f.transceiver.sender.getParameters().encodings[0].maxFramerate, 60);
  quality.setLimits({ ...quality.state.send, fps: 30 }, quality.state.receive); await quality.apply();
  assert.equal(quality.state.send.height, 1080); assert.equal(quality.state.send.fps, 30);
  assert.equal(quality.state.receive.fps, 60); assert.equal(quality.state.custom, true);
  assert.equal(f.transceiver.sender.getParameters().encodings[0].maxFramerate, 30);
});
