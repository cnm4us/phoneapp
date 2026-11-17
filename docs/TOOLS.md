# Tools and access inventory

Updated: 2026-11-17 UTC. Record verified capabilities separately from proposals. Connection details belong here; secret values do not. Tool availability and account sessions can change between threads.

## Verified environment

| Tool/resource | Observed state | Use / limits |
| --- | --- | --- |
| Working tree | `/home/ubuntu/phoneapp` on Ubuntu EC2 | Shared project checkout; preserve unrelated projects on this host. |
| Git / GitHub | Git installed; `gh` authenticated as `cnm4us`; repository accessible with push permission | Remote `https://github.com/cnm4us/phoneapp.git`; public at bootstrap. Do not paste authentication output containing credentials. |
| Node / npm | Node 22.21.1; npm 10.9.4 | Available, but project SDK/runtime compatibility must be checked when scaffolding. |
| Python | Python 3 installed | Runs documentation check without third-party dependencies. |
| Docker | Not found on PATH | Disposable container DB testing is unavailable until configured. |
| PostgreSQL client | `psql` not found on PATH | No database connection has been established. |
| EAS | CLI 27.10.0; authenticated as `mbcollins2`; project linked | Android and iOS native builds finished successfully. Owner approved iPhone pay-as-you-go; no new build needed for browser companion. |
| Apple Developer | Owner reports an account | Access credentials remain with the owner; use EAS-supported signing flow. |
| iPhone / Android | Owner and wife own the devices | Models/OS versions unknown; no remote device-control tool configured. |
| nginx / certbot | Installed; dedicated hostname site/certificate deployed | `https://phoneapp.bawebtech.com/health` verified. Other sites were not edited. |
| coturn | Installed; project-specific unit running | Local/public UDP/TCP/TLS packet exchange verified; physical-phone media pending. Stock coturn unit disabled. |

## Agent tool capabilities

- Native call UI iteration: [plan 0005](plans/0005-native-call-settings.md) uses in-window settings and a stable full-height renderer. The pinned Expo 57 iOS optional module `DevMenuPreferences.setPreferencesAsync` can set `showFloatingActionButton:false` without changing shake/touch preferences. The guarded bridge is based on installed Swift source and has not been physically verified; it is not the newer SDK's public JS hide-button API. No dependency/native upgrade or paid build is needed to try it. Manual fallback: Expo developer menu → Tools button off. Android in this pinned version does not expose that bridge; app settings layout is shared, automatic Expo-button suppression is iOS-only. Native device control/UI testing remains unavailable; TypeScript/bundle exports do not establish acceptance.

