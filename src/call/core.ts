export function endpoint(input: string): string {
  const url = new URL(input.trim());
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter an HTTPS server address with no path, credentials, or query.');
  }
  return url.origin;
}

export function invitation(input: string): { roomId: string; token: string } {
  const match = /^([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{32})$/.exec(input.trim());
  if (!match) throw new Error('Paste the complete invitation shared by the other phone.');
  return { roomId: match[1], token: match[2] };
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
