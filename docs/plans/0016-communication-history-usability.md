# 0016 Communication history, detail overlay and media controls

Status: implemented/deployed to development; both native previews FINISHED/package-checked; core iPhone UI owner-confirmed; Android and remaining physical gates pending. Updated: 2026-11-19 UTC. Source and verification are tracked in the [evidence report](../testing/2026-11-19-history-usability.md) and [ADR 0012](../decisions/0012-history-overlay-and-playback.md).

## Outcome and scope

Make communication history comfortable to scan and use on iPhone, Android and the browser companion. Records use the available screen width, open in a detail overlay without losing the reader's place, and offer direct audio/video playback and scrubbing. Routine refresh is visually quiet. Patient selection reflects the account's authorized patient records; date filtering uses a popup with year/month/day selection.

This is the focused usability follow-up to [0015 Stage A](0015-unified-communication-workspace.md), before that parent's Stage B staff workflow. It implements presentation refinements under PAT-04–05, COM-01, COM-12, TEAM-02, REP-04–06 and OPS-02 in the [PRD](../PRD.md). Preserve [ADR 0011](../decisions/0011-communication-workspace.md), source-specific audiences, active calling, existing record IDs and the earlier media/native device gates.

Included: edge-to-edge history/detail on phones, compact patient-first rows, role-aware patient selection, a From/To detail header and Reply menu, saved-media play/pause/scrubbers, date-range picker, quiet polling/change publication, accessibility, tests and refreshed bundled previews.

Later scope remains in 0015: CC/Forward and multiple-recipient delivery, staff receipts/assignment/comments, app text, retained exact originals, transcription and summaries, staff time, patient-originated live calling, a distinct App Audio calling action and Twilio. This release must not imply those actions work by displaying enabled placeholder controls. Existing recording, recipient routing and grants remain authoritative; no new stored reply/forward relationship is claimed here.

## Current evidence

- Owner installed iPhone preview `8fadedcf` as Patient A. All/Calls/Messages, audio/video/call rows and opening details are observed. Detail appears below the whole list, forcing a long scroll. The list jumps and filter buttons flicker roughly every five seconds. See [Stage A evidence](../testing/2026-11-19-communication-workspace.md); this feedback does not confirm new phone playback/control acceptance.
- `src/communications/controller.ts` polls through the message host every four seconds and publishes loading true/false plus fresh context/page/detail objects even for unchanged results. `Workspace.tsx` inserts/removes loading text and disables/enables filters. Browser `web/communications.ts` replaces list children on each render. These are concrete causes of visible refresh churn.
- `App.tsx` applies 22-pixel content padding; `AudioMessages.tsx` adds an internally padded card. `AccountPanel.tsx` and the surrounding scroll container must be considered when removing outer gutters. Removing inner padding alone will not deliver the requested full width.
- Native date fields currently require YYYY-MM-DD typing; browser uses date inputs. Shared API filters already use civil date strings with inclusive end-date handling in `America/Los_Angeles`, including tested daylight-saving boundaries. Native playback adapters already expose position, duration, pause/resume and seek; video currently uses native controls and separate detail Play buttons.
- Current schema supports self/caregiver bindings and enforces current authorized patient relationships. Full caregiver onboarding is not implemented. Staff calls currently initiate provider-to-patient app audio/video; Patient A cannot yet initiate a provider call, and App Audio is not a separate wired action.
- Migration ledger is 0001–0007. Existing Stage A source and previews remain the deployed baseline until implementation and rollout are recorded. No new runtime or handset verification was performed while writing this plan.

## User-visible design

### History width, records and patient context

Use 100% of the phone's usable horizontal width for the history card and detail overlay. Retain comfortable inner text padding and device safe areas; keep login/settings/active-call layouts intact. At larger browser widths use the available workspace width, without overflowing the viewport.

Each record contains these lines, in order:

1. Patient name, with the communication icon at the upper right.
2. Patient ID.
3. Existing date/time · direction · source status.
4. Existing duration · review status.

