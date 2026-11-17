import { ConnectedClock, resolveInvitation, PendingIce } from '../src/call/core';
import { MediaQuality, initialQuality, type QualityState } from '../src/call/media-quality';
import { StatsReader, type Reports } from '../src/call/stats';
import { constraints, VideoDriver, type MediaPeer, type Stream } from '../src/call/video';
import { intersect, START_LIMIT, type Preset, type VideoLimit } from '../src/call/quality';
import { VideoDiagnosticsReader, type VideoDiagnostics } from './video-diagnostics';
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
  expiresAt?: number;
  quality: QualityState;
  videoDiagnostics?: VideoDiagnostics;
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
  quality: initialQuality(),
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
  private statsReader = new StatsReader();
  private videoReader = new VideoDiagnosticsReader();
  private videoHistory: ({ seconds: number; path: string } & VideoDiagnostics)[] = [];
  private quality = this.makeQuality();
  private makeQuality(initial = initialQuality()) {
    return new MediaQuality(quality => this.update({ quality, camera: quality.applied?.camera ?? this.state.camera }), m => this.send(m, this.epoch), initial);
  }
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
    const preferences = this.quality.state;
    this.quality.dispose();
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
    this.quality = this.makeQuality(preferences);
    this.update({ quality: this.quality.state });
  }
  async join(code: string, video: boolean, relay: boolean) {
    const preferences = this.quality.state;
    this.end();
    const epoch = this.epoch;
    this.clock = new ConnectedClock();
    this.ice = new PendingIce();
    this.statsPending = false;
    this.statsReader = new StatsReader();
    this.videoReader = new VideoDiagnosticsReader();
    this.videoHistory = [];
    this.state = empty();
    this.quality = this.makeQuality({ ...preferences, cameraIntent: video && !preferences.audioOnly });
    this.update({ quality: this.quality.state, phase: 'joining' });
    let invite: Awaited<ReturnType<typeof resolveInvitation>>;
    try {
      invite = await resolveInvitation(location.origin, code);
    } catch (error) {
      if (epoch === this.epoch) this.update({ phase: 'error', error: (error as Error).message });
      return;
    }
    if (epoch !== this.epoch) return;
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
        video: video && !preferences.audioOnly
          ? {
              facingMode: 'user',
              ...constraints(intersect(START_LIMIT, preferences.send)),
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
    this.update({ local: stream, camera: Boolean(stream.getVideoTracks().length), phase: 'joining' });
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
            if (epoch !== this.epoch) return;
            const message = JSON.parse(String(event.data)) as ServerMessage;
            try { await this.handle(message, epoch, relay); }
            catch (error) {
              const changingVideo = message.type === 'negotiate' || ((message.type === 'offer' || message.type === 'answer') && message.negotiationId !== undefined);
              if (!changingVideo) throw error;
              this.quality.warn('Video negotiation could not complete. Audio can continue; use a new room if video cannot resume.');
            }
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
    if (['peer-capabilities', 'media-policy', 'policy-applied', 'request-video'].includes(message.type)) {
      await this.quality.handle(message as Parameters<MediaQuality['handle']>[0]); return;
    }
    if (message.type === 'quality-warning') { this.quality.warn(message.message); return; }
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
      // Only the offerer reserves an empty video m-line. A camera-less answerer
      // must adopt the offered transceiver, avoiding an extra unmatched sender.
      if (!this.state.camera && message.initiator)
        peer.addTransceiver('video', { direction: 'recvonly' });
      this.quality.configure(new VideoDriver(peer as unknown as MediaPeer, this.state.local! as unknown as Stream,
        async limit => await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', ...constraints(limit) } }) as unknown as Stream,
        () => this.update({ local: this.state.local })), message);
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
        expiresAt: message.expiresAt,
        path: relay
          ? 'Relay requested · waiting for media'
          : 'Waiting for media',
      });
      return;
    }
    const peer = this.peer;
    if (!peer) throw new Error('Missing connection');
    if (message.type === 'negotiate') {
      const offer = await peer.createOffer();
      if (epoch !== this.epoch) return;
      await peer.setLocalDescription(offer);
      this.send({ type: 'offer', description: { type: 'offer', sdp: offer.sdp! }, negotiationId: message.negotiationId }, epoch);
    } else if (message.type === 'ready') {
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
          { type: 'answer', description: { type: 'answer', sdp: answer.sdp! }, ...(message.negotiationId ? { negotiationId: message.negotiationId } : {}) },
          epoch,
        );
      }
      await this.quality.handledDescription();
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
    this.quality.setCamera(!this.state.quality.cameraIntent);
  }
  setQuality(preset: Preset) { this.quality.setPreset(preset); }
  setLimits(send: VideoLimit, receive: VideoLimit) { this.quality.setLimits(send, receive); }
  toggleAudioOnly() { this.quality.setAudioOnly(!this.state.quality.audioOnly); }
  videoDiagnosticsText() {
    return JSON.stringify({
      version: 1, capturedAt: new Date().toISOString(),
      perspective: 'Desktop/browser: sent goes to phone; received comes from phone',
      sendCeiling: this.state.quality.send, receiveCeiling: this.state.quality.receive,
      samples: this.videoHistory,
    }, null, 2);
  }
  async refreshStats() {
    if (!this.peer || this.statsPending) return;
    const epoch = this.epoch,
      peer = this.peer;
    this.statsPending = true;
    try {
      const reports = await peer.getStats();
      if (epoch !== this.epoch) return;
      const stats = this.statsReader.read(reports as unknown as Reports);
      const videoDiagnostics = this.videoReader.read(reports as unknown as Reports);
      this.videoHistory.push({ seconds: this.clock.seconds(), path: stats.path, ...videoDiagnostics });
      this.videoHistory = this.videoHistory.slice(-30);
      this.quality.sample(stats, performance.now());
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
        videoDiagnostics,
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
