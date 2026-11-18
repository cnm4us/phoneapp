import type { Invitation } from './protocol';
export type Account = { id: string; displayName: string; role: 'practitioner' | 'rn' | 'ma' | 'admin' | 'patient' | 'caregiver' };
export type Patient = { id: string; displayName: string; enrolled: boolean };
export type CallRecord = {
  id: string; patientId: string; patientName: string; callerName: string;
  direction: 'outgoing' | 'incoming'; state: string; createdAt: string;
  endedAt: string | null; observedSeconds: number; transcriptionStatus: 'off';
  canAnswer: boolean; ownsMedia: boolean;
};
export type Enrollment = { token: string; account: Account; expiresAt: string };
export type Dashboard = { account: Account; patients: Patient[]; calls: CallRecord[] };
export type CallAction = 'answer' | 'decline' | 'cancel' | 'end';
export const terminalCall = (state: string): boolean => ['ended', 'declined', 'missed', 'canceled', 'failed'].includes(state);
export type MediaInvitation = { invitation: Invitation };
