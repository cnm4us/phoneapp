export function endpoint(input: string): string {
  const url = new URL(input.trim());
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter an HTTPS server address with no path, credentials, or query.');
  }
  return url.origin;
}

type LongInvitation = { roomId: string; token: string };
export function invitation(input: string): LongInvitation | { code: string } {
  const short = /^(\d{4})[ -]?(\d{4})$/.exec(input.trim());
  if (short) return { code: short[1] + short[2] };
  const match = /^([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{32})$/.exec(input.trim());
  if (!match) throw new Error('Enter the eight-digit room code or paste a shared invitation.');
  return { roomId: match[1], token: match[2] };
}

export function displayInvitation(value: { code?: string; roomId: string; token: string }) {
  return value.code && /^\d{8}$/.test(value.code) ? `${value.code.slice(0, 4)} ${value.code.slice(4)}` : `${value.roomId}.${value.token}`;
}

export async function resolveInvitation(base: string, input: string): Promise<LongInvitation> {
  const parsed = invitation(input);
  if (!('code' in parsed)) return parsed;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(`${base}/rooms/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed), signal: controller.signal,
    });
  } finally { clearTimeout(deadline); }
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many room-code attempts. Wait a minute and try again.');
    throw new Error('Room code is invalid, expired, or the call has ended. Create a new room.');
  }
  const value = await response.json() as { roomId?: unknown; token?: unknown };
  if (typeof value.roomId !== 'string' || typeof value.token !== 'string') throw new Error('Invalid invitation response');
  const result = invitation(`${value.roomId}.${value.token}`);
  if ('code' in result) throw new Error('Invalid invitation response');
  return result;
}

export function roomTimeLeft(expiresAt: number | undefined, now = Date.now()) {
  if (!expiresAt) return 'Not joined';
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  if (!minutes) return 'Expired';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining` : `${minutes}m remaining`;
}

// Monotonic connected time: pause on disconnection, never count setup time.
export class ConnectedClock {
  private accumulated = 0;
  private started: number | undefined;
  constructor(private now: () => number = () => performance.now()) {}
  connected(active: boolean) {
    if (active && this.started === undefined) this.started = this.now();
    if (!active && this.started !== undefined) {
      this.accumulated += Math.max(0, this.now() - this.started);
      this.started = undefined;
    }
  }
  seconds() { return Math.floor((this.accumulated + (this.started === undefined ? 0 : Math.max(0, this.now() - this.started))) / 1000); }
}

// Remote ICE can arrive before setRemoteDescription has finished.
export class PendingIce<T> {
  private pending: T[] = [];
  private ready = false;
  async add(value: T, apply: (v: T) => Promise<unknown>) {
    if (this.ready) await apply(value);
    else {
      if (this.pending.length >= 256) throw new Error('Too many pending connection candidates');
      this.pending.push(value);
    }
  }
  async remoteReady(apply: (v: T) => Promise<unknown>) {
    for (const value of this.pending) await apply(value);
    this.pending = [];
    this.ready = true;
  }
}
