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
| `test:message-client` | 11 cases pass, including unchanged polling/offline playback preservation and retained draft through call interruption |
| `test:account-client` | 8 cases pass, including native access-status propagation |
| `test:communications` | Nine DB/API/Chromium scenarios / 10 Node tests pass, including actual paused audio/video seeks, in-overlay audio/video replies, supported staff Video Call, incoming calls hiding detail and date picker, calendar clamping/cancel/apply, two idle poll intervals with stable row identity, Close scroll restoration and caregiver switching |
| Audio/video integration | 9 Node tests each pass under existing guarded disposable DB target |
| Account/native/browser-cookie integration | 7, 8 and 5 Node tests respectively pass |
| Unit/server and WebRTC browser | 58 unit/server tests and 13 local browser scenarios pass |
| Expo Doctor / both JS exports | 21/21 and both final JS exports pass |
| Archive / native build / public rollout | Archive exclusion pass; public overlay/Reply/Close/year-month-day smoke passes; final native status below |

Shared DB suites run sequentially. No schema/migration change is needed. Tests use their own random synthetic users/patients and temporary media, not owner calls or messages. Private fixture screenshots/packages/logs stay under ignored history-ui artifacts.

During implementation, existing UI tests were updated to select accessible type-labeled record buttons and the new dialog/player controls. A case-only Player/player filename collision was removed by naming the shared seek model `playback-model.ts`, avoiding platform/bundler ambiguity. The single-patient browser test checks actual hidden state rather than counting a retained hidden select. These were test/build findings, not claims that phone acceptance passed.

## Release and hardware gates

Published browser source ae77c90 between calls, after verifying zero active account calls/WebSockets and retaining the prior browser assets/source reference privately. Public workspace smoke confirms all 34 authorized legacy sources exactly once, reload and authenticated Range access; public cookie/session smoke and all 13 public WebRTC cases pass. No owner call/message/push is sent by the workspace/session smokes. No schema, grant, media, credential or service configuration change.

The first ae77c90 EAS candidates (iPhone 2647b41b, Android 4ad3dbe9) were canceled before installation to include a final native draft-retention fix: keep the workspace mounted but hidden during live calls, and make poster filenames unique per view lifetime. Final source typechecks and both JS exports pass. Final EAS previews from app source 0a93f34: iPhone 1f6e7abd-7229-4798-a87a-8f8c2c1a27c0 and Android 2381d48d-1c50-4a6b-b00e-e98fa95d4285. Both are **FINISHED** and actual combined IPA/APK package checks pass: bundled JS includes the picker/scrubber/detail UI; calling/media handlers remain; signed/profile iPhone Production APNs identity matches. [iPhone install](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/1f6e7abd-7229-4798-a87a-8f8c2c1a27c0), [Android APK](https://expo.dev/artifacts/eas/kpACSawUWuAzL9mxNK-GtUv1Ge1jvIIJi3JJ0lw0wpI.apk). Both ignored install QR images are refreshed. No new signing/provider credential or native dependency was required. Actual packages/metadata are private in stage16 history-ui artifacts; owner acceptance remains pending.

Final browser source 8d32d16 also closes an open calendar for an incoming call, verified with two isolated browser participants. Public detail From/To/Reply/disabled Audio Call, nested Escape/Close and year/month/day picker Cancel smoke passes; all 34 authorized sources remain identical, saved reload/Range passes, and all 13 final public WebRTC cases pass. Only schema-compatible client/browser changes were published between calls; no owner call/message/push from public workspace/session checks. Existing nginx/TURN/media quotas/retention/provider keys and seven-migration ledger are unchanged. No development restore was performed.

Owner still needs to verify the full-width iPhone/Android history, Close/Back/scroll preservation, menus/date picker, actual audio/video play/pause/seek/fullscreen, in-overlay replies/draft handling, accessibility and native incoming/background/call interruption. Earlier Stage A/media/calling hardware gates remain open. Compilation, synthetic media and signed package inspection are distinct evidence.
