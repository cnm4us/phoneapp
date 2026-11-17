// Isolated, real UDP impairment test. sudo is used ONLY for a disposable netns/veth.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createTcpServer, connect as connectTcp } from 'node:net';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createSignaling } from '../server/server';

const exec = promisify(execFile);
async function main() {
const sudo = (...args: string[]) => exec('sudo', ['-n', ...args]);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const suffix = String(process.pid).slice(-6);
const ns = `phoneapp-q-${suffix}`, hostIf = `pq${suffix}h`, clientIf = `pq${suffix}c`;
const octet = 10 + Number(suffix) % 200;
const host = `198.18.${octet}.1`, client = `198.18.${octet}.2`;
const base = `http://${host}:8791`;
const directory = await mkdtemp(join(tmpdir(), 'phoneapp-quality-'));
let created = false, browser: Browser | undefined, turn: ChildProcess | undefined, chrome: ChildProcess | undefined, proxy: ChildProcess | undefined;
let bridge: ReturnType<typeof createTcpServer> | undefined;
let service: ReturnType<typeof createSignaling> | undefined;
const outcomes: Record<string, unknown>[] = [];
const log = (value: Record<string, unknown>) => { outcomes.push(value); console.log(JSON.stringify(value)); };
const shape = async (rate: string, delay: string, loss: string) => {
  await sudo('tc', 'qdisc', 'replace', 'dev', hostIf, 'root', 'netem', 'limit', '60', 'rate', rate, 'delay', delay, 'loss', loss);
  await sudo('ip', 'netns', 'exec', ns, 'tc', 'qdisc', 'replace', 'dev', clientIf, 'root', 'netem', 'limit', '60', 'rate', rate, 'delay', delay, 'loss', loss);
};
const snapshot = async (page: Page) => page.evaluate(() => {
  const q = document.querySelector<HTMLElement>('#quality-status')!;
  const video = document.querySelector<HTMLVideoElement>('#remote')!;
  return {
    status: q.textContent, phase: document.body.dataset.state,
    videoSent: Number(q.dataset.videoSentBytes), videoReceived: Number(q.dataset.videoReceivedBytes),
    audioReceived: Number(q.dataset.audioReceivedBytes), height: video.videoHeight,
    sent: document.querySelector('#sent-quality')!.textContent,
    received: document.querySelector('#received-quality')!.textContent,
    incomingAudio: document.querySelector('#incoming-audio-quality')?.textContent,
    outgoingAudio: document.querySelector('#outgoing-audio-quality')?.textContent,
  };
});
const poll = async (check: () => Promise<boolean>, message: string, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await wait(200); }
  throw new Error(message);
};
try {
  const user = (await exec('id', ['-un'])).stdout.trim();
  assert(user !== 'root', 'Run as the project user with passwordless sudo, not as root');
  const routes = (await exec('ip', ['route', 'show', `198.18.${octet}.0/30`])).stdout;
  assert(!routes.trim(), 'Disposable test subnet is already in use');
  await sudo('ip', 'netns', 'add', ns); created = true;
  await sudo('ip', 'link', 'add', hostIf, 'type', 'veth', 'peer', 'name', clientIf);
  await sudo('ip', 'link', 'set', clientIf, 'netns', ns);
  await sudo('ip', 'addr', 'add', `${host}/30`, 'dev', hostIf);
  await sudo('ip', 'link', 'set', hostIf, 'up');
  await sudo('ip', 'netns', 'exec', ns, 'ip', 'addr', 'add', `${client}/30`, 'dev', clientIf);
  await sudo('ip', 'netns', 'exec', ns, 'ip', 'link', 'set', clientIf, 'up');
  await sudo('ip', 'netns', 'exec', ns, 'ip', 'link', 'set', 'lo', 'up');
  // No default route, NAT, or primary-interface changes: only the test host is reachable.
  const secret = randomBytes(24).toString('hex');
  const conf = join(directory, 'turn.conf');
  await writeFile(conf, `listening-ip=${host}\nrelay-ip=${host}\nlistening-port=3479\nmin-port=49300\nmax-port=49315\nrealm=phoneapp-quality-test\nuse-auth-secret\nstatic-auth-secret=${secret}\nno-cli\nno-tls\nno-dtls\nno-tcp-relay\nmax-bps=5000000\nbps-capacity=20000000\nuser-quota=8\ntotal-quota=16\npidfile=${directory}/turn.pid\nlog-file=${directory}/turn.log\n`, { mode: 0o600 });
  turn = spawn('turnserver', ['-c', conf], { stdio: 'ignore' });
  const key = randomBytes(24).toString('hex');
  service = createSignaling({ accessKey: key, turnSecret: secret, turnUrls: [`turn:${host}:3479?transport=udp`], relayVideoMaxBitrate: 30_000_000, ultraEnabled: true, webRoot: resolve('web/dist') });
  await new Promise<void>(resolve => service!.http.listen(8791, host, resolve));
  await shape('40mbit', '10ms', '0%');
  chrome = spawn('sudo', ['-n', 'ip', 'netns', 'exec', ns, 'runuser', '-u', user, '--', chromium.executablePath(),
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-background-timer-throttling',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--remote-debugging-port=9223',
    `--user-data-dir=${directory}/profile`, `--unsafely-treat-insecure-origin-as-secure=${base}`], { stdio: 'ignore' });
  // Keep the automation channel outside the shaped link. A private Unix socket
  // crosses the namespace boundary; no public debugging listener is exposed.
  const socketPath = join(directory, 'cdp.sock');
  proxy = spawn('sudo', ['-n', 'ip', 'netns', 'exec', ns, 'runuser', '-u', user, '--', 'socat', `UNIX-LISTEN:${socketPath},fork,mode=600`, 'TCP:127.0.0.1:9223'], { stdio: 'ignore' });
  bridge = createTcpServer(socket => { const other = connectTcp(socketPath); socket.pipe(other); other.pipe(socket); other.on('error', () => socket.destroy()); socket.on('error', () => other.destroy()); });
  await new Promise<void>(resolve => bridge!.listen(0, '127.0.0.1', resolve));
  const address = bridge.address(); assert(address && typeof address === 'object');
  const debug = `http://127.0.0.1:${address.port}`;
  await poll(async () => { try { return (await fetch(`${debug}/json/version`)).ok; } catch { return false; } }, 'Chromium namespace launch failed');
  browser = await chromium.connectOverCDP(debug);
  log({ event: 'isolated-test-services-ready' });
  const pages: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const page = await context.newPage();
    page.on('pageerror', error => log({ event: 'browser-error', message: error.message }));
    for (let attempt = 0; ; attempt++) {
      try { await page.goto(base); break; }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Error) || !error.message.includes('ERR_NETWORK_CHANGED')) throw error;
        await wait(500); // Chromium's new namespace network service can still be initializing.
      }
    }
    await page.locator('#send-limit').filter({ hasText: '1080p' }).waitFor();
    await page.locator('.diagnostics > summary').click(); await page.locator('#relay').check(); pages.push(page);
  }
  const [a, b] = pages;
  // Creator UI is covered by the browser suite; this harness isolates RTP.
  const response = await fetch(`${base}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
  assert.equal(response.status, 201);
  const invite = await response.json() as { roomId: string; token: string };
  const code = `${invite.roomId}.${invite.token}`;
  await a.locator('#invitation').fill(code); await b.locator('#invitation').fill(code);
  await a.locator('#join').click(); await poll(async () => await a.locator('body').getAttribute('data-state') === 'waiting', 'First peer did not join');
  await b.locator('#join').click();
  await poll(async () => (await snapshot(a)).videoReceived > 1000 && (await snapshot(b)).videoReceived > 1000, 'No initial video over isolated TURN');
  for (const page of pages) assert.match((await page.locator('#path').textContent())!, /relay → relay/);
  const phase = async (name: string, seconds: number) => {
    log({ phase: name, event: 'started', seconds });
    const start = await snapshot(a);
    for (let elapsed = 0; elapsed < seconds; elapsed += 5) {
      await wait(5_000);
      log({ phase: name, elapsed: elapsed + 5, media: await snapshot(a) });
    }
    const end = await snapshot(a);
    assert.equal(end.phase, 'connected', `${name}: call ended`);
    assert(end.audioReceived > start.audioReceived, `${name}: audio packets stopped`);
    return { start, end };
  };
  await phase('strong-40Mbps', 25);
  await shape('500kbit', '60ms', '2%');
  await phase('constrained-500kbps-2pct-loss', 25);
  await shape('150kbit', '100ms', '5%');
  const severe = await phase('severe-150kbps-5pct-loss', 20);
  log({ phase: 'severe', adaptationObserved: /protect|reduced|Audio only/i.test(severe.end.status ?? '') });
  await shape('40mbit', '10ms', '0%');
  const recovery = await phase('recovered-40Mbps', 45);
  assert(recovery.end.videoReceived > recovery.start.videoReceived + 1000, 'Video did not recover after stable audio and restored bandwidth');
  const qdisc = await sudo('tc', '-s', 'qdisc', 'show', 'dev', hostIf);
  log({ verification: 'isolated UDP traffic was shaped', qdisc: qdisc.stdout.trim() });
  await a.locator('#hangup').click();
  await mkdir('artifacts/private', { recursive: true });
  await writeFile('artifacts/private/quality-network.json', JSON.stringify(outcomes, null, 2));
  log({ result: 'passed', scope: 'Real synthetic RTP over isolated TURN; packet continuity and observed adaptation, not perceptual speech or physical hardware acceptance' });
} finally {
  await browser?.close();
  chrome?.kill('SIGTERM'); proxy?.kill('SIGTERM'); bridge?.close();
  if (service) await service.close();
  if (turn) { turn.kill('SIGTERM'); await Promise.race([new Promise(resolve => turn!.once('exit', resolve)), wait(3000)]); if (turn.exitCode === null) turn.kill('SIGKILL'); }
  if (created) {
    const pids = (await sudo('ip', 'netns', 'pids', ns)).stdout.trim().split(/\s+/).filter(v => /^\d+$/.test(v));
    if (pids.length) await sudo('kill', '-TERM', '--', ...pids).catch(() => {});
    await wait(300);
    const remaining = (await sudo('ip', 'netns', 'pids', ns)).stdout.trim().split(/\s+/).filter(v => /^\d+$/.test(v));
    if (remaining.length) await sudo('kill', '-KILL', '--', ...remaining).catch(() => {});
    await sudo('ip', 'link', 'delete', hostIf).catch(() => {});
    await sudo('ip', 'netns', 'delete', ns).catch(() => {});
  }
  await rm(directory, { recursive: true, force: true });
}
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Quality network test failed'); process.exitCode = 1; });
