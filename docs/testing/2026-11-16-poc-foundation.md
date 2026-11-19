# WebRTC foundation verification

Date: 2026-11-16 (client date). Plan: [0001](../plans/0001-webrtc-poc.md). Result: partial milestone; foundation verified, physical-phone acceptance not run.

## Dependency set

Expo 57.0.33, React Native 0.86.3, React 19.2.3, `react-native-webrtc` 155.0.1, config plugin 15.0.2, TypeScript 6.0.3. Exact dependencies are in `package.json`/`package-lock.json`. EAS CLI 27.10.0 is globally installed on EC2.

## Results

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | Pass | App and Node server/test compilation. |
| Unit/integration tests | 15/15 pass | Live local HTTP/WebSocket tests: authorization, exchange, third-peer rejection, expiry, malformed/spoofed/unjoined/oversized payloads, cleanup/isolation, TURN HMAC; pure clock/ICE/invite/URL tests. No native media claim. |
| Expo Doctor | 21/21 pass | Final SDK 57 set; SDK 56 Hermes warning resolved by selection change. |
| Native generation | Pass | `expo prebuild --no-install` generated both platforms; microphone/camera permissions and iOS scene manifest inspected. No Xcode/Gradle compile implied. |
| JavaScript/Hermes bundles | Pass | iOS/Android exported successfully; about 1.6 MB each. Outputs ignored. |
| Public HTTPS/WSS | Pass | Valid TLS at `phoneapp.bawebtech.com`; `npm run smoke` created a room, joined two WSS peers, exchanged synthetic offer/answer and hangup through nginx. No media. |
| Local TURN UDP/TCP | Pass | Authenticated client-to-client relay samples to private listener received 10/10 packets each. |
| Local TURN TLS | Pass on follow-up | Certificate hostname/chain checked. Initial sample received 9/10; checker tightened to require complete delivery and use slower packet interval; follow-up received 10/10. Small synthetic samples, not a quality guarantee. |
| Public TURN | Pass | Owner added security-group rules; authenticated UDP/TCP/TLS samples to the public hostname each received 10/10 packets. TLS hostname/chain verified. Host-origin probes do not replace external-phone testing. |
| Android native build | Finished successfully | [EAS build](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c). Working-tree upload; not a claim that the final commit was compiled. |
| iOS native build | Interactive setup pending | Owner approved pay-as-you-go and is completing Apple/device prompts. Dynamic-config encryption stop fixed by adding the flag to app.config.ts; no successful iOS native build verified yet. |
| Physical iPhone/Android | Not run | All device matrix outcomes remain unverified. |

Raw TURN logs/configuration and generated client keys are under ignored private artifacts, not this report.

The first concurrent public TLS probe collided with other probes' identical temporary TURN usernames and hit a per-user quota. The diagnostic now assigns unique usernames. Room quota allows bounded ICE transport headroom, and the app bundles audio/video into one peer transport. Final sequential public UDP/TCP/TLS samples passed. Physical media quality remains unverified.

`npm audit` after adding tunnel tooling reported moderate findings in Expo fingerprint/minimatch and ngrok tool dependencies, with no high/critical findings in that run. Automatic major-version downgrades were not applied; revisit tool dependency updates in a maintenance pass. This observation does not establish native media correctness.

## Remaining acceptance

Finish/check iOS native build; install both clients; execute audio/video, both initiation directions, Wi-Fi/cellular, forced relay, permissions, teardown, repeated calls, and timing on physical devices. M1 stays in progress until that evidence is recorded.
