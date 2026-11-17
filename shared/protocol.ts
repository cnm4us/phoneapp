// Shared wire types; no native or server-only imports.
export type Description = { type: 'offer' | 'answer'; sdp: string };
export type Candidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type ClientMessage =
  | { type: 'join'; roomId: string; token: string }
  | { type: 'offer'; description: Description }
  | { type: 'answer'; description: Description }
  | { type: 'ice'; candidate: Candidate }
  | { type: 'leave' };
export type ServerMessage =
  | { type: 'joined'; sessionId: string; initiator: boolean; iceServers: IceServer[]; expiresAt: number; turnConfigured: boolean }
  | { type: 'ready' }
  | { type: 'offer'; description: Description }
  | { type: 'answer'; description: Description }
  | { type: 'ice'; candidate: Candidate }
  | { type: 'peer-left' }
  | { type: 'error'; code: string; message: string };
export type Invitation = { roomId: string; token: string; expiresAt: number };