- Shell/filesystem tools can edit source, run available checks, and manage Git in the checkout.
- A connected GitHub tool verified repository metadata, but workflow/PR writes were denied in this session. Authenticated Git/`gh` successfully pushed the feature branch and opened [draft PR 1](https://github.com/cnm4us/phoneapp/pull/1). Rediscover availability in a new session; ordinary CLI repository writes work, while workflow-write scope is still missing.
- Playwright 1.65.1 / Chromium and browser developer tools have now been exercised for the companion. Tests use synthetic camera/microphone input and real WebRTC media. They do not control native apps on the physical phones.
- No dedicated database connector or native-device test connection has been verified. Add exact capabilities only after an actual connectivity/test run.

## Commands available now

Run at the repository root:

```sh
python3 scripts/check_project.py
npm run typecheck
npm test
npm run doctor
npm run bundle:check
npm run smoke
npm run build:web
npm run test:browser
npm run test:browser:live
npm run test:quality-network
git status --short --branch
git diff --check
```

The [GitHub Actions template](templates/docs-workflow.yml) can run the same checker on pushes and pull requests. It is **not enabled**: the CLI token lacks `workflow` scope and the connected GitHub integration also rejected workflow creation. Keep the local checker usable. When suitable credentials are available, copy the template to `.github/workflows/docs.yml`, commit/push it, and verify a hosted run. No authentication change is required for ordinary source/documentation pushes.

## Implementation tooling and remaining setup

| Area | Plan | When to mark ready |
| --- | --- | --- |
| Native app | Expo CLI, global EAS CLI 27.10.0, TypeScript, Expo Doctor, native generation and JS bundles available | Native cloud result and physical behavior are separate; see current state/report. No dedicated lint runner configured. |
| Signaling/backend | Node tests via `tsx`; local HTTP/WSS tests, static allowlist/headers, public smoke | 31 unit/server/adapter tests pass; no media in signaling smoke. |
| Browser companion | Buildless UI source in `web/`, TypeScript bundled by esbuild 0.28.2, Playwright 1.65.1 | 12 deployed-site checks pass in Chromium with synthetic media. Physical/native/Safari results remain separate. |
| Native acceptance | Both physical phones, EAS artifacts, sanitized session diagnostics | Owners install builds and execute the matrix in the active plan. |
| DB access | Dedicated dev/test database and CLI or driver; migration runner selected with persistence stack | Connectivity verified to the recorded target without printing secrets. |
| DB tests | Disposable or isolated DB, clean install + upgrade checks | Bootstrap and migration commands work and outcomes are recorded. |

See `package.json` for actual scripts. Install Chromium once using `npx playwright install chromium`. Local browser tests start an isolated server on loopback 8790 with a synthetic creator key; if `.env.server` exists, only the configured TURN connection is reused. Without TURN the relay scenario is explicitly skipped. `test:browser:live` uses `.env.server` to exercise the public site; it creates temporary rooms and transfers synthetic media. Neither controls the physical phones. Linux relay diagnostics remain available with `python3 scripts/check-turn.py --transport udp` (or `tcp`/`tls`).

## Quality verification

Current preset labels: **High · 1080p/30** and **HD · 720p/30** on native/browser. High's video ceiling stays 8 Mbps (6 Mbps relay); HD stays 3 Mbps. Advanced bounds remain separate. Existing development builds load the JavaScript update by reloading and selecting High; no new EAS build. See [latest evidence](testing/2026-11-17-adaptive-quality.md).

Latest usability increment: [plan 0004](plans/0004-call-testing-usability.md) and [evidence](testing/2026-11-17-call-usability.md). Current suites have 43 unit/server/adapter/diagnostic cases and 13 browser scenarios; older counts below describe the quality checkpoint. New rooms default to 240 minutes (`ROOM_TTL_MINUTES`, maximum 480). Short-code resolution uses exact HTTPS `POST /rooms/resolve`, proxied to signaling; codes stay out of URL logs. Native clients load the JavaScript UI/resolver through Metro; no new build submitted.

Quality verification extends `npm test` to 31 cases and browser acceptance to 12 scenarios. Latest evidence: [quality report](testing/2026-11-17-adaptive-quality.md). `npm run test:quality-network` is a Linux-only, roughly two-minute UDP impairment experiment requiring installed `ip`, `tc`, `turnserver`, `socat`, Chromium, and passwordless `sudo` for a disposable network namespace/veth. All were exercised on this EC2 host. The script launches isolated test services on a benchmark subnet, uses synthetic credentials, shapes only its veth pair, and cleans up. It never uses live TURN or shapes the host primary interface. Output stays under ignored `artifacts/private/`; review before publishing. Do not run concurrent copies.

Server flags: `RELAY_VIDEO_MAX_BITRATE` (video payload bits/s; default 6000000) and `ENABLE_EXPERIMENTAL_ULTRA` (default false). Both are nonsecret. Keep the first safely below actual TURN allocation quotas including audio/overhead; keep the latter off until device/route gates pass. See [runbook](SETUP.md). Native development binaries can load these JavaScript changes through Metro; physical behavior remains a separate check.

## Browser video diagnostics

**Connection details → Copy video diagnostics** produces local JSON with up to 30 recent measurements. It distinguishes complete received frames/second from decoded frames/second, drops, interval video packet loss, codec, and average encode/decode time per frame. Outgoing encoder limitation and capture rate describe this browser, not the phone. Unsupported counters remain unknown; complete frames received alone do not establish a cause. Pair with the phone's Actual sent dimensions/fps/Mbps for the iPhone-to-desktop investigation.

Copies omit room credentials, SDP, addresses, raw report IDs, and device labels. No automatic upload, recordings, new credential, or native build. The selectable text fallback works when clipboard permission is unavailable. History resets at each new join and remains available after hangup until the next join/page close. See [current state](PROJECT_STATE.md) and [evidence](testing/2026-11-17-adaptive-quality.md) for deployment/check results.

## Connection registry

Populate this table as each service is configured. Use aliases and secret references; omit live tokens, passwords, credential-bearing URLs, signing files, and sensitive device identifiers.

| Resource | Environment / alias | Endpoint or ID | Credential location | Verified |
| --- | --- | --- | --- | --- |
| EAS project | Development | `@mbcollins2/phoneapp`, UUID `942392a3-1d9c-4d2c-91b0-0ad939e4e1fd` | Authenticated CLI session | Yes |
| App identifiers | iOS / Android | `com.bawebtech.phoneapp.poc` | Not applicable | Configured; native/device result pending |
| Metro | Development | Port 8081, `npm run start:tunnel`; ephemeral URL in its terminal | Existing Expo session | Tunnel started; recheck process |
| Signaling | Development | `https://phoneapp.bawebtech.com`, WSS `/signal`, private listener 8787 | `.env.server` (600), creator key entered in app | Public health/WSS smoke passed |
| Browser companion | Development | `https://phoneapp.bawebtech.com/`, `/app.js`, `/styles.css` | Creator key entered only when creating; guest uses invitation | Public Chromium media tests passed |
| TURN | Development | Host `phoneapp.bawebtech.com`; 3478 UDP/TCP, 5349 TLS, UDP relay 49160-49200 | `.env.server` master secret + `/etc/phoneapp/turnserver.conf`; client HMAC credentials expire | Local/public probes pass; real phones pending |
| Database | Dev / test | Not provisioned | Future ignored env/secret store | No |
| Twilio | Future development | Not linked | Backend-only secret store | No |

Before using DB tooling, verify target host/database/environment and intended migration scope using [the database workflow](DATABASE.md). Do not inspect or copy credentials from unrelated projects.

## Configuration conventions

- Keep `.env.example` templates alongside the component that consumes them when implementation adds configuration. Document public vs server-only values.
- Ignore actual `.env` files. A public app variable cannot hold a privileged credential.
- Record setup commands, ports, endpoint purpose, health checks, start/stop procedure, and known failure modes when a service becomes runnable.
- Before changing AWS security groups or routing, inspect existing rules and record project-specific changes. The host's network configuration has not been verified.
- Paid-provider setup and app installations may need owner action. Prepare code/configuration first and request only the missing external step.

## Service operation

Full instructions and recovery: [setup/runbook](SETUP.md). `phoneapp-signaling` and `phoneapp-turn` are enabled systemd services. Check with `sudo systemctl status phoneapp-signaling phoneapp-turn --no-pager`; restart only the affected project unit after checks. Their runtime follows this development checkout, so account for running services before changing branches/dependencies. Generated native folders and private artifacts are ignored.

Before starting/restarting signaling, run `npm run build:web`: it loads the three allowlisted compiled assets from `web/dist` at startup. Asset changes need a signaling restart after tests. nginx routes only those three page/assets paths plus existing APIs; arbitrary repository files are not served. Build outputs, private screenshots, and browser test results are ignored.

The AWS role cannot describe/manage EC2 security groups. No AWS rules were changed by the agent. Owner confirmed inbound TCP 3478/5349, UDP 3478 and `49160-49200` were added; public relay probes subsequently passed. AWS Console requires an ordinary ASCII hyphen for the range. A configured health flag alone does not prove reachability.

EAS native builds: [Android 2cf8e5a8](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c) and [iOS 0e5beca1](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/0e5beca1-cdcd-4d69-9c85-90f26667e21d), both finished successfully. Owner reports the iPhone app is open. The historical signing/config stops are resolved for that build. Additional devices still need appropriate provisioning when using the native app; an iPad browser needs no EAS enrollment.

`npm run start:tunnel` uses installed local ngrok tooling. Keep the Metro terminal running while development clients use it; no persistent Metro systemd service was installed. Do not start duplicate listeners on 8081 or 8787.

## References

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo WebRTC config plugin](https://github.com/expo/config-plugins/blob/main/packages/react-native-webrtc/README.md)
- [Playwright documentation](https://playwright.dev/docs/intro)
