import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioRouting, audioSnapshot, type AudioSnapshot, type AudioPreference, type AudioDriver } from './audio-routing';

const snapshot = (preference: AudioPreference = 'automatic'): AudioSnapshot => ({ active: true, preference, route: preference === 'automatic' ? 'earpiece' : preference, choices: ['automatic', 'speaker', 'earpiece'] });
function fixture() {
  const calls: string[] = [];
  let listener: ((snapshot: unknown) => void) | undefined;
  let session = 0;
  const driver: AudioDriver = {
    start: async id => { session = id; calls.push('start'); return snapshot(); },
    setRoute: async preference => { calls.push(preference); return snapshot(preference); },
    stop: async () => { calls.push('stop'); },
    subscribe: callback => { listener = callback; return () => { listener = undefined; }; },
  };
  return { calls, driver, emit: (value: unknown) => listener?.({ session, ...(value as object) }), listener: () => listener };
}
test('old binaries leave routing unavailable while allowing call ownership to continue', async () => {
  const routing = new AudioRouting(undefined, () => {});
  routing.start(); await routing.settled();
  assert.equal(routing.state.available, false); assert.match(routing.state.error, /updated app/);
  routing.select('speaker'); routing.stop(); await routing.settled();
  assert.equal(routing.state.active, false);
});
test('speaker toggle uses actual output and returns to phone or automatic for connected accessories', async () => {
  const f = fixture(), routing = new AudioRouting(f.driver, () => {});
  routing.start(); await routing.settled();
  f.emit({ ...snapshot('speaker'), session: -1 }); assert.equal(routing.state.route, 'earpiece');
  routing.toggleSpeaker(); await routing.settled(); assert.equal(routing.state.route, 'speaker');
  routing.toggleSpeaker(); await routing.settled(); assert.equal(routing.state.route, 'earpiece');
  f.emit({ ...snapshot('speaker'), choices: ['automatic', 'speaker'] });
  routing.toggleSpeaker(); await routing.settled(); assert.equal(f.calls.at(-1), 'automatic');
  f.emit({ ...snapshot(), route: 'bluetooth', choices: ['automatic', 'speaker'] });
  assert.equal(routing.state.route, 'bluetooth');
  routing.select('earpiece'); await routing.settled(); assert.equal(f.calls.at(-1), 'automatic');
  routing.stop(); await routing.settled(); assert.equal(f.listener(), undefined);
});
test('hangup during native start releases routing before a new call and ignores late events/responses', async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.driver.start = () => { f.calls.push('start'); return new Promise(resolve => { finish = resolve; }); };
  const routing = new AudioRouting(f.driver, () => {});
  routing.start(); await Promise.resolve();
  const oldListener = f.listener()!;
  routing.stop(); routing.start();
  f.driver.start = async () => { f.calls.push('new-start'); return snapshot(); };
  finish(snapshot('speaker'));
  await routing.settled();
  assert.deepEqual(f.calls, ['start', 'stop', 'new-start']);
  oldListener(snapshot('speaker')); assert.equal(routing.state.route, 'earpiece');
  routing.stop(); await routing.settled();
});
test('a delayed selection cannot resurrect speaker UI after hangup', async () => {
  const f = fixture(), routing = new AudioRouting(f.driver, () => {});
  routing.start(); await routing.settled();
  let finish!: (value: unknown) => void;
  f.driver.setRoute = () => new Promise(resolve => { finish = resolve; });
  routing.select('speaker'); await Promise.resolve(); routing.stop();
  finish(snapshot('speaker')); await routing.settled();
  assert.equal(routing.state.active, false); assert.equal(routing.state.route, 'unknown');
  assert.equal(f.calls.at(-1), 'stop');
});
test('native rejection and malformed events cannot falsely confirm an output or break later commands', async () => {
  const f = fixture(), routing = new AudioRouting(f.driver, () => {});
  routing.start(); await routing.settled();
  f.emit({ ...snapshot('speaker'), choices: ['unsafe'] }); assert.equal(routing.state.route, 'earpiece');
  f.driver.setRoute = async () => { throw new Error('OS rejected request'); };
  routing.select('speaker'); await routing.settled();
  assert.equal(routing.state.active, true); assert.equal(routing.state.busy, false);
  assert.equal(routing.state.route, 'unknown'); assert.match(routing.state.error, /Could not confirm/);
  f.driver.setRoute = async () => snapshot();
  routing.select('automatic'); await routing.settled(); assert.equal(routing.state.error, '');
  routing.stop(); await routing.settled();
});
test('partial startup failure releases native resources; event subscription failures stay contained', async () => {
  const f = fixture(), routing = new AudioRouting(f.driver, () => {});
  f.driver.start = async () => { throw new Error('Start failed'); };
  routing.start(); await routing.settled();
  assert.equal(f.calls.at(-1), 'stop'); assert.equal(routing.state.active, false);
  routing.stop(); await routing.settled();
  f.driver.subscribe = () => { throw new Error('No emitter'); };
  const unavailable = new AudioRouting(f.driver, () => {});
  assert.doesNotThrow(() => unavailable.start());
  assert.equal(unavailable.state.busy, false); assert.equal(unavailable.state.active, false);
  unavailable.stop(); await unavailable.settled();
});
test('snapshot normalization removes unknown fields instead of exporting raw device metadata', () => {
  const clean = audioSnapshot({ ...snapshot(), deviceName: 'private', address: 'private', choices: ['speaker', 'speaker'] });
  assert(!JSON.stringify(clean).includes('private')); assert.deepEqual(clean.choices, ['speaker']);
});