Remove the visible App call/Audio message/Video message heading and the list's From line. Icons distinguish calls, recorded audio and recorded video, with accessible type labels. A phone icon represents an existing call; do not infer actual audio/video usage where it was never recorded. Preserve the distinction between observed call seconds and media duration. Historical review status remains Not recorded.

For patient/caregiver accounts with one authorized patient, show that patient's identity and hide both All patients and the redundant patient selector. Keep All/Calls/Messages. With multiple authorized records, show a patient switcher, selecting one patient at a time by default; a self-plus-dependent account follows the same rule. Staff keep their authorized all-patient overview and patient filter. Zero authorized patients has a clear empty state. Current authorization, not a UI choice, determines access. Caregiver fixtures must use their own identity, retaining sender attribution and patient association.

### Detail overlay and header

Open the selected record above the retained history, rather than appending detail below it. Keep the underlying list mounted with its scroll position, pagination anchor and applied filters. The overlay has independent scrolling and a fixed upper-right × Close control with an accessible name and adequate touch target. Android Back and browser Escape close the topmost picker/menu/detail in order. Browser focus enters the overlay and returns to the opening record; if it disappeared, use the history heading. Support screen readers and enlarged text. An in-app overlay host must preserve the existing incoming-call alert priority and single media owner; do not introduce a second live-video renderer.

Closing detail stops playback and releases its private temporary media; reopening is deliberate and must not silently resume. Keep patient identity visible in the detail header. Present separate **From**, **To**, and **Date/time** lines, using role/name where useful. Preserve the actor's actual name; remove duplicated source text rather than silently renaming synthetic accounts. Original recipient is not a mutable work assignee.

Place Reply ▾ directly beneath Close in the fixed action area, reserving space so long names cannot overlap it. Remove message-type headings, repeated From text, Channel, Original, exact-original technical copy and bottom Record reply/Close detail buttons. Remove the bottom Transcript heading and its status/unavailable message. Necessary processing, failed/expired/unavailable media and call-recording-off feedback stays concise and visible; presentation cleanup must not misrepresent source availability or retention.

The future top selector is **Media | Transcript | Summary**, defaulting to Media. Reserve a component boundary for it, but do not add empty Transcript/Summary panels or claim those artifacts exist in this release. Future Summary availability follows the parent's audience/review rules; this is not automatic publication of staff-only clinical drafts. CC and Forward remain future source-linked, explicitly authorized recipient actions.

### Reply behavior

The menu presents Video Message, Video Call, Audio Message and Audio Call. Recorded-message choices enter a recipient-bound composer within the overlay, with explicit Record, preview/re-record, Send and discard controls; do not send automatically. Video preparation uses the existing camera/permission flow. Returning from composition restores the source detail. Preserve an unsent draft until explicit discard/send; closing a draft requires an explicit keep/discard choice rather than silently losing it.

Reply destination and patient come from the opened communication plus current authorized recipients, not whichever patient was most recently selected elsewhere. Preserve the original media owner, request retry key behavior and source/grant IDs. This UI does not create a persisted response link or mark work Responded; those are Stage B contracts.

Enable Video Call only for currently supported and authorized staff-to-patient app calling, after deliberate menu selection. Patient-originated Video Call and the separate Audio Call remain visibly unavailable with a concise Coming later explanation. No enabled no-op actions and no new call protocol merely to complete the menu. Release message media before an actual call; unsent drafts must receive explicit handling.

### Audio/video players and scrubbers

Replace Play video message with an accessible play/pause control at the video/poster's lower left. Before first playback, Play obtains the existing short-lived grant and prepares/downloads media; keep a stable loading/error area. Display a scrubber and elapsed/total time along the lower controls. Audio uses a compact player with the same play/pause, scrubber and timing conventions. Use a shared player UI/model for received/sent recordings and local preview where supported; preserve full-screen and audio/video synchronization.

Scrubbing uses a local thumb position while dragging, bounded to a finite known media duration. Commit the seek on release, preserving the playing/paused intent from before the gesture. Keyboard/screen-reader adjustments seek predictably. Disable seeking while media/duration is unavailable; handle zero/invalid duration, endpoints, drag cancellation and short clips. A close/logout/background/call interruption invalidates a pending seek and prevents a late callback from restarting media. Never attach a scrubber to a live call.

