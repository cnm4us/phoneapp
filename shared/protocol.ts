// Shared wire types; no native or server-only imports.
import type { VideoLimit } from '../src/call/quality';
export type Description = { type: 'offer' | 'answer'; sdp: string };
export type Candidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type QualityMessage =
  | { type: 'media-policy'; revision: number; receive: VideoLimit; audioOnly: boolean; pauseIncoming: boolean }
  | { type: 'policy-applied'; revision: number; applied: VideoLimit; videoPaused: boolean; supported: boolean }
  | { type: 'request-video' };
export type ClientMessage = QualityMessage
  | { type: 'capabilities'; version: 2 }
  | { type: 'renegotiate' }
  | { type: 'join'; roomId: string; token: string }
  | { type: 'offer'; description: Description; negotiationId?: number }
  | { type: 'answer'; description: Description; negotiationId?: number }
  | { type: 'ice'; candidate: Candidate }
  | { type: 'leave' };
export type ServerMessage = QualityMessage
  | { type: 'joined'; sessionId: string; initiator: boolean; iceServers: IceServer[]; expiresAt: number; turnConfigured: boolean; protocolVersion?: 2; relayVideoMaxBitrate?: number; ultraEnabled?: boolean }
  | { type: 'peer-capabilities'; version: 2 }
  | { type: 'negotiate'; negotiationId: number }
  | { type: 'quality-warning'; message: string }
  | { type: 'ready' }
  | { type: 'offer'; description: Description; negotiationId?: number }
  | { type: 'answer'; description: Description; negotiationId?: number }
  | { type: 'ice'; candidate: Candidate }
  | { type: 'peer-left' }
  | { type: 'error'; code: string; message: string };
export type Invitation = { roomId: string; token: string; expiresAt: number };
