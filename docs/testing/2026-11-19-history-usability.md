# Communication history usability evidence

2026-11-19 UTC. [Plan 0016](../plans/0016-communication-history-usability.md), [ADR 0012](../decisions/0012-history-overlay-and-playback.md). Worktree `/home/ubuntu/phoneapp-stage16`, branch `feat/history-usability`. Synthetic fixtures only. Development rollout and native preview results are recorded separately below.

## Implemented source

Native/browser history uses full usable phone width, padded patient-first rows and upper-right type icons. A detail overlay retains the underlying list and has fixed Close/Reply, From/To/date, private media and independent scrolling. Technical source/transcript placeholders and bottom reply/close buttons are removed. Future artifact tabs are not represented as working features. Patient A has no redundant patient selector; caregiver fixtures switch only linked records; staff retain the overview.

Audio/video play/pause and elapsed/total scrubbers reuse the existing media owner. Shared scrub generations prevent an interrupted seek from restarting playback. Replies prepare an in-overlay audio/video composer; recording, preview/send and explicit draft discard remain deliberate. Supported staff video calls use the current path; patient-originated calls and Audio Call remain unavailable. Revoked reply recipients do not silently retarget. No stored response links, receipts, comments, transcripts or billing credit were added.

Date overlays offer explicit year/month/day selection, leap/month clamping, Cancel/Done/Clear and separate Apply dates. Pacific civil-date semantics and existing API filters remain unchanged. Background polls publish changed content only; new items can wait behind an indicator while reading. Player progress does not rebuild history. Native bridge access-error metadata now distinguishes HTTP 403/404 from transport failure, preserving existing 401 signout behavior.

## Verification checkpoint

| Check | Result |
| --- | --- |
| TypeScript | Pass across app/server/browser/database tests |
| `test:communication-client` | 11 cases pass: existing account/detail/access/pagination races, quiet unchanged polls, held new arrivals, offline retention, calendar boundaries and seek intent/interruption |
| `test:message-client` | 10 cases pass, including unchanged polling/offline playback preservation |
| `test:account-client` | 8 cases pass, including native access-status propagation |
| `test:communications` | Nine DB/API/Chromium scenarios / 10 Node tests pass, including actual paused audio/video seeks, calendar clamping/cancel/apply, two idle poll intervals with stable row identity, Close scroll restoration and caregiver switching |
| Audio/video integration | 9 Node tests each pass under existing guarded disposable DB target |
| Account/native/browser-cookie integration | 7, 8 and 5 Node tests respectively pass |
| Unit/server and WebRTC browser | 58 unit/server tests and 13 local browser scenarios pass |
| Expo Doctor / both JS exports | 21/21 and both final JS exports pass |
| Archive / native build / public rollout | Pending; no physical acceptance inferred |

Shared DB suites run sequentially. No schema/migration change is needed. Tests use their own random synthetic users/patients and temporary media, not owner calls or messages. Private fixture screenshots/packages/logs stay under ignored history-ui artifacts.

During implementation, existing UI tests were updated to select accessible type-labeled record buttons and the new dialog/player controls. A case-only Player/player filename collision was removed by naming the shared seek model `playback-model.ts`, avoiding platform/bundler ambiguity. The single-patient browser test checks actual hidden state rather than counting a retained hidden select. These were test/build findings, not claims that phone acceptance passed.

## Release and hardware gates

Development deployment, public smoke, EAS build IDs/packages and install QR results are pending at this checkpoint. No DB or credential change is planned. Record actual outcomes before final handoff.

Owner still needs to verify the full-width iPhone/Android history, Close/Back/scroll preservation, menus/date picker, actual audio/video play/pause/seek/fullscreen, in-overlay replies/draft handling, accessibility and native incoming/background/call interruption. Earlier Stage A/media/calling hardware gates remain open. Compilation, synthetic media and signed package inspection are distinct evidence.
