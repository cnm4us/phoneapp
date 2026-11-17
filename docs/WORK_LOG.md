# Work log

Append concise dated entries for durable outcomes. The latest actionable handoff belongs in [current state](PROJECT_STATE.md); feature details and test evidence belong in their plans/reports.

## 2026-11-16 Documentation foundation

- Captured the full communications/time-tracking product requirements, phase boundaries, and acceptance criteria.
- Prepared the first two-device WebRTC plan, agent startup/handoff workflow, roadmap, architecture direction, decision record, database migration policy, tool inventory, and testing/report templates.
- Added a dependency-free documentation checker and a ready-to-enable GitHub Actions template. The CLI token lacks workflow scope; the connected integration also rejected workflow creation. Kept the template under `docs/templates/` so ordinary repository publication can proceed; no hosted check is claimed.
- Verified empty repository access and cloned it into `/home/ubuntu/phoneapp`. GitHub CLI is authenticated as the repository owner. Node/npm/Python/Git are available; Docker/psql and project-specific DB/native-device connections are not configured.
- Verification: `python3 scripts/check_project.py` passed locally: 17 required artifacts, 16 Markdown files, 34 unique requirements, local file links and references valid. Application builds, migrations, and device tests have not run. Hosted CI is not enabled.
- Next: implement plan 0001 on a feature branch; EAS/signaling/TURN setup and physical-device steps remain outstanding.

## 2026-11-16 WebRTC runtime foundation

- Implemented native Expo audio/video experiment and Node/WebSocket signaling, with 15 protocol/helper tests, pinned dependencies, Expo checks, and both platform JS bundles.
- Owner supplied `phoneapp.bawebtech.com`. Added only this project's nginx site, issued TLS certificate, and enabled dedicated signaling/TURN services. Local relay transports/public signaling tested; public TURN still needs firewall confirmation.
- Linked EAS project `@mbcollins2/phoneapp`; Android native build finished successfully. Its overage notice prompted an owner question; owner approved pay-as-you-go for iPhone. iOS noninteractive setup stopped before upload for missing signing credentials; owner was asked to complete the Apple/device flow in the EC2 terminal. All physical acceptance remains outstanding.
- Prepared runbook, environment examples, secret bootstrap, deployment templates, smoke/relay checks, and [verification report](testing/2026-11-16-poc-foundation.md). No patient database or recording added.
- Owner confirmed firewall rules; public TURN UDP/TCP/TLS packet samples now pass. Fixed iOS's dynamic-config encryption stop and directed the owner to resume the interactive signing/device flow.
- Next: finish iOS native build and both physical-phone tests. Plan 0001 remains open.
- Published implementation commit `4874959` on `feat/webrtc-poc` and opened [draft PR 1](https://github.com/cnm4us/phoneapp/pull/1). Final local checks: TypeScript, 15 tests, 21 Expo Doctor checks, both bundles, public signaling smoke, and documentation validation passed. Generated private credentials were checked absent from staged files. No physical-device result is claimed.

## 2026-11-16 Browser companion

- Owner requested a browser participant for solo testing while the Android phone is unavailable. Added the responsive browser UI to the existing hostname, reusing native signaling/credentials and shared call helpers. No new EAS build, provider, DB, or secret needed.
- Added explicit asset serving and headers; private repository files remain inaccessible. Added esbuild/Playwright tooling and actual synthetic-media tests, including forced relay, mixed audio/video, repeat calls, controls/cleanup, permission/room errors, autoplay recovery, invitation fragments, and responsive widths.
- Deployed on existing nginx/signaling service; public HTTPS returns the page and all seven browser scenarios passed. Native/core/asset tests: 16/16. Real Safari/iPad and browser-to-native calls remain manual acceptance.
- Verified iOS native build `0e5beca1` finished successfully; owner reports the app UI is loaded. Updated setup/state/tools with this evidence. M1 remains open for real calls and the original two-phone matrix.
