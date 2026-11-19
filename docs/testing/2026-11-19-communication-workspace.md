# Unified communication workspace: Stage A evidence

2026-11-19 UTC. [Plan 0015](../plans/0015-unified-communication-workspace.md), [ADR 0011](../decisions/0011-communication-workspace.md). Implementation worktree `/home/ubuntu/phoneapp-stage15`, branch `feat/communication-workspace`. This report covers existing call/media consolidation only; Stages B–G remain planned.

## Delivered behavior

One authorized overview and patient timeline replace duplicate call/communication histories in updated clients. Server-side patient, kind, format, direction, channel, sender, logical recipient and inclusive local-date filters precede counts and 30-entry cursor pages. Pacific timezone is visible; UTC source times remain unchanged. Detail retains source outcomes, source-linked media playback and composition/reply; active incoming/current/other-device calls remain outside archive filters. New registry IDs never replace source call/message IDs used for grants or playback.

Calls retain participant access even for another assigned staff member. Published media retain current patient/team access; unpublished drafts remain sender-only. Historical receipts/work are Not recorded. Actual call media format and saved-message origin channel were not persisted and stay unknown. Call recording/transcripts remain off. Existing exact upload originals were deleted during normalization; detail distinguishes that absence from the retained playback copy. Patient detail omits internal future notes/discussion. No transcription/AI calls, workflow receipts, comments, text messages or billing credit are generated.

`ENABLE_COMMUNICATION_WORKSPACE` defaults false. Existing account/message APIs, signed-in sessions, media grants and older native history paths remain usable. The new UI requires existing message support; optional-module checks preserve older incomplete native binaries. Recovery disables the workspace flag on schema-compatible source, retaining all source and registry history.

## Automated results

All fixtures are synthetic. Shared MariaDB suites run sequentially against only the exact disposable `phoneapp_test` account/schema; none ring an owner device.

| Check | Actual outcome |
| --- | --- |
| TypeScript | App/server/web/tests/database pass |
| `test:communications` | Seven scenarios / 8 Node tests pass: unique source mapping; call audience, draft/patient/revocation isolation; real patient FK rejection; server filters/equal-time pagination/Pacific DST; resumable idempotent reconcile; one browser history, 360px detail layout and existing audio detail playback; browser video record/preview/send/detail playback and patient audio reply; feature-off legacy contracts |
| `test:communication-client` | Five pure cases pass: stale logout data, anchored paging/filter binding, revoked patient cleanup, competing detail responses and newly unavailable media cleanup |
| `test:message-client`, `test:account-client` | 9 and 7 pass |
| `test:audio-messages`, `test:video-messages` | Eight scenarios each / 9 Node tests each pass, including real Chromium media and old API contracts |
| `test:accounts`, `test:native-calls`, `test:browser-session` | 7, 8 and 5 Node tests pass respectively |
| `test:db` | 9 Node tests pass: clean install/upgrade/preservation/constraints/checksum/dirty-DDL recovery; seven immutable migrations |
| `npm test`, `test:browser` | 58 unit/server cases and 13 real Chromium WebRTC cases pass |
| Expo Doctor, `bundle:check` | 21/21 checks and iOS/Android JS exports pass |
| EAS archive | Required client config/media modules/postinstall patch files present; server/database/env/keys/private artifacts excluded |

Initial audio regression detected an extra field on the disabled message context; the endpoint's original disabled response was restored and the suite passes. Account-change cleanup now releases active media; its expected callback count was updated and five client checks pass. A follow-up layout check exposed a nondeterministic test selector: equal-time drafts could appear before the playable fixture. Playback now selects the fixture by its stable source ID; narrow 360px layout and exact both-source/zero-source constraint checks pass. These fixes do not change source media or native dependencies.

## Migration and development rollout

Migration 0007 adds the append-only registry with unique source mappings, exactly-one-source check, source/patient composite FKs and chronological indexes. Existing source rows retain all IDs, outcomes, media references and timestamps; new calls/messages register atomically. The additive reconcile command logs aggregate results only. Test installation/upgrade passed. Development migration 0007 and least-privilege grants applied between calls, after zero active account calls/WebSockets and a private combined metadata/media/server/nginx snapshot. A root-owned backup file required correcting ownership before continuing; no schema work ran before the backup completed. Exact before/after data INSERT statements match for twelve source/auth/identity tables; all 34 wrappers have their source timestamps. Reconcile reports zero inserted; runtime permission test and current UTC schema pass.

Rolled out source `663e036` first with workspace disabled; public saved browser sign-in/reload/new-tab/logout and legacy adoption pass. Enabled the workspace on the same schema-compatible source. Public smoke compares every authorized legacy history source ID to the new paginated overview: **34 entries, unique and identical source set**, reload and authenticated Range playback pass. All 13 public Chromium WebRTC scenarios pass, including forced TURN. No owner call/message/push was sent by workspace/session smokes. Existing limits, keys, sessions, media files, nginx and other project services are unchanged. Recovery disables only the workspace flag; no development restore or destructive rollback occurred. Private evidence is in canonical `artifacts/private/communications/rollout/`.

## Native and owner gates

Bundled previews use app source `663e036`. [iPhone 8fadedcf](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/8fadedcf-dbf1-4a12-bc08-b1cf085befcf) is **FINISHED**, with actual IPA package checks passing: signed/profile Production APNs, expected app/calling identity, bundled JS/camera/video/audio modules and the new workspace strings. The installation QR is refreshed. [Android 0a34278e APK](https://expo.dev/artifacts/eas/bLGnwjuHPr9EHzsyQttRsj5WLxow56mtgmck6-t6k0I.apk) is also **FINISHED** and passes actual APK package checks with bundled JS/media/calling handlers. Its actual bundle contains the workspace strings. Both installation QRs are refreshed in ignored canonical `artifacts/public/`. The combined `check-native-packages.py --audio-messages --video-messages --ios … --android …` result is PASS; private package/build metadata remains in stage15 communication artifacts. Native source uses the existing pinned camera/video/audio/calling stack; JS compilation and browser synthetic media do not establish physical phone behavior. Owner needs to verify patient/provider history, detail playback, record/reply, retained sign-in, call controls while filters/settings are open, background/locked incoming calls and media handoff on actual iPhone/Android. Earlier physical gates remain in current state. No new owner acceptance is claimed.

Build/signing metadata, private packages, snapshots, source history and any captures stay in ignored private artifacts. No credentials or patient content appear in this report.


## Owner iPhone history feedback

Owner installed preview 8fadedcf as Patient A and confirms All/Calls/Messages filters, audio/video/call rows and opening a record. Detail appearing after the whole list is inconvenient. Owner observes vertical jumps/button flicker roughly every five seconds and proposes either an overlay that restores list position or inline expanded detail. Source inspection confirms the four-second refresh inserts/removes a loading row and toggles filter-disabled state on every poll, including unchanged results. This explains the observed layout/visual behavior; no fix or new phone playback acceptance is claimed.

Recommendation for discussion: overlay with upper-right Close, retain list position and stop detail playback on dismissal; quiet polling with change-only state publication and stable controls. Preserve the reader’s position when new items arrive, potentially using a New communications indicator. No runtime/schema/build change was made for this discussion.
