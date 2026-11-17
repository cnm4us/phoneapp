import { mediaDevices, MediaStream, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import type { Candidate, ClientMessage, ServerMessage } from '../../shared/protocol';
import { ConnectedClock, endpoint, invitation, PendingIce } from './core';

export type CallState = {
  phase: 'idle' | 'permissions' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';
  local: MediaStream | null;
  remote: MediaStream | null;
  seconds: number;
  muted: boolean;
  cameraEnabled: boolean;
  hasCamera: boolean;
  error?: string;
  sessionId?: string;
  diagnostics: string[];
};
const initial = (): CallState => ({ phase: 'idle', local: null, remote: null, seconds: 0, muted: false, cameraEnabled: false, hasCamera: false, diagnostics: [] });

export class CallSession {
  state = initial();
  private subscribers = new Set<(state: CallState) => void>();
  private epoch = 0;
  private socket?: WebSocket;
  private pc?: RTCPeerConnection;
  private clock = new ConnectedClock();
  private ice = new PendingIce<Candidate>();
  private tick?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private connectionDeadline?: ReturnType<typeof setTimeout>;
  private initiator = false;
  subscribe(listener: (state: CallState) => void) {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  }
  private update(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.subscribers) listener(this.state);
  }
  private diagnostic(event: string) {
    this.update({ diagnostics: [...this.state.diagnostics.slice(-9), `${new Date().toISOString().slice(11, 19)} ${event}`] });
  }
  private cleanup() {
    this.epoch++;
    clearInterval(this.tick);
    clearTimeout(this.deadline);
    clearTimeout(this.connectionDeadline);
    this.clock.connected(false);
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
    socket?.close();
    const pc = this.pc;
    this.pc = undefined;
    pc?.close();
    this.state.local?.getTracks().forEach((track) => track.stop());
    this.state.remote?.getTracks().forEach((track) => track.stop());
    this.update({ local: null, remote: null, seconds: this.clock.seconds(), hasCamera: false });
  }
  end(message?: string) {
    this.cleanup();
    this.update({ phase: message ? 'error' : 'ended', error: message });
  }
  private send(message: ClientMessage, epoch: number) {
    if (epoch !== this.epoch) return;
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Signaling connection is not open. Start a new room.');
    this.socket.send(JSON.stringify(message));
  }
  async join(base: string, code: string, video: boolean, relay: boolean) {
    this.cleanup();
    const epoch = this.epoch;
    this.clock = new ConnectedClock();
    this.ice = new PendingIce();
    this.state = initial();
    this.update({ phase: 'permissions' });
    try {
      const origin = endpoint(base);
      const invite = invitation(code);
      const stream = await mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false });
      if (epoch !== this.epoch) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.update({ local: stream, hasCamera: video, cameraEnabled: video, phase: 'joining' });
      const socket = new WebSocket(`${origin.replace(/^http/, 'ws')}/signal`);
      this.socket = socket;
      this.deadline = setTimeout(() => { if (epoch === this.epoch) this.end('The signaling server did not respond. Check its address and try a new room.'); }, 15_000);
      socket.onopen = () => { if (epoch === this.epoch) this.send({ type: 'join', ...invite }, epoch); };
      // Serialize async SDP operations so candidates cannot race a remote description.
      let messages = Promise.resolve();
      socket.onmessage = (event) => {
        messages = messages.then(async () => {
          if (epoch !== this.epoch) return;
          const message = JSON.parse(String(event.data)) as ServerMessage;
          await this.handle(message, epoch, relay);
        }).catch(() => { if (epoch === this.epoch) this.end('Call setup failed. Check permissions and the server, then create a new room.'); });
      };
      socket.onerror = () => { if (epoch === this.epoch) this.end('Cannot reach the signaling server. Check its HTTPS address and network.'); };
      socket.onclose = () => { if (epoch === this.epoch) this.end('The signaling connection closed. Create a new room to retry.'); };
      this.tick = setInterval(() => { if (epoch === this.epoch) this.update({ seconds: this.clock.seconds() }); }, 500);
    } catch {
      if (epoch === this.epoch) this.end('Could not start the call. Check the invitation, server address, and microphone/camera permissions in Settings.');
    }
  }
  private async handle(message: ServerMessage, epoch: number, relay: boolean) {
    if (message.type === 'error') { this.end(message.message); return; }
    if (message.type === 'peer-left') { this.end(); return; }
    if (message.type === 'joined') {
      clearTimeout(this.deadline);
      if (relay && !message.turnConfigured) { this.end('Relay-only testing needs a configured TURN server.'); return; }
      this.initiator = message.initiator;
      const pc = new RTCPeerConnection({ iceServers: message.iceServers, iceTransportPolicy: relay ? 'relay' : 'all', bundlePolicy: 'max-bundle' });
      this.pc = pc;
      this.state.local!.getTracks().forEach((track) => pc.addTrack(track, this.state.local!));
      if (!this.state.hasCamera) pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addEventListener('icecandidate', (event) => {
        if (epoch !== this.epoch || !event.candidate) return;
        const c = event.candidate;
        try {
          this.send({ type: 'ice', candidate: { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } }, epoch);
        } catch { if (epoch === this.epoch) this.end('Signaling was interrupted. Create a new room.'); }
      });
      pc.addEventListener('track', (event) => {
        if (epoch !== this.epoch || !event.track) return;
        const track = event.track;
        const remote = event.streams[0] ?? this.state.remote ?? new MediaStream();
        if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
        this.update({ remote });
      });
      pc.addEventListener('connectionstatechange', () => {
        if (epoch !== this.epoch) return;
        this.diagnostic(`connection: ${pc.connectionState}`);
        this.clock.connected(pc.connectionState === 'connected');
        if (pc.connectionState === 'connected') {
          clearTimeout(this.connectionDeadline);
          this.update({ phase: 'connected' });
          void this.candidateSummary(pc, epoch);
        } else if (pc.connectionState === 'disconnected') {
          this.update({ phase: 'reconnecting' });
          clearTimeout(this.connectionDeadline);
          this.connectionDeadline = setTimeout(() => { if (epoch === this.epoch) this.end('Network connection was lost. Reconnect and start a new room.'); }, 15_000);
        } else if (pc.connectionState === 'failed') this.end('Media connection failed. Check TURN configuration or try another network.');
      });
      this.update({ phase: 'waiting', sessionId: message.sessionId });
      this.diagnostic(`joined; ${message.turnConfigured ? 'TURN configured' : 'STUN only'}${relay ? '; relay forced' : ''}`);
      return;
    }
    const pc = this.pc;
    if (!pc) throw new Error('Missing peer connection');
    if (message.type === 'ready') {
      this.update({ phase: 'connecting' });
      this.connectionDeadline = setTimeout(() => { if (epoch === this.epoch) this.end('Media did not connect within 30 seconds. Check TURN and try a new room.'); }, 30_000);
      if (this.initiator) {
        const offer = await pc.createOffer({});
        if (epoch !== this.epoch) return;
        await pc.setLocalDescription(offer);
        this.send({ type: 'offer', description: { type: 'offer', sdp: offer.sdp! } }, epoch);
      }
    } else if (message.type === 'offer' || message.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(message.description));
      if (epoch !== this.epoch) return;
      await this.ice.remoteReady((candidate) => pc.addIceCandidate(new RTCIceCandidate(candidate)));
      if (epoch !== this.epoch) return;
      if (message.type === 'offer') {
        const answer = await pc.createAnswer();
        if (epoch !== this.epoch) return;
        await pc.setLocalDescription(answer);
        this.send({ type: 'answer', description: { type: 'answer', sdp: answer.sdp! } }, epoch);
      }
    } else if (message.type === 'ice') {
      await this.ice.add(message.candidate, (candidate) => pc.addIceCandidate(new RTCIceCandidate(candidate)));
    }
  }
  private async candidateSummary(pc: RTCPeerConnection, epoch: number) {
    try {
      const reports = await pc.getStats();
      if (epoch !== this.epoch) return;
      // Only candidate types/protocol are surfaced; never IPs, SDP, or credentials.
      let pair: Record<string, unknown> | undefined;
      reports.forEach((report: Record<string, unknown>) => {
        if (report.type === 'transport' && typeof report.selectedCandidatePairId === 'string') pair = reports.get(report.selectedCandidatePairId);
      });
      if (!pair) reports.forEach((report: Record<string, unknown>) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) pair = report;
      });
      if (pair) {
        const local = reports.get(String(pair.localCandidateId));
        const remote = reports.get(String(pair.remoteCandidateId));
        this.diagnostic(`path: ${local?.candidateType ?? 'unknown'} → ${remote?.candidateType ?? 'unknown'} (${local?.protocol ?? 'unknown'})`);
      } else this.diagnostic('selected media path not available yet');
    } catch { if (epoch === this.epoch) this.diagnostic('candidate statistics unavailable'); }
  }
  mute() {
    const muted = !this.state.muted;
    this.state.local?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    this.update({ muted });
  }
  toggleCamera() {
    const enabled = !this.state.cameraEnabled;
    this.state.local?.getVideoTracks().forEach((track) => { track.enabled = enabled; });
    this.update({ cameraEnabled: enabled });
  }
  switchCamera() { this.state.local?.getVideoTracks().forEach((track) => track._switchCamera()); }
  refreshDiagnostics() { if (this.pc) void this.candidateSummary(this.pc, this.epoch); }
}
