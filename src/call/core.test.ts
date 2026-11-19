import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectedClock, endpoint, invitation, PendingIce, displayInvitation, roomTimeLeft } from './core';

test('connected time excludes setup, pauses on network loss, and resumes without double counting', () => {
  let time = 0;
  const clock = new ConnectedClock(() => time);
  time = 30_000;
  assert.equal(clock.seconds(), 0);
  clock.connected(true);
  time += 3_400;
  clock.connected(true);
  assert.equal(clock.seconds(), 3);
  clock.connected(false);
  time += 100_000;
  assert.equal(clock.seconds(), 3);
  clock.connected(true);
  time += 1_600;
  clock.connected(false);
  assert.equal(clock.seconds(), 5);
});

test('remote ICE waits for remote description and flushes in order', async () => {
  const queue = new PendingIce<number>();
  const applied: number[] = [];
  const apply = async (n: number) => { applied.push(n); };
  await queue.add(1, apply); await queue.add(2, apply);
  assert.deepEqual(applied, []);
  await queue.remoteReady(apply);
  await queue.add(3, apply);
  assert.deepEqual(applied, [1, 2, 3]);
});

test('unbounded early ICE is rejected', async () => {
  const queue = new PendingIce<number>();
  for (let n = 0; n < 256; n++) await queue.add(n, async () => {});
  await assert.rejects(queue.add(257, async () => {}), /Too many/);
});

test('endpoint prevents embedded credentials, insecure remote URLs, and ambiguous paths', () => {
  assert.equal(endpoint(' https://phoneapp.bawebtech.com/ '), 'https://phoneapp.bawebtech.com');
  assert.equal(endpoint('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  for (const invalid of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/foo', 'https://example.com/?token=secret', 'https://example.com/#foo', 'ws://example.com']) assert.throws(() => endpoint(invalid));
});

test('invitation parser requires the complete capability and accepts surrounding whitespace', () => {
  const roomId = 'a'.repeat(12), token = 'b'.repeat(32);
  assert.deepEqual(invitation(` ${roomId}.${token}\n`), { roomId, token });
  for (const invalid of [roomId, token, `${roomId}.${token}.extra`, '']) assert.throws(() => invitation(invalid));
});

test('test room codes accept eight digits with a readable separator and preserve leading zeroes', () => {
  for (const value of ['01234567', '0123 4567', '0123-4567', ' 0123 4567\n']) assert.deepEqual(invitation(value), { code: '01234567' });
  for (const value of ['123456', '123456789', 'abcd 1234', '1234.5678', '1234  5678']) assert.throws(() => invitation(value));
  const legacy = { roomId: 'a'.repeat(12), token: 'b'.repeat(32) };
  assert.equal(displayInvitation({ ...legacy, code: '01234567' }), '0123 4567');
  assert.equal(displayInvitation(legacy), `${legacy.roomId}.${legacy.token}`);
});

test('room lifetime is separate from connected time and clearly reaches expiry', () => {
  const now = 1_000_000;
  assert.equal(roomTimeLeft(now + 4 * 60 * 60_000, now), '4h 0m remaining');
  assert.equal(roomTimeLeft(now + 61_000, now), '2m remaining');
  assert.equal(roomTimeLeft(now, now), 'Expired');
  assert.equal(roomTimeLeft(undefined, now), 'Not joined');
});
