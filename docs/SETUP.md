# WebRTC proof of concept setup

This experiment connects two native development builds in the foreground. Use test conversations only. Public signaling and authenticated TURN UDP/TCP/TLS probes pass; the physical-phone matrix remains unrun.

## Installed components

| Component | Location / endpoint |
| --- | --- |
| Native app | Repository root; `App.tsx`, `src/call/`, `app.config.ts` |
| Browser companion | `https://phoneapp.bawebtech.com/`; source `web/`, compiled allowlisted assets `web/dist` |
| Signaling | `https://phoneapp.bawebtech.com`; WebSocket path `/signal`; health `/health` |
| Signaling process | `phoneapp-signaling.service`, bound to `127.0.0.1:8787` |
| TURN | `phoneapp.bawebtech.com:3478` UDP/TCP; `:5349` TLS/TCP; UDP relay ports 49160-49200 |
| TURN process | `phoneapp-turn.service`; `/etc/phoneapp/turnserver.conf` |
| TLS | Let's Encrypt certificate for the dedicated hostname; nginx config `/etc/nginx/sites-available/phoneapp.bawebtech.com` |
| EAS project | [@mbcollins2/phoneapp](https://expo.dev/accounts/mbcollins2/projects/phoneapp), UUID `942392a3-1d9c-4d2c-91b0-0ad939e4e1fd` |

These ports and paths are specific to this EC2 deployment. Templates under `deploy/` contain this host's addresses and Node path; adapt them before deploying elsewhere. Other nginx sites were not edited. The stock coturn service was disabled after installation; only the project-specific TURN unit is used.

## Credentials and configuration

Private `.env.server` contains `POC_ACCESS_KEY` and `TURN_SECRET`. It is ignored by Git and EAS uploads and has mode 600. Use VS Code Remote SSH to open that file locally when you need the creator key; do not paste it into public documents or chat. The test key is entered on the phone creating an invitation and is kept in memory. The second phone only needs the invitation.

`TURN_SECRET` must match the rendered coturn config under `/etc/phoneapp/`. It is never embedded in the app. Authenticated room members receive HMAC credentials valid for the bounded room lifetime. Invitations and active rooms now default to four hours (`ROOM_TTL_MINUTES=240`, maximum 480); leaving ends the room, so create a fresh invitation for another call.

On a fresh checkout, `npm ci` installs pinned app/test dependencies. `npm run init:local` generates a new ignored `.env.server` only if absent; creating that file does not deploy TURN, obtain a certificate, or change firewall rules. Do not run it expecting to rotate an existing deployment's secret. Template configuration files are `.env.example` and `.env.server.example` at the repository root.

Before starting the signaling server, run `npm run build:web`. The server reads only the built HTML/JS/CSS allowlist into memory; it never serves arbitrary repository files. Rebuild and restart signaling after browser source changes.

## Network setup

DNS resolves to this host at `54.183.144.33`. HTTPS/WSS on 443 works. Inbound TURN rules requested from the owner are:

| Protocol | Ports | Source for the experiment |
| --- | --- | --- |
| TCP | 3478, 5349 | IPv4 internet, so both phones can connect from arbitrary networks |
| UDP | 3478, 49160-49200 | IPv4 internet |

The EC2 role `EC2MediaConvertSubmitter` cannot describe/manage EC2 security groups; no AWS security-group changes were made by the agent. The owner confirmed these rules were added; subsequent public UDP/TCP/TLS probes each received 10/10 test packets. The health response's `turnConfigured: true` means credentials/URLs are set, not that media has been verified on a phone.

Run the real-device forced-relay scenario after installing both apps. This server has no TLS TURN listener on 443, which nginx already uses; networks that allow only outbound 443 may require a later dedicated relay/proxy strategy.

## EAS builds and iPhone registration

EAS CLI 27.10.0 is installed globally on this host, and `eas whoami` verified the owner account. The app is linked and uses IDs `com.bawebtech.phoneapp.poc` on both platforms. The Android keystore was created and is managed by EAS. No signing material was downloaded into Git.

The Android development build finished successfully: [build 2cf8e5a8](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c). That upload used the working-tree implementation before the final documentation commit; the development client loads subsequent JavaScript from Metro.

The owner's [iOS build 0e5beca1](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/0e5beca1-cdcd-4d69-9c85-90f26667e21d) also finished successfully; owner reports the native screen is visible. The signing/config instructions below document setup/rebuilds, not a remaining blocker for that installed build.

EAS reported that the account is over its included build credits and charges further builds at pay-as-you-go rates. The owner explicitly approved pay-as-you-go for the iPhone build on 2026-11-16; that build no longer needs spending confirmation. Keep unrelated paid builds outside this authorization.

For the iPhone, noninteractive submission stopped before upload because EAS had no suitable internal-distribution signing credentials. The owner was asked to run `npm run build:ios` in the EC2 project terminal and complete Apple login, team selection, and device/signing prompts. If a separate enrollment step is needed, run `eas device:create` and follow its link on the intended iPhone. Enable iOS Developer Mode. Registering another device or using an unrelated provisioning profile does not prove this iPhone is included.

The current privately tested POC uses standard TLS/WebRTC cryptography and sets `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` explicitly. EAS cannot automatically edit this dynamic config; that stop has been fixed in the file. WebRTC includes third-party cryptography, so re-evaluate declarations for public distribution or new encryption features using [Apple's guidance](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption). The Node experimental TypeScript warning is informational.

Once registration/signing is ready:

```sh
npm run build:ios
```

For an authorized Android rebuild, use `npm run build:android`. The `development` profile generates a custom dev client; the `preview` profile can later produce a bundled internal-test app without Metro. Both are cloud builds and can incur charges. This app does not run in Expo Go.

## Run on the two phones

1. On Android, open the [APK download](https://expo.dev/artifacts/eas/6Pq6rQTGIxbz6mLmAU4c7IMMM_7ZKOds5ttHuUxUzHM.apk) in Chrome, open the downloaded file, allow that source to install if Android asks, and install **Phoneapp POC**. The existing [Android development build](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c) was rechecked as FINISHED/INTERNAL/development. No new build is needed for current JS changes. The owner's iPhone development build is already installed.
2. From the EC2 project, run `npm run start:tunnel` if Metro is not already running. The local `@expo/ngrok` dependency is installed. Only run one Metro process on port 8081. Check its terminal for the current development-client QR/link.
3. Open **Phoneapp POC**, then open the current development server in its launcher. If it is not listed, choose **Enter URL manually** and paste the current HTTPS Expo tunnel address, or scan the development-client QR. The tunnel serves current app JavaScript; signaling/media use their own endpoints. The phone needs the custom installed app rather than Expo Go.
4. On the creator phone, open **Settings**, leave the signaling address as `https://phoneapp.bawebtech.com`, and enter the private test access key. Tap **Done**, then **Create invitation**. The guest needs only the room code.
5. Tap **Share room code** before joining. Enter the eight digits on the second phone. Sharing after joining may background the foreground-only call and end it. Leave any existing browser call first; rooms allow two participants.
6. Select **Send video when joining** in Settings or audio-only independently on each phone. Tap **Join call** on both, grant microphone/camera access, and keep both apps in the foreground.
7. Try mute, camera controls, and hangup. Create a new invitation for the next session. For relay testing, enable **Force TURN relay for testing** in Settings before joining; in-call Settings contains **Refresh connection details** and quality controls.
8. Execute the full [M1 matrix](plans/0001-webrtc-poc.md) and save a sanitized report from [the template](testing/DEVICE_REPORT_TEMPLATE.md). Do not treat connected timer seconds as approved billing time.

## Call your iPhone from a browser

Create an invitation to receive an eight-digit testing room code, displayed as `1234 5678`. Enter the same digits on both devices; spaces or a hyphen between groups are accepted. Pasted older invitations still work. Only the creator needs the private test access key. The short code grants access to the synthetic test room; keep it private.

New rooms last up to four hours from creation. `ROOM_TTL_MINUTES` defaults to 240 and is bounded at 480. **Room lifetime** is separate from connected time. Departure, connection loss, foreground restrictions, or restart can end a call earlier. Departure ends the room; refresh both clients and create a new code after deployment.

1. Open `https://phoneapp.bawebtech.com` in Chrome/Edge on your computer or Safari on the iPad. The browser companion does not need Expo, Metro, EAS installation, or iPad device registration.
2. Create an invitation on either the native app or browser. The creator needs `POC_ACCESS_KEY` from the private `.env.server` file; the other participant only needs the invitation.
3. Use **Copy code** in the browser and paste that exact code in the native app's invitation field. Alternatively, paste a native-created invitation into the browser's **I have an invitation** tab. A **Copy browser link** option creates a link for another browser, not a native-app deep link. Its fragment is removed when the page loads, and you still tap Join yourself.
4. Choose whether to send video and tap **Join call** on both devices. Allow camera/microphone access. Keep the native app and browser in the foreground. Use headphones when devices are near each other to prevent feedback.
5. If Safari blocks playback, use **Tap to play call audio / video** in the call panel. This fallback is tested with an injected browser policy block; real Safari/iPad behavior still needs your confirmation.
6. **Connection details** contains the optional forced-TURN setting (set before joining), candidate types, and received bytes. Ending a call closes the room; create a fresh invitation for another call. No conversation is recorded or stored.

The quality iteration negotiates additive capabilities after the original join, preserving existing-client compatibility. Its JavaScript controls use the installed native module. Reload the browser and the Expo development app from the running Metro session to try them; no new native build was submitted. Automated browser-to-browser results remain separate from physical native/Safari evidence.

## Adjust call quality

Native calls now use the available safe-area screen by default, with mute/camera/hangup overlaid. Tap the upper-right **⚙ Settings** button for quality, display/camera controls, room lifetime, and diagnostics. **Done** closes the panel; Android back also dismisses it. **Fill screen** on crops edges; off shows the whole video with possible black bars. **Show self preview** changes only local display, not outgoing camera capture. The remote renderer stays mounted while the in-window settings panel opens. This replaces the old native Full screen/Exit full screen buttons; browser full-screen controls are unchanged. See [plan 0005](plans/0005-native-call-settings.md) for the device acceptance still needed.

Before joining, Settings also contains the server address, creator access key, Send video when joining, and Force TURN testing option. Create/share/join remains on the home screen. The Expo developer floating cogwheel is separate: the pinned iOS development build is asked to hide it through its existing optional preference bridge. Shake/three-finger access remains available. If it is still visible, open Expo tools and switch **Tools button** off manually. Android/release builds do not use this iOS-only bridge. No new EAS build is submitted for this layout; reload the existing development app between test calls.

Use **Call quality** in native Settings or the browser quality section before or during a call. Auto begins conservatively below a 1080p/30 ceiling; **High · 1080p/30** selects a sharper 30 fps option and **HD · 720p/30** selects a lower-bandwidth option. High retains an 8 Mbps video payload ceiling (6 Mbps on relay); HD uses 3 Mbps. Standard/Data saver/Minimum reduce video resolution and bitrate further. Presets set send/receive preferences together; **Advanced** separates them and retains its explicit frame-rate choices. Requested ceilings and actual output intentionally differ. Display size/fit is independent of quality.

**Send video** off joins without the local camera and can still receive video. **Audio only · both directions** is coordinated: either participant may retain it. After both leave this mode, choose **Camera on** locally to resume. A remote request never activates your camera. With an older client, remote controls are labeled unavailable and two-way suppression cannot be confirmed.

Audio-first adaptation reduces/pauses video when audio suffers and restores it gradually after sustained improvement. Network failure can still interrupt audio. Unsupported settings and negotiation failures are reported; use a new invitation if video cannot resume while audio remains usable.

Defaults: `RELAY_VIDEO_MAX_BITRATE=6000000` bits/s and `ENABLE_EXPERIMENTAL_ULTRA=false`. The live TURN quota is 1000000 bytes/s (8 Mbps) per allocation; the lower application cap leaves audio/transport headroom. Verify effective quotas/capacity before raising either limit. The 4K/60, 30 Mbps policy remains experimental and gated by server/device support; native capability enumeration is unavailable in the installed wrapper. [Plan 0003](plans/0003-adaptive-call-quality.md) lists remaining gates.

Run checks and `npm run build:web` before restarting only `phoneapp-signaling`. It loads assets into memory; current rooms end on restart. Keep protocol-2 server support while rolling back client features. No TURN restart is needed for UI/policy changes. The isolated `npm run test:quality-network` experiment is documented in [tools](TOOLS.md) and [quality evidence](testing/2026-11-17-adaptive-quality.md); never shape the host primary interface.

## Operate and diagnose the services

```sh
sudo systemctl status phoneapp-signaling phoneapp-turn --no-pager
curl --fail https://phoneapp.bawebtech.com/health
npm run smoke
python3 scripts/check-turn.py --transport udp
python3 scripts/check-turn.py --transport tcp
python3 scripts/check-turn.py --transport tls
```

Local transport isolation (Linux only): use `--host 172.31.10.226`; for TLS add `--server-name phoneapp.bawebtech.com`. A local pass does not verify public reachability. Raw coturn diagnostics remain in ignored `artifacts/private/` with mode 600; do not copy them into public reports without review. The relay checker returns success only when every packet in its small sample was received.

After authorized server code changes, run checks and then `sudo systemctl restart phoneapp-signaling`. The service reads this development checkout; changing branches/dependencies may affect it. For TURN config changes, update the matching private secret/config and restart `phoneapp-turn`. Test nginx with `sudo nginx -t` before reloading it.

Certbot renews the hostname's certificate. A dedicated deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/phoneapp-turn` copies only this certificate/key into `/etc/phoneapp/tls` with restricted permissions, validates/reloads nginx, and restarts this TURN unit. Do not modify renewal hooks for unrelated sites.

To stop this experiment, stop `phoneapp-signaling` and `phoneapp-turn`, and stop the Metro terminal. To disable the hostname, remove only its nginx symlink after preserving the config and validating nginx. Never reset other services or delete certificates used elsewhere.

For sustained native tests, keep app source unchanged during the call. React Native Fast Refresh can rerun screen cleanup and end the current development call; reload and create a fresh room after updates. This does not affect the four-hour room setting and is not a confirmed cause of the earlier disconnect.
