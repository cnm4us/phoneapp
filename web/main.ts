import { BrowserCall, type State } from './call';
import { invitation } from '../src/call/core';
import type { Invitation } from '../shared/protocol';

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const button = (id: string) => element<HTMLButtonElement>(id);
const code = element<HTMLTextAreaElement>('invitation');
const localVideo = element<HTMLVideoElement>('local');
const remoteVideo = element<HTMLVideoElement>('remote');
const notice = element('notice');
const error = element('error');
let creating = false;
let formError = '';
const labels: Record<State['phase'], string> = {
  idle: 'Ready to connect',
  permissions: 'Allow microphone / camera',
  joining: 'Joining room',
  waiting: 'Waiting for the other device',
  connecting: 'Connecting media',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  ended: 'Call ended',
  error: 'Unable to connect',
};
const active = () => !['idle', 'ended', 'error'].includes(call.state.phase);
const validInvite = () => {
  try {
    invitation(code.value);
    return true;
  } catch {
    return false;
  }
};

async function playRemote() {
  const stream = remoteVideo.srcObject;
  if (!stream) return;
  try {
    await remoteVideo.play();
    if (stream === remoteVideo.srcObject) button('play-audio').hidden = true;
  } catch {
    if (stream === remoteVideo.srcObject) button('play-audio').hidden = false;
  }
}
function render(state: State) {
  document.body.dataset.state = state.phase;
  element('status').textContent = labels[state.phase];
  element('elapsed').textContent =
    `${String(Math.floor(state.seconds / 60)).padStart(2, '0')}:${String(state.seconds % 60).padStart(2, '0')}`;
  const inCall = active();
  document.body.classList.toggle('in-call', inCall);
  element<HTMLFieldSetElement>('setup-fields').disabled = inCall || creating;
  button('create-tab').disabled = button('join-tab').disabled =
    inCall || creating;
  input('relay').disabled = inCall || creating;
  button('create').disabled =
    inCall || creating || input('access-key').value.trim().length < 24;
  button('create').textContent = creating
    ? 'Creating…'
    : 'Create invitation ↗';
  button('join').disabled = inCall || creating || !validInvite();
  button('copy-code').disabled = button('copy-link').disabled = !validInvite();
  button('hangup').disabled = !inCall;
  button('mute').disabled = !state.local;
  button('mute').setAttribute('aria-pressed', String(state.muted));
  button('mute').querySelector('span')!.textContent = state.muted
    ? 'Unmute'
    : 'Mute';
  button('camera').disabled = !state.local?.getVideoTracks().length;
  button('camera').setAttribute('aria-pressed', String(!state.camera));
  button('camera').querySelector('span')!.textContent = state.camera
    ? 'Camera off'
    : 'Camera on';
  button('refresh').disabled = !inCall;
  error.textContent = state.error || formError;
  error.hidden = !error.textContent;
  if (localVideo.srcObject !== state.local) {
    localVideo.srcObject = state.local;
    if (state.local) void localVideo.play().catch(() => {});
  }
  element('local-preview').hidden = !state.local || !state.camera;
  if (remoteVideo.srcObject !== state.remote) {
    remoteVideo.srcObject = state.remote;
    button('play-audio').hidden = true;
    if (state.remote) void playRemote();
  }
  const remoteVideoPresent = Boolean(state.remote?.getVideoTracks().length);
  remoteVideo.classList.toggle('audio-only', !remoteVideoPresent);
  element('stage-placeholder').hidden = remoteVideoPresent;
  element('stage-title').textContent =
    state.phase === 'connected'
      ? 'You’re connected.'
      : state.phase === 'waiting'
        ? 'Your room is ready.'
        : state.phase === 'ended'
          ? 'Until the next call.'
          : state.phase === 'connecting'
            ? 'Bringing you together…'
            : 'A place for the other side.';
  element('stage-description').textContent =
    state.phase === 'connected'
      ? 'Audio is live. Your camera is optional.'
      : state.phase === 'waiting'
        ? 'Join with the same invitation on your other device.'
        : state.phase === 'ended'
          ? 'Create a fresh invitation to call again.'
          : state.phase === 'connecting'
            ? 'Setting up your audio and video connection.'
            : 'Create or paste an invitation, then join on both devices.';
  element('session').textContent = state.sessionId || 'Not joined';
  element('path').textContent = state.path;
  element('received').textContent =
    `${state.receivedBytes.toLocaleString()} bytes`;
  element('received').dataset.bytes = String(state.receivedBytes);
}
const call = new BrowserCall(render);
function mode(create: boolean) {
  button('create-tab').setAttribute('aria-pressed', String(create));
  button('join-tab').setAttribute('aria-pressed', String(!create));
  element('creator-pane').hidden = !create;
}
button('create-tab').onclick = () => mode(true);
button('join-tab').onclick = () => mode(false);
input('access-key').oninput = code.oninput = () => {
  formError = '';
  notice.textContent = '';
  render(call.state);
};
button('create').onclick = async () => {
  creating = true;
  formError = '';
  notice.textContent = '';
  render(call.state);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${input('access-key').value.trim()}` },
      signal: controller.signal,
    });
    const value = (await response.json()) as Invitation & { error?: string };
    if (!response.ok)
      throw new Error(value.error || 'Could not create an invitation.');
    code.value = `${value.roomId}.${value.token}`;
    notice.textContent =
      'Invitation ready. Copy it into the iPhone app, then join on both devices.';
  } catch (err) {
    formError =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : err instanceof Error
          ? err.message
          : 'Could not create an invitation.';
  } finally {
    clearTimeout(deadline);
    creating = false;
    render(call.state);
  }
};
element<HTMLFormElement>('call-form').onsubmit = (event) => {
  event.preventDefault();
  formError = '';
  notice.textContent = '';
  void call.join(code.value, input('video').checked, input('relay').checked);
  if (matchMedia('(max-width: 740px)').matches)
    element('stage').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
};
async function copy(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    notice.textContent = message;
  } catch {
    code.focus();
    code.select();
    notice.textContent =
      'Automatic copying is unavailable. Select and copy the invitation code above.';
  }
}
button('copy-code').onclick = () => {
  void copy(code.value.trim(), 'Code copied. Paste it into the other device.');
};
button('copy-link').onclick = () => {
  void copy(
    `${location.origin}/#invite=${encodeURIComponent(code.value.trim())}`,
    'Browser link copied. Open it on another device to join here.',
  );
};
button('mute').onclick = () => call.mute();
button('camera').onclick = () => call.toggleCamera();
button('hangup').onclick = () => call.end();
button('play-audio').onclick = () => {
  void playRemote();
};
button('refresh').onclick = () => {
  void call.refreshStats();
};
window.addEventListener('pagehide', () => {
  if (active()) call.end();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active())
    call.end(
      'This experiment stays in the foreground. Return to the page and create a fresh invitation.',
    );
});

// Invitation capabilities stay out of HTTP logs/referrers and are removed from the address bar.
if (location.hash) {
  const value = new URLSearchParams(location.hash.slice(1)).get('invite');
  history.replaceState(null, '', location.pathname);
  if (value) {
    try {
      invitation(value);
      code.value = value;
      mode(false);
      notice.textContent =
        'Invitation loaded. Choose audio or video, then tap Join call.';
    } catch {
      formError =
        'This invitation link is incomplete. Ask for a fresh invitation.';
    }
  }
}
render(call.state);
