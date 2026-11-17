# Testing strategy

## Current runnable checks

```sh
python3 scripts/check_project.py
npm run typecheck
npm test
npm run doctor
npm run bundle:check
```

The Python check validates project artifacts and local Markdown links/references. TypeScript checks app, server, and test logic. Node tests exercise live local signaling and pure call helpers. Expo Doctor checks dependency/configuration health; bundle export compiles both platforms' JavaScript, not native binaries. A [GitHub Actions template](templates/docs-workflow.yml) is provided but not enabled because workflow-write permission is unavailable.

`npm run smoke` loads the private server key from `.env.server` and checks the public HTTPS/WSS path through nginx with two synthetic signaling peers. It does not exchange real media. `python3 scripts/check-turn.py --transport udp` (also `tcp` or `tls`) uses the installed Linux coturn client to send relay test packets. Neither establishes physical-phone acceptance. See [the implementation report](testing/2026-11-16-poc-foundation.md) and [setup](SETUP.md).

## Implementation checks

Add only tests that verify meaningful behavior. Keep actual commands and limits in [tools/access](TOOLS.md).

| Layer | Behavior to verify | Limits |
| --- | --- | --- |
| Type/lint/build checks | App/backend configuration and code consistency | Compilation does not prove media works. |
| Signaling tests | Two-member limit, invite expiry, invalid payloads, disconnect cleanup, candidate/offer exchange, rejoin behavior | Protocol success does not prove audio/video exchange. |
| App logic tests | State transitions, timer boundaries, permission errors, cleanup | Mocked WebRTC cannot validate hardware or native routing. |
| Optional browser harness | Negotiation and browser peer behavior; Playwright if appropriate | Browser emulation is not a native iPhone/Android device test. |
| Physical devices | Native media capture/playback, camera switching, cross-network connection, teardown | Requires owner-operated devices until remote tooling is explicitly configured. |
| Database | Clean install, upgrade, constraints, event idempotency, time/export reconciliation | Use isolated test data/targets; no DB currently exists. |

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
