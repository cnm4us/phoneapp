# Testing strategy

## Current runnable check

```sh
python3 scripts/check_project.py
```

This checks required project artifacts, local Markdown file links, requirement references, and Python syntax of the checker. A [GitHub Actions template](templates/docs-workflow.yml) is provided but not enabled because workflow-write permission is unavailable. There is no application test suite yet.

## Implementation checks

Add only tests that verify meaningful behavior. The implementation plan must commit the chosen tools and runnable package scripts, then update [tools/access](TOOLS.md).

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
