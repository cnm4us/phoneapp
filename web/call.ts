import { ConnectedClock, invitation, PendingIce } from '../src/call/core';
import type {
  Candidate,
  ClientMessage,
  ServerMessage,
} from '../shared/protocol';

export type State = {
  phase:
    | 'idle'
    | 'permissions'
    | 'joining'
    | 'waiting'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'ended'
    | 'error';
  local: MediaStream | null;
  remote: MediaStream | null;
  seconds: number;
  muted: boolean;
  camera: boolean;
  error: string;
  sessionId: string;
  path: string;
  receivedBytes: number;
};
const empty = (): State => ({
  phase: 'idle',
  local: null,
  remote: null,
  seconds: 0,
  muted: false,
  camera: false,
  error: '',
  sessionId: '',
  path: 'Not connected',
  receivedBytes: 0,
});

export class BrowserCall {
  state = empty();
  private epoch = 0;
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private clock = new ConnectedClock();
  private ice = new PendingIce<Candidate>();
  private tick?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private connectDeadline?: ReturnType<typeof setTimeout>;
  private initiator = false;
  private statsPending = false;
  constructor(private changed: (state: State) => void) {}
  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private send(message: ClientMessage, epoch: number) {
    if (epoch !== this.epoch) return;
    if (this.socket?.readyState !== WebSocket.OPEN)
      throw new Error(
        'The connection to the server closed. Create a fresh invitation.',
      );
    this.socket.send(JSON.stringify(message));
  }
  end(error = '') {
    this.epoch++;
    clearInterval(this.tick);
    clearTimeout(this.deadline);
    clearTimeout(this.connectDeadline);
    this.clock.connected(false);
    const socket = this.socket;
    this.socket = undefined;
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: 'leave' }));
    socket?.close();
    const peer = this.peer;
    this.peer = undefined;
    peer?.close();
    this.state.local?.getTracks().forEach((track) => track.stop());
    this.state.remote?.getTracks().forEach((track) => track.stop());
    this.update({
      local: null,
      remote: null,
      seconds: this.clock.seconds(),
      phase: error ? 'error' : 'ended',
      error,
    });
  }
  async join(code: string, video: boolean, relay: boolean) {
    this.end();
    const epoch = this.epoch;
    this.clock = new ConnectedClock();
    this.ice = new PendingIce();
    this.statsPending = false;
    this.state = empty();
    let invite: ReturnType<typeof invitation>;
    try {
      invite = invitation(code);
    } catch (error) {
      this.update({ phase: 'error', error: (error as Error).message });
      return;
    }
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.RTCPeerConnection
    ) {
      this.update({
        phase: 'error',
        error:
          'Open this page in a current browser using HTTPS to use your microphone and camera.',
      });
      return;
    }
    this.update({ phase: 'permissions' });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video
          ? {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : false,
      });
    } catch (error) {
      if (epoch !== this.epoch) return;
      const name = error instanceof DOMException ? error.name : '';
      const message =
        name === 'NotAllowedError'
          ? 'Microphone or camera access was denied. Allow access in this site’s browser settings, then try again. You can turn video off to use only the microphone.'
          : name === 'NotFoundError'
            ? 'No microphone or camera was found. Connect a microphone, or turn video off and try again.'
            : 'Could not open the microphone or camera. Close other apps using them and try again.';
      this.update({ phase: 'error', error: message });
      return;
    }
    if (epoch !== this.epoch) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.update({ local: stream, camera: video, phase: 'joining' });
    try {
      const socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/signal`,
      );
      this.socket = socket;
      this.deadline = setTimeout(() => {
        if (epoch === this.epoch)
          this.end(
            'The server did not respond. Check your connection and try again.',
          );
      }, 15_000);
      socket.onopen = () => {
        if (epoch === this.epoch) this.send({ type: 'join', ...invite }, epoch);
      };
      let queue = Promise.resolve();
      socket.onmessage = (event) => {
        queue = queue
          .then(async () => {
            if (epoch === this.epoch)
              await this.handle(
                JSON.parse(String(event.data)) as ServerMessage,
                epoch,
                relay,
              );
          })
          .catch(() => {
            if (epoch === this.epoch)
              this.end(
                'Could not establish the call. Create a new invitation and try again.',
              );
          });
      };
      socket.onerror = () => {
        if (epoch === this.epoch)
          this.end(
            'Cannot reach the call server. Check your connection and try again.',
          );
      };
      socket.onclose = () => {
        if (epoch === this.epoch)
          this.end(
            'The connection closed. Create a fresh invitation to try again.',
          );
      };
      this.tick = setInterval(() => {
        if (epoch !== this.epoch) return;
        this.update({ seconds: this.clock.seconds() });
        if (this.state.phase === 'connected') void this.refreshStats();
      }, 1_000);
    } catch {
      if (epoch === this.epoch)
        this.end(
          'Could not open a connection to the call server. Please try again.',
        );
    }
  }
  private async handle(message: ServerMessage, epoch: number, relay: boolean) {
    if (message.type === 'error') {
      this.end(message.message);
      return;
    }
    if (message.type === 'peer-left') {
      this.end();
      return;
    }
    if (message.type === 'joined') {
      clearTimeout(this.deadline);
      if (relay && !message.turnConfigured) {
        this.end('Relay-only testing needs a configured TURN server.');
        return;
      }
      this.initiator = message.initiator;
      const peer = new RTCPeerConnection({
        iceServers: message.iceServers,
        iceTransportPolicy: relay ? 'relay' : 'all',
        bundlePolicy: 'max-bundle',
      });
      this.peer = peer;
      this.state
        .local!.getTracks()
        .forEach((track) => peer.addTrack(track, this.state.local!));
      if (!this.state.camera)
        peer.addTransceiver('video', { direction: 'recvonly' });
      peer.onicecandidate = (event) => {
        if (epoch !== this.epoch || !event.candidate) return;
        const c = event.candidate;
        try {
          this.send(
            {
              type: 'ice',
              candidate: {
                candidate: c.candidate,
                sdpMid: c.sdpMid,
                sdpMLineIndex: c.sdpMLineIndex,
              },
            },
            epoch,
          );
        } catch {
          if (epoch === this.epoch)
            this.end(
              'The connection was interrupted. Create a new invitation.',
            );
        }
      };
      peer.ontrack = (event) => {
        if (epoch !== this.epoch) return;
        const remote =
          event.streams[0] ?? this.state.remote ?? new MediaStream();
        if (!remote.getTracks().some((track) => track.id === event.track.id))
          remote.addTrack(event.track);
        this.update({ remote });
      };
      peer.onconnectionstatechange = () => {
        if (epoch !== this.epoch) return;
        this.clock.connected(peer.connectionState === 'connected');
        if (peer.connectionState === 'connected') {
          clearTimeout(this.connectDeadline);
          this.update({ phase: 'connected' });
          void this.refreshStats();
        } else if (peer.connectionState === 'disconnected') {
          this.update({ phase: 'reconnecting' });
          clearTimeout(this.connectDeadline);
          this.connectDeadline = setTimeout(() => {
            if (epoch === this.epoch)
              this.end(
                'Your connection was interrupted. Reconnect and start a new room.',
              );
          }, 15_000);
        } else if (peer.connectionState === 'failed')
          this.end(
            'Media could not connect. Try another network or create a fresh invitation.',
          );
      };
      this.update({
        phase: 'waiting',
        sessionId: message.sessionId,
        path: relay
          ? 'Relay requested · waiting for media'
          : 'Waiting for media',
      });
      return;
    }
    const peer = this.peer;
    if (!peer) throw new Error('Missing connection');
    if (message.type === 'ready') {
      this.update({ phase: 'connecting' });
      this.connectDeadline = setTimeout(() => {
        if (epoch === this.epoch)
          this.end(
            'Media did not connect within 30 seconds. Create a new invitation and try another network.',
          );
      }, 30_000);
      if (this.initiator) {
        const offer = await peer.createOffer();
        if (epoch !== this.epoch) return;
        await peer.setLocalDescription(offer);
        this.send(
          { type: 'offer', description: { type: 'offer', sdp: offer.sdp! } },
          epoch,
        );
      }
    } else if (message.type === 'offer' || message.type === 'answer') {
      await peer.setRemoteDescription(message.description);
      if (epoch !== this.epoch) return;
      await this.ice.remoteReady((candidate) =>
        peer.addIceCandidate(candidate),
      );
      if (epoch !== this.epoch) return;
      if (message.type === 'offer') {
        const answer = await peer.createAnswer();
        if (epoch !== this.epoch) return;
        await peer.setLocalDescription(answer);
        this.send(
          { type: 'answer', description: { type: 'answer', sdp: answer.sdp! } },
          epoch,
        );
      }
    } else if (message.type === 'ice')
      await this.ice.add(message.candidate, (candidate) =>
        peer.addIceCandidate(candidate),
      );
  }
  mute() {
    const muted = !this.state.muted;
    this.state.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.update({ muted });
  }
  toggleCamera() {
    const camera = !this.state.camera;
    this.state.local?.getVideoTracks().forEach((track) => {
      track.enabled = camera;
    });
    this.update({ camera });
  }
  async refreshStats() {
    if (!this.peer || this.statsPending) return;
    const epoch = this.epoch,
      peer = this.peer;
    this.statsPending = true;
    try {
      const reports = await peer.getStats();
      if (epoch !== this.epoch) return;
      let pair: RTCStats | undefined,
        receivedBytes = 0;
      reports.forEach((report) => {
        if (report.type === 'transport' && report.selectedCandidatePairId)
          pair = reports.get(report.selectedCandidatePairId);
        if (report.type === 'inbound-rtp' && !report.isRemote)
          receivedBytes += report.bytesReceived ?? 0;
      });
      if (!pair)
        reports.forEach((report) => {
          if (
            report.type === 'candidate-pair' &&
            report.nominated &&
            report.state === 'succeeded'
          )
            pair = report;
        });
      const selected = pair as
        | (RTCStats & { localCandidateId: string; remoteCandidateId: string })
        | undefined;
      const local = selected
        ? reports.get(selected.localCandidateId)
        : undefined;
      const remote = selected
        ? reports.get(selected.remoteCandidateId)
        : undefined;
      this.update({
        receivedBytes,
        path: selected
          ? `${local?.candidateType ?? 'unknown'} → ${remote?.candidateType ?? 'unknown'} · ${local?.protocol ?? 'unknown'}`
          : 'Selected path not available yet',
      });
    } catch {
      /* Keep a working call alive if statistics are unavailable. */
    } finally {
      if (epoch === this.epoch) this.statsPending = false;
    }
  }
}