Keep playback progress local to the player; progress ticks must not rerender/rebuild the entire history. Preserve one player instance across metadata polling. Reuse existing authenticated transfers and private file/blob cleanup. Scrubbing, playback duration and time spent loading do not create staff time credit or viewer receipts.

### Date-range picker

Replace typed date entry in the native filters with tappable **From date** and **To date** fields that open a picker overlay. Both platforms must offer direct **year**, **month** and **day** selection; users should not need to page through many months to change the year. Provide a clearly selected date, month/day presentation, Cancel and Done, and a way to clear either boundary. Browser should provide equivalent behavior with keyboard access; existing date inputs may be retained only if the required selection and cancellation behavior is verified.

Use a local draft date/range while the picker is open. Done chooses a date in the filter form; **Apply dates** submits the range once. Cancel changes nothing. Clear dates plus Apply removes the date restriction. Support open-ended ranges; reject From after To without losing the previous applied range. Show the active range and Pacific timezone outside the picker. This request is for calendar dates, not a new time-of-day filter.

Preserve the existing YYYY-MM-DD wire contract, supported 2000–2100 year range, inclusive To date and Pacific date boundaries. Treat selected values as civil dates; do not shift them using the phone/browser timezone. Validate leap years/month lengths; if year/month changes invalidate the selected day, visibly clamp to the month's last valid day. Polling must not overwrite a draft selection or close the picker. Date-picker/menu dismissal restores focus/scroll appropriately.

Prefer a shared date model with JavaScript-rendered accessible controls using installed capabilities. Do not select an unverified native calendar/slider package merely for this plan. If implementation requires a dependency, check current official compatibility with the pinned Expo/RN stack, pin it, verify packaging and record the choice before use. New bundled previews are needed for this UI release regardless.

### Quiet refresh and new communications

Keep existing short foreground refresh intervals initially. A routine background request must not insert/remove a loading row, disable filters, replace unchanged records or move the scroll position. Initial load and explicit filter/page actions may show loading in a stable reserved area. Deduplicate concurrent refreshes and preserve latest-request/account/filter/detail sequencing.

Compare validated context/page/detail content before publishing state. Preserve row IDs and player instances; reconcile browser rows by key rather than unconditionally replacing DOM. Review `MessageController`, account-driven refresh and the native 500ms player timer as well as workspace refresh, so an unchanged response or progress tick cannot produce the same visible churn through another path.

At the top of the newest page, matching new entries may appear normally. While scrolled down, on an earlier page, reading detail or composing, retain the current list and show a stable **New communications** indicator. Apply pending newest-page results deliberately when tapped. Count only known new matching IDs; use an unnumbered indicator if an exact count is not established. Existing row status can update without recreating unaffected rows; do not silently change sort/filter/page anchors. Deliberate filter changes can reset to the top once.

Transient network failures keep the last authorized list with a stable offline/retry indicator. Actual signout, invalid session or confirmed access revocation must immediately clear unauthorized detail/media and patient data; quiet UI must not suppress access rechecks. Expiry/unavailable media stops the player as appropriate. Incoming calls remain discoverable independently of history filters, picker/menu/overlay state and list refresh.

## Implementation steps

- [x] Inspect current layout, source/access contracts, polling, media adapters and existing verification commands; consolidate owner feedback into this follow-up plan.
- [x] Create an isolated feature worktree from current canonical history. Keep canonical on `feat/webrtc-poc`; record actual app source and installed baseline.
- [x] Define the shared presentation/date/player/refresh state and overlay lifecycle. Prefer installed capabilities; record consequential host/dependency choices in an ADR if needed. Keep later parent stages separate.
- [x] Implement quiet change-only refresh, stale-response/access guards and pending-new-item behavior with focused controller tests.
- [x] Implement full-width history, compact keyed records and patient/caregiver selection rules on native/browser, preserving active-call controls.
- [x] Implement detail overlay/focus/scroll restoration, simplified header and capability-aware Reply menu with existing record/preview/send behavior.
- [x] Implement media-surface play/pause, scrubbers/timing and interruption-safe seek/playback; avoid history redraws from progress updates.
- [x] Implement date-picker overlays/draft range/validation and server-compatible Pacific filtering.
- [x] Extend automated acceptance, capture actual results, then publish browser changes between calls and submit/check both authorized bundled previews. Update install links/QR and owner device procedures.
- [x] Update state/work log/evidence/tools as applicable. Record phone outcomes separately; proceed to parent Stage B only with this slice's actual outcome and remaining gates explicit.

