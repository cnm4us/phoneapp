# Testing strategy

## Current runnable checks

```sh
python3 scripts/check_project.py
npm run typecheck
npm run test:db
npm run test:db:permissions
npm run test:accounts
npm test
npm run test:browser
npm run test:browser:live
npm run test:quality-network
npm run doctor
npm run bundle:check
```

The Python check validates project artifacts and local Markdown links/references. TypeScript checks app, server, and test logic. Node tests exercise live local signaling and pure call helpers. Expo Doctor checks dependency/configuration health; bundle export compiles both platforms' JavaScript, not native binaries. A [GitHub Actions template](templates/docs-workflow.yml) is provided but not enabled because workflow-write permission is unavailable.

`npm run smoke` loads the private server key from `.env.server` and checks the public HTTPS/WSS path through nginx with two synthetic signaling peers. It does not exchange real media. `python3 scripts/check-turn.py --transport udp` (also `tcp` or `tls`) uses the installed Linux coturn client to send relay test packets. Neither establishes physical-phone acceptance. See [the implementation report](testing/2026-11-16-poc-foundation.md) and [setup](SETUP.md).

The browser companion tests use Chromium's synthetic media devices while performing actual peer negotiation and transferring media. They assert remote video dimensions/playback and increasing inbound bytes; the forced-relay scenario also checks selected relay candidate types. Tests cover controls, capture teardown, repeat calls, audio-only/video mix, invalid room/key, permission denial, autoplay recovery, fragment removal, and viewport overflow. The public variant uses the deployed HTTPS/WSS path. See [browser evidence](testing/2026-11-16-browser-companion.md). Native iPhone/Android, real cameras/microphones, and Safari remain manual checks.

## Implementation checks

Latest [testing usability evidence](testing/2026-11-17-call-usability.md): 38 unit/server cases and 13 public browser scenarios pass. Fake-clock tests cover four-hour boundaries/TURN expiry and heartbeat grace; HTTP tests cover short-code resolution/limits/tombstones. The browser suite uses short codes and checks share links and lifetime display. Native fullscreen is a stable renderer-layout change checked by TypeScript/bundle export; physical rendering/stability remains owner-operated.

The quality increment extends browser acceptance to 12 scenarios: directional incoming limits, cameras added after camera-less joins, simultaneous changes, two-way video-RTP suppression with audio continuity on direct/relay routes, consent-aware restoration, negotiation-failure survival, and full-screen layout. Unit/server coverage includes shared policy/stats/controller and native API fallbacks (31 tests). The Linux impairment harness uses real UDP through isolated TURN and netem on a disposable veth pair; automation uses a private Unix socket outside the shaped path. See [quality evidence](testing/2026-11-17-adaptive-quality.md). HTTP throttling or packet counters do not establish perceptual speech quality/end-to-end delay.

Add only tests that verify meaningful behavior. Keep actual commands and limits in [tools/access](TOOLS.md).

| Layer | Behavior to verify | Limits |
| --- | --- | --- |
| Type/lint/build checks | App/backend configuration and code consistency | Compilation does not prove media works. |
| Signaling tests | Two-member limit, invite expiry, invalid payloads, disconnect cleanup, candidate/offer exchange, rejoin behavior | Protocol success does not prove audio/video exchange. |
| App logic tests | State transitions, timer boundaries, permission errors, cleanup | Mocked WebRTC cannot validate hardware or native routing. |
| Browser companion | Playwright synthetic-media calls, forced TURN, controls/cleanup, permission/playback errors, responsive widths | Chromium at iPad viewport dimensions is not Safari or native hardware verification. |
| Physical devices | Native media capture/playback, camera switching, cross-network connection, teardown | Requires owner-operated devices until remote tooling is explicitly configured. |
| Database | Clean install, upgrade, constraints, event idempotency, time/export reconciliation | Live isolated MariaDB tests implemented; test:db resets only phoneapp_test. |

## M1 physical acceptance

Run the full matrix in [plan 0001](plans/0001-webrtc-poc.md) using the actual iPhone and Android development builds. Record device models/OS, build IDs, dependency versions, network, scenario, expected/actual outcome, sanitized session ID, and diagnostic evidence.

Test audio-only and video with both devices initiating, same Wi-Fi and Wi-Fi/cellular, then force relay and verify the selected candidate pair is relay-backed. Include permission denial, remote departure, network loss/rejoin, repeated calls, and resource cleanup.

M1 is explicitly foreground-only. Lock/background tests in this phase characterize limitations; passing M1 does not establish reliable incoming/background calls. M3 must verify push registration, native incoming-call UI, locked/background operation, permission/battery constraints, and no-answer fallback on real devices.

Use [the device report template](testing/DEVICE_REPORT_TEMPLATE.md). Never fill a result with “passed” merely because a user was given instructions or an EAS build completed.

## Evidence handling

- Synthetic conversations only. Do not record conversations for M1.
- Exclude room credentials, access tokens, raw phone numbers/device identifiers, raw SDP/IP details, and private captures from public reports.
- Commit sanitized reports; keep private recordings, traces, dumps, and screenshots in an agreed private location and link only an appropriate reference.
- Record command, date, scope, and outcome. Distinguish automated, browser, build, and physical-device results.
- Failures should describe observable behavior and the next diagnostic step. Do not broaden testing after checks pass unless changes or unresolved concerns justify it.

## Database verification

[Foundation report](testing/2026-11-17-database-foundation.md): eight live MariaDB scenarios verify clean install, v1-to-v2 upgrade with data preservation, no-op replay/seed, shared contacts/FKs, duplicate events/requests, device ownership, consent/transcript call scope, raw/reviewed seconds, migration locks/checksum/future history refusal and dirty-DDL recovery. A separate permission case checks the actual development runtime grants. These do not establish authenticated API isolation, native delivery, recording consent enforcement or a transcription service.

`npm run test:db` is destructive to the exact disposable `phoneapp_test` schema; it verifies target/account and a suite lock before resetting tables, then leaves synthetic directory rows only. It never accepts a development reset target. `npm run test:db:permissions` uses development reads, denied statements, and rolled-back no-op updates. Run both for schema/grant changes; ordinary `npm test` remains independent of DB/sudo availability. See [database](DATABASE.md) for recovery and credential handling.

## Foreground accounts

[Account report](testing/2026-11-18-foreground-accounts.md) records six integration scenarios (7 Node tests including wrapper) on real isolated MariaDB plus Chromium: one-use/expired credentials, role/patient/provider isolation, deduplicated calls/reports, competing answer ownership, private media access, bounded observed intervals, cancel/decline/missed/setup timeout, logout/expiry/relationship revocation, restart-retained history, body/rate limits, and the complete directory→incoming Answer→real two-way video→shared ended log. Both native JS exports pass; actual iPhone/Android acceptance is open.

Run `test:accounts` and `test:db` sequentially: both hold `phoneapp:test-suite` on the isolated test target, so a concurrent suite is refused. The account suite leaves only synthetic account/call data; `test:db` resets all disposable tables to the seed. `smoke:accounts` is a separate explicit development/public no-media check; it is not part of regular tests or a production action. See tools for credentials and intended targets. Foreground polling/visible prompts do not verify native push/locked ringing or a ringtone.
