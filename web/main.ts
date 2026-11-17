import { BrowserCall, type State } from './call';
import { invitation, displayInvitation, roomTimeLeft } from '../src/call/core';
import type { Invitation } from '../shared/protocol';
import { PRESETS, type Preset, type VideoLimit } from '../src/call/quality';
import { describeAudio } from '../src/call/stats';
import { describeVideoDiagnostic } from './video-diagnostics';

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const button = (id: string) => element<HTMLButtonElement>(id);
const code = element<HTMLTextAreaElement>('invitation');
const localVideo = element<HTMLVideoElement>('local');
const remoteVideo = element<HTMLVideoElement>('remote');
const notice = element('notice');
const error = element('error');
const select = (id: string) => element<HTMLSelectElement>(id);
for (const [key, preset] of Object.entries(PRESETS)) {
  const option = new Option(preset.label, key); option.disabled = key === 'ultra'; select('quality').add(option);
}
const custom = new Option('Custom limits', 'custom'); custom.disabled = true; select('quality').add(custom);
for (const direction of ['send', 'receive']) {
  const group = document.createElement('fieldset');
  const legend = document.createElement('legend'); legend.textContent = direction === 'send' ? 'Outgoing limits' : 'Incoming limits'; group.append(legend);
  for (const [name, label] of [['resolution', 'Resolution'], ['fps', 'Frame rate'], ['bitrate', 'Video bitrate · Mbps']]) {
    const id = `${direction}-${name}`;
    const heading = document.createElement('label'); heading.htmlFor = id; heading.textContent = label; group.append(heading);
    if (name === 'bitrate') {
      const field = document.createElement('input'); field.type = 'number'; field.min = '0.15'; field.max = '30'; field.step = '0.05'; field.id = id; group.append(field);
    } else {
      const field = document.createElement('select'); field.id = id;
      if (name === 'fps') for (const fps of [15, 24, 30, 60]) field.add(new Option(`${fps} fps`, String(fps)));
      else for (const key of ['minimum', 'saver', 'standard', 'hd', 'high', 'ultra'] as const) field.add(new Option(`${PRESETS[key].height}p`, key));
      group.append(field);
    }
  }
  element('directional-limits').append(group);
}
let limitsDirty = false;
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
  element('room-time-left').textContent = roomTimeLeft(state.expiresAt);
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
  button('camera').disabled = !state.local || state.quality.audioOnly || state.quality.peerAudioOnly || state.quality.busy;
  button('camera').setAttribute('aria-pressed', String(!state.camera));
  button('camera').querySelector('span')!.textContent = state.quality.cameraIntent
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
  const remoteVideoPresent = Boolean(state.remote?.getVideoTracks().length) && !state.quality.audioOnly && !state.quality.peerAudioOnly;
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
  const q = state.quality;
  select('quality').value = q.custom ? 'custom' : q.preset;
  select('quality').querySelector<HTMLOptionElement>('option[value="ultra"]')!.disabled = !q.ultraAvailable;
  element('ultra-help').hidden = q.ultraAvailable;
  button('audio-only').setAttribute('aria-pressed', String(q.audioOnly));
  button('audio-only').textContent = q.audioOnly ? 'Leave audio-only mode' : 'Audio only · both directions';
  element('quality-status').textContent = q.status + (q.peerAudioOnly ? ' · other participant requests audio only' : '');
  element('quality-error').textContent = q.error; element('quality-error').hidden = !q.error;
  element('send-limit').textContent = q.sendDescription; element('receive-limit').textContent = q.receiveDescription;
  element('sent-quality').textContent = q.sent; element('received-quality').textContent = q.received;
  element('incoming-audio-quality').textContent = describeAudio(q.stats?.incomingAudio);
  element('outgoing-audio-quality').textContent = describeAudio(q.stats?.outgoingAudio);
  element('received-video-details').textContent = describeVideoDiagnostic(state.videoDiagnostics?.received);
  element('sent-video-details').textContent = describeVideoDiagnostic(state.videoDiagnostics?.sent, false);
  element('quality-status').dataset.peerSupported = String(q.peerSupported);
  element('quality-status').dataset.videoSentBytes = String(q.stats?.sent.bytes ?? 0);
  element('quality-status').dataset.videoReceivedBytes = String(q.stats?.received.bytes ?? 0);
  element('quality-status').dataset.audioReceivedBytes = String(q.stats?.audioReceivedBytes ?? 0);
  element('quality-status').dataset.audioSentBytes = String(q.stats?.audioSentBytes ?? 0);
  element('quality-status').dataset.appliedHeight = String(q.applied?.applied.height ?? 0);
  element('quality-status').dataset.appliedBitrate = String(q.applied?.applied.bitrate ?? 0);
  for (const direction of ['send', 'receive'] as const) {
    const value = q[direction];
    select(`${direction}-resolution`).querySelector<HTMLOptionElement>('option[value="ultra"]')!.disabled = !q.ultraAvailable;
    if (!limitsDirty) {
      const matching = (['minimum', 'saver', 'standard', 'hd', 'high', 'ultra'] as const).find(k => PRESETS[k].height === value.height) ?? 'high';
      select(`${direction}-resolution`).value = matching;
      select(`${direction}-fps`).value = String(value.fps);
      input(`${direction}-bitrate`).value = String(value.bitrate / 1_000_000);
    }
  }
}
const call = new BrowserCall(render);
button('copy-video-diagnostics').onclick = async () => {
  const output = element<HTMLTextAreaElement>('video-diagnostics-output');
  output.value = call.videoDiagnosticsText();
  output.hidden = false;
  try {
    await navigator.clipboard.writeText(output.value);
    element('video-diagnostics-notice').textContent = 'Last 30 measurements copied.';
  } catch {
    output.focus(); output.select();
    element('video-diagnostics-notice').textContent = 'Select and copy the measurements below.';
  }
};
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
    code.value = displayInvitation(value);
    notice.textContent =
      `Invitation ready. Enter this room code on the iPhone. ${roomTimeLeft(value.expiresAt)}.`;
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
select('quality').onchange = () => { limitsDirty = false; call.setQuality(select('quality').value as Preset); };
button('audio-only').onclick = () => call.toggleAudioOnly();
element('directional-limits').addEventListener('input', () => { limitsDirty = true; });
button('apply-limits').onclick = () => {
  const read = (direction: string): VideoLimit => {
    const resolution = PRESETS[select(`${direction}-resolution`).value as Preset];
    return { width: resolution.width, height: resolution.height, fps: Number(select(`${direction}-fps`).value), bitrate: Number(input(`${direction}-bitrate`).value) * 1_000_000 };
  };
  limitsDirty = false; call.setLimits(read('send'), read('receive'));
};
button('fullscreen').onclick = async () => {
  const stage = element('stage');
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  if (stage.classList.contains('expanded')) { stage.classList.remove('expanded'); button('fullscreen').textContent = 'Full screen'; return; }
  try { await stage.requestFullscreen(); }
  catch { stage.classList.add('expanded'); }
  button('fullscreen').textContent = 'Exit full screen';
};
document.addEventListener('fullscreenchange', () => { button('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
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
function loadInvitationLink() {
  if (!location.hash) return;
  const value = new URLSearchParams(location.hash.slice(1)).get('invite');
  history.replaceState(null, '', location.pathname);
  if (active()) { notice.textContent = 'Leave the current call before opening another invitation.'; return; }
  if (value) {
    try {
      invitation(value);
      code.value = value;
      formError = '';
      mode(false);
      notice.textContent =
        'Invitation loaded. Choose audio or video, then tap Join call.';
    } catch {
      formError =
        'This invitation link is incomplete. Ask for a fresh invitation.';
    }
  }
  render(call.state);
}
window.addEventListener('hashchange', loadInvitationLink);
loadInvitationLink();
render(call.state);