- [x] Owner confirms installed iPhone 1f6e7abd core controls: full-width/no-jump history, detail overlay opening, recording playback/scrub and filter-date selection.
- [ ] Complete Android and remaining individual media/Reply/Close/Back/date/calling/accessibility cases; do not infer them from the bundled iPhone confirmation.

Primary files: `App.tsx`, `src/accounts/AccountPanel.tsx`, `src/communications/`, `src/messages/AudioMessages.tsx`, `src/messages/controller.ts`, native audio/media adapters, `web/communications.ts`, `web/messages.ts`, browser media adapter/styles and relevant tests. Backend changes should be unnecessary for the initial UI; recheck before editing APIs. Do not invent receipt/workflow updates to support UI badges.

## Data and configuration

Expected migrations: **none**. No new schema, persisted clinical data, provider subscription, secret, media quota/retention change or public endpoint is planned. Keep registry/source IDs, grant paths, date filters, source audience and the current seven-migration ledger. Caregiver/multi-patient fixtures belong only in the guarded disposable test target, not new owner accounts.

Transient selection, picker drafts, scroll anchors and pending updates are client state. Do not store enrollment codes, media grants or session credentials in new UI persistence. Existing native secure enrollment/browser cookies remain unchanged. No new third-party speech/AI request belongs to this slice.

## Acceptance and verification

Automated and public development checks now pass; native package and physical results are tracked in the [evidence report](../testing/2026-11-19-history-usability.md). All physical acceptance remains separate. Existing test commands were extended; no dependency, schema or new test runner was added.

