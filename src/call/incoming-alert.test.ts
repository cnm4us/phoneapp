import assert from 'node:assert/strict';
import test from 'node:test';
import { IncomingAlerts, type AlertPreferences, type IncomingAlertDriver } from './incoming-alert';

function fixture(preferences: AlertPreferences = { sound: true, vibration: true }) {
  let now = 0;
  const events: string[] = [];
  const driver: IncomingAlertDriver = {
    load: async () => preferences,
    save: async value => { events.push(`save:${value.sound}:${value.vibration}`); },
    ring: async (id, value, lease) => { events.push(`ring:${id}:${value.sound}:${value.vibration}:${lease}`); },
    silence: async id => { events.push(`stop:${id}`); },
  };
  const alerts = new IncomingAlerts(driver, () => now, false);
  const input = (callId: string | undefined, updatedAt = now) => ({ callId, updatedAt, foreground: true, mediaActive: false, busy: false });
  return { alerts, driver, events, input, clock: (value: number) => { now = value; } };
}
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('old binaries keep visual calling available without attempting an unsupported method', async () => {
  const alerts = new IncomingAlerts(undefined, () => 0, false);
  await alerts.initialized;
  alerts.observe({ callId: 'a', updatedAt: 0, foreground: true, mediaActive: false, busy: false });
  await alerts.silence();
  assert.equal(alerts.state.available, false);
  alerts.dispose();
});

test('fresh incoming polls renew one call; stale incoming data and cancellation stop its lease', async () => {
  const f = fixture(); await f.alerts.initialized;
  f.alerts.observe(f.input('a')); await f.alerts.flush();
  f.clock(2000); f.alerts.observe(f.input('a')); await f.alerts.flush();
  assert.deepEqual(f.events, ['ring:a:true:true:6000', 'ring:a:true:true:6000']);
  f.clock(8001); f.alerts.observe(f.input('a', 2000)); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'stop:a');
  f.clock(9000); f.alerts.observe(f.input('b')); await f.alerts.flush();
  f.alerts.observe(f.input(undefined)); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'stop:b');
  f.alerts.dispose();
});

test('answer while native start is pending stops it before media; old data cannot restart it', async () => {
  const f = fixture();
  let release!: () => void;
  f.driver.ring = async id => { f.events.push(`start:${id}`); await new Promise<void>(resolve => { release = resolve; }); };
  await f.alerts.initialized; f.alerts.observe(f.input('a')); await turn();
  const silence = f.alerts.silence();
  assert.deepEqual(f.events, ['start:a']);
  release(); await silence; f.events.push('media-start');
  f.alerts.observe(f.input('a')); await f.alerts.flush();
  assert.deepEqual(f.events, ['start:a', 'stop:a', 'media-start']);
  f.alerts.dispose();
});

test('a newer incoming call cannot be stopped by an older delayed start/stop', async () => {
  const f = fixture(); let release!: () => void;
  f.driver.ring = async id => { f.events.push(`start:${id}`); if (id === 'a') await new Promise<void>(resolve => { release = resolve; }); };
  await f.alerts.initialized; f.alerts.observe(f.input('a')); await turn();
  f.alerts.observe(f.input('b')); release(); await f.alerts.flush();
  assert.deepEqual(f.events, ['start:a', 'stop:a', 'start:b']);
  f.alerts.dispose(); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'stop:b');
});

test('background, media ownership and busy actions suppress sound independently of settings UI', async () => {
  const f = fixture(); await f.alerts.initialized;
  for (const blocker of [{ foreground: false }, { mediaActive: true }, { busy: true }]) {
    f.alerts.observe(f.input('a')); await f.alerts.flush();
    f.alerts.observe({ ...f.input('a'), ...blocker }); await f.alerts.flush();
    assert.equal(f.events.at(-1), 'stop:a');
  }
  f.alerts.dispose();
});

test('saved preferences configure vibration-only, all-off and later incoming calls', async () => {
  const f = fixture({ sound: false, vibration: true }); await f.alerts.initialized;
  f.alerts.observe(f.input('a')); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'ring:a:false:true:6000');
  await f.alerts.setPreferences({ sound: false, vibration: false }); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'stop:a');
  await f.alerts.setPreferences({ sound: true, vibration: false }); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'ring:a:true:false:6000');
  f.alerts.dispose();
});

test('load failure never ignores saved sound choices; rejected stop blocks media handoff', async () => {
  const badLoad = fixture(); badLoad.alerts.dispose();
  const driver = { ...badLoad.driver, load: async () => { throw new Error('load failed'); } };
  const unloaded = new IncomingAlerts(driver, () => 0, false);
  await unloaded.initialized;
  unloaded.observe(badLoad.input('a')); await unloaded.flush();
  assert.equal(unloaded.state.ready, false); assert.deepEqual(badLoad.events, []); unloaded.dispose();
  const f = fixture(); f.driver.silence = async () => { throw new Error('stop failed'); };
  await f.alerts.initialized; f.alerts.observe(f.input('a')); await f.alerts.flush();
  await assert.rejects(f.alerts.silence(), /still stopping/);
  assert.match(f.alerts.state.error, /could not update/);
  f.alerts.dispose();
});


test('returning to foreground requires a fresh poll before an old incoming call can ring again', async () => {
  const f = fixture(); await f.alerts.initialized;
  f.alerts.observe(f.input('a')); await f.alerts.flush();
  f.clock(1000); f.alerts.observe({ ...f.input('a', 0), foreground: false }); await f.alerts.flush();
  f.clock(2000); f.alerts.observe(f.input('a', 0)); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'stop:a');
  f.clock(2100); f.alerts.observe(f.input('a')); await f.alerts.flush();
  assert.equal(f.events.at(-1), 'ring:a:true:true:6000');
  f.alerts.dispose();
});