| Scenario | Command or procedure | Expected | Actual / evidence |
| --- | --- | --- | --- |
| Idle polling | Extend `test:communication-client` and `test:communications`; observe several scheduled polls in Chromium | Unchanged data produces no visible loading/disabled cycle, row replacement, layout shift or lost scroll/focus; changed data is discovered | Pass: controller silence and two Chromium poll intervals; core iPhone no-jump behavior owner-confirmed; Android pending |
| New arrivals / pagination | Synthetic matched arrivals at top, scrolled list, older page, open overlay and draft | Stable position/page; indicator counts only established new items; deliberate reveal shows newest matching entries | Pass: held/reveal controller cases and browser new-entry/reply flow; physical checks pending |
| Revocation / offline / races | Controller/API scenarios in existing communication/client suites | Temporary offline preserves authorized cached layout; logout/revocation clears data/media; late poll/detail/seek cannot restore it | Pass: existing isolation, stale-response, retained-offline and access-status controller cases |
| Full-width rows | Chromium 360px/tablet/desktop plus owner native screens | Edge-to-edge usable phone width, inner padding/safe areas, four requested lines, upper-right labeled icons and no horizontal overflow | Pass: browser 360px/390px layouts and screenshots; native exports pass; core iPhone width owner-confirmed, Android pending |
| Detail navigation | Browser scroll/focus assertions and owner iPhone/Android Back/Close tests | No bottom-of-list detail; overlay opens immediately; Close returns to same record position/filter/page; nested picker/menu closes first | Pass: browser Close/scroll retention and Escape; iPhone overlay opening owner-confirmed; native Back/accessibility pending |
| Patient context | Single-patient and isolated multi-patient caregiver/staff fixtures | Patient A has no redundant selector; caregiver switches only linked records; staff overview works; replies retain source patient/actor | Pass: single-patient hidden selector, caregiver-only linked options and staff overview |
| Reply and media flow | Extend `test:communications`, `test:message-client`, audio/video integrations with actual Chromium capture/play | Audio/video record/preview/send/retry/discard work from overlay; explicit draft handling; unsupported call choices disabled; supported call releases media | Pass: actual browser audio reply/video reply inside overlay and supported staff Video Call; native owner pending |
| Scrubbing | Real Chromium audio/video plus adapter interruption tests and owner phones | Finite duration/timing, actual seek response, paused stays paused, playing resumes, endpoints/cancel work; polls do not reset player; interruption prevents resume | Pass: actual paused audio/video seeks plus seek-intent/cancellation models; basic iPhone playback/scrub owner-confirmed; separate media/interruption/Android cases pending |
| Date picker | Shared date-model checks and browser/native year/month/day interaction | Leap dates/month changes, Cancel/Done/Clear/Apply, open range and invalid order work; picker draft survives polls; Pacific inclusive boundaries unchanged | Pass: shared leap/month/range validation and browser year/month/day/Cancel/Apply; basic iPhone date selection owner-confirmed, remaining cases pending |
| Accessibility | Browser keyboard/focus and owner VoiceOver/TalkBack/text scaling | Type labels, Close/Reply/picker/slider names, adjustable seek, reachable year/month/day and no clipped/overlapped header | Browser named controls/dialog/Escape exercised; VoiceOver/TalkBack/text-scale acceptance pending |
| Calling regressions | `test:accounts`, `test:native-calls`, `test:browser` and safe public calling checks; physical native matrix | Incoming/current/other-device call controls survive filters/overlays; call/background/logout interrupts capture/player; no unsolicited owner rings from smokes | Pass: existing local/public suites and incoming calls interrupting detail/calendar overlays; native matrix pending |
| General / saved identity | `typecheck`, `test:message-client`, `test:account-client`, `test:audio-messages`, `test:video-messages`, `test:browser-session`, `npm test` as affected | Current message/media/session/call contracts remain compatible | Pass: TypeScript, current media/account/session/unit/controller suites |
| Native / release | `doctor`, `bundle:check`, archive inspection; EAS preview/package checks; documented owner test | Both actual packages retain bundled UI/media/calling/push support; install over current builds; native acceptance reported separately | Doctor21, both exports/archive and final IPA/APK checks pass; core iPhone controls owner-confirmed; remaining device gates pending |
| Documentation | `python3 scripts/check_project.py`, `git diff --check` | Links/requirements/whitespace valid | Pass, 2026-11-19; documentation only |

Shared MariaDB suites run sequentially under the existing `phoneapp:test-suite` lock. No DB reset or migration suite is required for documentation-only planning. At implementation run checks appropriate to actual changes; expand DB verification only if persistent/API contracts change. Public checks use temporary synthetic sessions and avoid owner calls/messages. Record sanitized evidence under a dated report; private packages/screenshots/logs stay out of Git/EAS archives.

## Risks and recovery

Main risks: overlay/player remounts or incoming-call obstruction, lost scroll/draft state, late scrubbing restarting interrupted audio, hidden stale access from overaggressive caching, date/timezone drift and exposed nonfunctional Reply actions. Validate those paths before new preview builds; do not claim browser mocks or package inspection prove native audio/video behavior.

No data rollback is expected. Restore the prior schema-compatible browser assets/native preview if needed while retaining source records and private media. Preserve existing `ENABLE_COMMUNICATION_WORKSPACE` recovery semantics and old-client API paths; never revert to a pre-0007 schema-blind server or drop registry history. Browser publication/service reload, if needed, occurs between calls without changing other host applications or provider credentials. Record actual recovery commands/source only when used.

## Handoff

Source is implemented in `/home/ubuntu/phoneapp-stage16` / `feat/history-usability`, with ADR 0012 and shared calendar/seek/quiet-refresh checks. Browser rollout/public checks and final local checks pass. Both final previews/package checks and QR refresh are complete; core iPhone control acceptance is recorded in evidence; keep remaining hardware outcomes separate. [0015](0015-unified-communication-workspace.md) remains the parent for staff workflow and later processing; this document is the sole active implementation checklist for its UI follow-up.
