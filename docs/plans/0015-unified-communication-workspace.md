# 0015 Unified communication workspace, transcripts and clinical draft notes

Status: Stage A implemented/deployed to development; both native previews FINISHED/package-checked; owner device acceptance pending. Updated: 2026-11-19 UTC. The owner requested implementation after planning. Stages B–G remain planned. [Stage A evidence](../testing/2026-11-19-communication-workspace.md), [ADR 0011](../decisions/0011-communication-workspace.md).

## Outcome and scope

Replace the overlapping Call history and Communication history sections with one communication workspace. Providers can triage authorized communications across patients and open one chronological patient history. Patients see their eligible shared communications. A detail view connects the original content, transcript, reviewed clinical draft notes and staff discussion without conflating their audiences or lifecycle.

This brings together M2/M4/M5 and provides future M3 integration points. Requirements: PAT-05, TEAM-01–03, COM-05–06, COM-12, COM-14–16, TX-01–08, REP-03–06, TIME-04–08 and OPS-01–03 in the [PRD](../PRD.md). Builds on [0014 video messages](0014-video-messages.md), [0012 audio messages](0012-audio-messages-shared-history.md) and [0013 browser sessions](0013-persistent-browser-sign-in.md). [0007](0007-provider-patient-calls-transcripts.md) remains the broader live-call recording direction; this plan refines the workspace and processing order rather than treating that work as complete.

Included as sequential stages: unified existing history/detail; staff assignment/receipts/action state/comments; in-app text conversations; exact-original preservation for new media; post-message transcription; source-linked AI clinical draft notes with human review; linked staff work records. Later stages integrate consented live-call capture and Twilio/SMS sources after their prerequisites are selected and tested. Each stage must have a usable independent outcome; do not wait for telephone or AI credentials to deliver the unified log.

Outside this implementation: real-patient/production rollout, a complete organization/tenant administration system, automatic claims/billing eligibility, EHR integration, autonomous clinical recommendations, LLM tools that change patient records or send replies, and automatic patient publication of staff discussions/clinical draft notes. Existing patient assignment remains the access boundary for the synthetic practice; receiving a message ID or selecting a filter never grants access.

## Current evidence

- Canonical branch `feat/webrtc-poc`, baseline `50e61d9`. Native/browser audio/video messages and private media work, with owner-confirmed two-way phone/browser recorded video after the iPhone metadata fix. Remaining Android, media-control and call-interruption acceptance under 0011/0012/0014 stays open. [Evidence](../testing/2026-11-19-video-messages.md).
- `src/accounts/AccountPanel.tsx` and `web/accounts.ts` display account-wide call history and live Answer/End controls. `src/messages/AudioMessages.tsx`, `web/messages.ts` and `server/messages.ts` separately supply patient-selected combined call/message history. Consolidation must preserve the account-wide overview and active-call controls, including calls active on another enrolled device.
- Current history preserves call IDs and participant-based call access; published media messages use current patient/team relationships. `audio_messages.recipient_staff_id` is a care-team routing contact: for provider-originated messages it currently holds the provider's own ID. It cannot be blindly relabeled as the destination of every message.
- Six immutable migrations are applied to MariaDB `phoneapp`/`phoneapp_test`, with 24 domain tables plus the ledger. Migration 0002 supplies call-scoped consent, recording assets, transcript jobs/versions/segments and activity observations/reviews; no transcription worker/provider or LLM integration exists. Those call foreign keys cannot directly represent an independent recorded message. Preserve these tables and existing IDs when adding generic communication artifacts.
- The media worker retains normalized AAC/MP4/JPEG, then deletes a successful original upload. Exact original bytes from previously processed messages cannot be recovered by a migration. Existing seven-day media expiry, 1 GiB store/free-space floor and bounded processing remain current; retaining future originals adds storage demand.
- In-app text, SMS/Twilio, staff comments, per-viewer receipts, work ownership, resolution state, clinical draft notes and approved staff-time UI are not implemented. The current signaling/TURN path does not supply decoded two-sided call audio to the backend; a recording design is a separate prerequisite. Provider/model accounts, prices, credentials and processing policies are unselected/unverified for this plan.

## Product and workflow contract

### Classification, rows and grouping

| Dimension | Values / behavior |
| --- | --- |
| Format | Audio/video, audio, text. Show an icon plus accessible text; format describes content rather than the vendor. |
| Interaction | Live call, recorded message, text message. A future voicemail remains a recorded message associated with its originating call. |
| Channel | App, browser, telephone, SMS. Preserve actual source/direction; do not imply telephone/SMS is connected before implementation. |
| Stable identity | One communication wrapper for each logical call, published/pending media message or individual text message. Unique source mapping prevents duplicate entries across retries, imports and callbacks. |
| Related thread | Explicit same-patient relationship among text replies and related communications. Text threads can collapse into one display group, retaining individual message IDs/timestamps/statuses. Grouping never duplicates counts or erases evidence. |
| Work item | One action owner/status per communication by default; a text thread can share a work item so each short text does not create a separate task. A new incoming reply reopens its work item according to an explicit rule. |

Provider defaults: **Needs attention**, **Assigned to me**, **All**. Offer All/Calls/Messages, patient, format, recipient/assignee, channel, direction and date filters; advanced filters can include transcript/note processing state. Preserve selections on ordinary refresh and show applied filters/empty states. Filter authorization server-side, paginate stably, and calculate counts over authorized records rather than the visible page. Use deterministic date/ID tie-breakers; a reply moving a collapsed thread must not cause missing/duplicated pages.

In the practice overview, each row shows patient name/identifier, date/time, format/interaction icon, sender/direction, intended recipient, work owner, action badge and a duration/text preview. In patient history, keep patient identity in the header and avoid redundant columns. Store UTC; show an explicit chosen display timezone, with a documented default until the practice timezone is selected. Filter dates with the same timezone semantics, including day boundaries. Reading a history is not evidence of staff work time.

Distinguish immutable sender/original addressee from the current person handling work. Provider -> patient routes to the stable patient record, including pre-enrollment messages. Patient -> staff addresses an active authorized staff member. Backfill existing routing metadata explicitly by direction; preserve uncertainty rather than invent a named recipient. Team destinations can be represented in the design, but cannot be selected until real authorized team membership exists.

### Receipts, work state and assignment

Use separate state axes rather than one overloaded status:

- Asset/processing: uploading, processing, available, failed, expired; transcript/note each have their own job/review state.
- Viewer receipt: opened, playback started/completed where measured, or explicitly marked reviewed; actor, source version and time are retained. Opening/preloading a file or completing a download does not prove listening, comprehension or clinical review.
- Work state: proposed **Needs review**, **Needs response**, **Waiting for patient**, **Resolved**, with an explicit no-response-needed resolution reason. Record responsible staff member, who changed it, when and why. Display unread/new as viewer-relative information rather than shared task completion.

Playing/reading does not resolve a task. A successfully published linked reply can move the shared work item to Waiting for patient; failed/draft sends cannot mark Responded. Staff can resolve informational items without manufacturing a reply. A subsequent incoming message reopens Needs review and preserves prior resolution history. Reply counters/direction must derive from explicit links, not proximity in time or an internal staff comment.

Reassignment requires a current authorized staff target; designated recipient remains visible. Use versioned/conditional updates so concurrent staff changes cannot silently overwrite an assignment/resolution. Backfilled historical records start with unknown receipt/unspecified work state, not fabricated New/Heard/Resolved events or an unsolicited notification backlog. A configurable cutover defines new-item behavior prospectively.

### Detail and audience

| Section | Expected behavior / audience |
| --- | --- |
| Original | Play authorized media or read immutable original text; sender, intended recipient, time and source status remain visible. Original retention/availability is distinct from playback-derivative availability. |
| Transcript | Timestamped text for audio/video, speaker/endpoint labels, draft/reviewed version, corrections and source linkage. Text messages use their own original text; do not send text through speech recognition. |
| Clinical notes | Concise AI draft with source links/version and explicit review/edit/approve history. Staff-only in the first prototype. Any later patient publication requires a separate explicit audience policy and action. |
| Staff discussion | Staff-only comments/threads, author/time and revisions. Visually distinct from **Reply to patient**. Comments never count as a patient reply and are excluded from patient payloads, exports and default AI input. |
| Work and time | Assignment/action history and linked staff activity/review records. Keep this internal; source duration, viewing receipts and approved staff time are separate values. |

All child artifacts inherit current source/patient access. Preserve participant restrictions for existing calls; creating a wrapper or internal comment must not broaden access to the parent call. A staff recipient/assignment alone cannot bypass patient authorization. Current revocation applies to list/counts/detail, media, transcripts, notes, comments, search and exports; clearing/hiding a UI section is insufficient.

### Originals, transcription and AI notes

For new accepted audio/video messages, retain an immutable validated original upload with checksum plus the normalized playback asset/poster. Apply one explicit media retention policy across originals/derivatives; no public filesystem alias or direct provider URL. Old messages expose their retained playback copy and honestly report exact originals unavailable. Original text is immutable; edits create revisions. Retaining an original means retaining it for the configured period, not promising indefinite storage.

Keep the current seven-day synthetic media policy until deliberately changed; reserve original + derivative + temporary/extracted-audio bytes under existing disk quotas. Invalid/unpublished uploads still expire/clean up. Define transcript/note/comment retention separately before implementation: proposed POC unreviewed derivatives follow source expiry, while reviewed clinical notes/work history require explicit policy and must not silently disappear with a temporary media file. Metadata can retain unavailable source references. Neither longer retention nor a storage-limit increase is implicit approval in this plan.

Start transcription with saved audio/video messages, extracting audio from a validated private asset. Original playback must work if transcription is off, delayed or fails. Give each communication an explicit transcription preference/processing notice; do not interpret opening a clip as consent to a third-party upload. Require current authorization/retention at queue and publication, bounded leased jobs, attempt limits, idempotent result publication and actionable failure/retry states. Live-call recording/transcription consent remains separate from deliberately sending a recorded message.

A recorded message has a known submitting account/role, but may contain several physical speakers. Label it with source attribution and preserve unknown/uncertain speakers; never declare a recorded voice to be the patient/provider solely from sender identity. Consented live-call capture should preserve separate participant tracks and offsets where possible, with explicit uncertainty for shared endpoints. Transcript corrections create new versions with author/reason; prior versions remain traceable.

AI notes consume a pinned transcript version or immutable text-message versions, not a changing live thread. Initial scope: one communication; a later explicit selected same-patient group can reduce repetition across related items. Store exact source/version membership and validate access/patient consistency for every source. Record model/provider identifier, prompt/schema version, job/result state, generation time and human review history. A source correction or newly selected message makes an earlier draft stale; it cannot silently replace an approved note.

Draft notes should preserve relevant details, negation and uncertainty and avoid unsupported conclusions. Link assertions back to source segments/times/message IDs; generation must not invent certainty for missing text or silent media. Label **AI draft—needs review** until an authorized person reviews/edits/approves. Generated output and conversational text are untrusted data: use fixed generation instructions, output schema/length limits, and no model tools, autonomous actions or sending. A transcript containing instructions cannot change workflow/permissions, include another patient's context or publish a clinical decision.

## Implementation steps and release order

Each stage is independently testable. Create a focused follow-up plan when a stage needs a substantial provider/native integration; reference this parent scope instead of maintaining competing active plans. Later stages remain planned until implemented and evidenced. Do not label mock output as a live transcript or generated clinical note.

### A. Unified existing log and detail (first implementation slice)

- [x] Inspect current source/access contracts, schema ledger, active calls and capability negotiation in an isolated worktree. Record an ADR for communication identity, source mappings, audiences, migration/backfill, state axes and API compatibility.
- [x] Add an additive communication registry over existing calls/media, preserving original source IDs and current audience. Rehearse backfill/resume, uniqueness and pagination without changing call outcomes, media, enrollment or observed duration.
- [x] Implement one provider overview and patient-specific timeline/detail, replacing duplicate history sections only after existing information/controls have a home. Preserve active incoming Answer/Decline/End/multi-device state outside archive filters and retain calls whose recording/transcript is Off.
- [x] Add format/interaction/channel/direction metadata, patient/recipient display and stable authorized filters/grouping. Unknown/future channels are read-only placeholders, not functioning telephone/SMS buttons.
- [x] Keep old API/native history paths until updated clients are installed; add version/capability negotiation for the workspace. Compare old/new authorized source counts, IDs and ordering before defaulting to the new UI. No mandatory re-enrollment.
- [x] Verify browser layout (including 360px detail), empty/error/client stale-response/reload states and existing call/audio/video/receipt-free history regressions; native exports/Doctor/archive and iPhone package pass. Document actual Stage A outcome in evidence.
- [x] Complete both native preview builds/package verification and refresh install QR codes.
- [ ] Owner iPhone/Android layout/media/call acceptance. Keep hardware results separate from automated checks.

Owner iPhone follow-up before Stage B: installed 8fadedcf shows unified filters/rows/detail, but bottom-of-list detail placement and visible four-second polling cause inconvenient navigation and flicker. Overlay versus inline expansion is under discussion; recommended overlay preserves list position, with quiet change-only refresh. No implementation yet; see current evidence.

#### Owner presentation proposal (discussion; not implemented)

- History card uses the phone’s full usable horizontal width, removing outer gutters while retaining inner text padding and device safe areas. Each record starts with patient name and patient ID, then existing date/time/direction/status and duration/review status. Place the call/audio/video icon at the upper right; remove visible App call/Audio message/Video message headings and the list’s sender line. Keep meaningful accessibility labels for type icons.
- Detail becomes a full-width overlay above the retained list, with independent scrolling and a fixed upper-right Close button. Restore the same list position/filters on dismissal. Remove message-type heading, duplicate From text, Channel, Original, exact-original technical copy and bottom Record reply/Close detail buttons. Retain accurate backend metadata and availability handling; this is presentation simplification, not a change to source retention.
- Show separate From, To and Date/time lines. Use name and role where useful, avoiding duplicated sender metadata. Add a Reply menu directly below Close with Video Message, Video Call, Audio Message and Audio Call choices. Recorded audio/video reply can use existing capture; live call availability must reflect role and implemented capability. Patient-originated live calls and a distinct App Audio action remain unimplemented. Do not expose an enabled action that cannot complete.
- Put accessible play/pause on the lower-left video surface/poster instead of a separate Play video message button. Keep loading/failure/expired-media feedback in the same stable area; preserve native call interruption and one media owner. Audio can use a compact player with the same control convention.
- Owner also requests a draggable scrubber for both video and audio, with elapsed/total time. Video places its seek timeline along the lower playback controls; audio uses a compact playback bar. Seeking preserves playing/paused state, uses verified media duration and remains unavailable until seekable media is ready. Keep controls accessible, stop playback on detail dismissal/call interruption, and keep seeks separate from future staff-time evidence. This belongs to the same pending UI iteration.
- Preserve the prior quiet-polling proposal. Future CC/Forward fits directed communication, but needs explicit recipients/access and source/reply/forward relationships; it is not implemented by removing labels or adding a menu. Forwarding must preserve original authorship.

### B. Staff workflow, receipts and internal discussion

- [ ] Implement append-only receipt/assignment/workflow/comment events and current projections. Separate actor-relative receipts, original addressee and mutable work owner; use explicit reply links and conditional updates.
- [ ] Add Needs attention/Assigned to me/All with actor-aware counts, assignment/reassignment, no-response-needed resolution, reply-completion rules and reopening on new incoming content. Do not make playback/AI processing/idle polling resolve work.
- [ ] Build staff comments with clear internal labeling and revision history; prevent them entering patient detail/notifications/AI input or being counted as replies. Enforce permission checks at the API/worker layer.
- [ ] Add isolated synthetic RN/MA/second-provider fixtures to test collisions and staff attribution. Do not expose a shared enrollment/login or imply this delivers organizations/team onboarding. Verify historical receipts remain unknown and cutover creates no fake notifications.

### C. In-app text and thread grouping

- [ ] Add authorized patient/staff text compose/send/reply, stable retry keys, immutable text revisions, delivery/availability failures and text-thread grouping in the same log/detail. Server validates lengths and renders text safely.
- [ ] Preserve individual text IDs, sender/time/version and directed recipients inside collapsed threads. Share thread work state deliberately and reopen it on new incoming messages. Text and media replies can be linked without treating an internal comment as a response.
- [ ] Apply the same pre-enrollment patient identity, current audience, filtering, retry, version/receipt and time-link contracts. Start with visible refresh/foreground discovery; ordinary background-message pushes need a later explicit notification implementation. Never reuse call VoIP pushes for messages.
- [ ] Keep Twilio SMS/provider callbacks absent until Stage G. Build adapter contracts/fixtures now; a synthetic provider callback test is not evidence that actual SMS delivery works.

### D. Retained originals and saved-message transcription

- [ ] Implement immutable original asset references, normalization lineage/checksums, authenticated retrieval where supported, resource reservations and coordinated expiry/cleanup/backup. Existing missing originals remain unavailable; do not reconstruct or relabel a derivative as the exact upload.
- [ ] Select a speech service through a documented capability/format/language/attribution/retention/cost evaluation using synthetic clips. Verify current official documentation, credential availability and spending scope at implementation. Keep a provider adapter, bounded jobs and deterministic fake transport for tests; do not default to a local model on this shared EC2 without a resource benchmark.
- [ ] Implement preference/notice, audio extraction, queue/retry/cancel/lease/restart, provider response validation and versioned communication transcripts with source/role uncertainty and corrections. Persist submitted job identity so a timeout/retry cannot blindly duplicate billable external requests.
- [ ] Demonstrate actual saved audio and video transcription and source playback on browser/iPhone/Android, including Off, uncertain speaker, failure, correction, expiry and access revocation. Do not enable live-call capture in this stage.

### E. Clinical draft notes and human review

- [ ] Select a text-generation service/model using a small fixed synthetic evaluation set, documented privacy/retention/cost settings and the source-bound schema. Verify credentials/budget before live requests; EAS spending authorization does not itself approve a new provider subscription.
- [ ] Queue notes for pinned transcript/text versions. Implement source membership, bounded input/output, review/edit/approve history, stale-draft detection, explicit regenerate and failures independent of communication availability.
- [ ] Display Original/Transcript/Clinical notes/Staff discussion with correct audience, draft labels and source navigation. Single-item notes first; grouped notes require explicit same-patient selection with preserved message/segment links.
- [ ] Test repeated statements, conflicting/corrected information, negation, uncertainty, missing/partial transcription and malicious instructions in source text. Require human evaluation against source for live model output; structural test success is not evidence of clinical accuracy. No automatic patient send or work resolution.

### F. Linked staff work records

- [ ] Link the existing observation/review model to communication and staff identity without crediting clip length, a receipt or AI runtime. Add manual work entries first; measured review/composition sessions need foreground/idle/background rules and staff correction.
- [ ] Preserve original seconds/intervals and append-only review decisions, detect same-staff overlaps/duplicate source events and retain valid separate staff contributions. Show totals with observation/review status and explicit timezone, without automatic billing approval.
- [ ] Include the work links in staff detail only. Full payer allocation/export/claims logic remains separate; this stage supplies source-linked evidence rather than reimbursement rules.

### G. Live-call capture and telephone/SMS source adapters (dependency-gated)

- [ ] Before app-call transcription, choose and prototype an authorized recording/media-receiving design that can capture both actual participant tracks. Signaling/TURN logs are insufficient. Record an ADR and a focused integration plan for media route changes, capture consent/off/partial intervals, separate roles/tracks, liveness, resource/cost impact and native call/background/audio routing regression.
- [ ] Preserve unrecorded calls when capture is declined, unavailable or fails. Publish retained consented call audio and post-call transcript into the same detail using the existing call IDs/participant constraints and generic artifact links. No silent capture of muted/unsent microphone audio.
- [ ] Implement Twilio voice/SMS as separately planned integrations with verified account/number/credentials, routing ownership, signatures, durable provider IDs, duplicate/reordered callbacks and multiple call legs. A raw caller number is a matching candidate, not verified patient identity; unknown/shared contacts stay unresolved outside patient-visible history until authorized matching.
- [ ] Normalize telephone audio/voicemail and SMS into the same format/interaction/channel model. Later verified patient enrollment reuses the stable patient record and eligible retained history. Telephone voicemail stays audio-only. Preserve original provider/source IDs and raw text revisions while stripping secrets/media URLs from logs.
- [ ] Complete physical and live-provider synthetic acceptance before marking these adapters implemented. Preserve earlier calling and media gates; existing app calls/messages continue working while an adapter is disabled.

## Data and configuration

Stage A adds **0007_communication_registry.sql**, the append-only registry, `/api/communications` contracts and `ENABLE_COMMUNICATION_WORKSPACE` (default false). It is applied to test and development after snapshot/preservation/grant verification. Other additions below remain proposed. Use incremental additive migrations per stage, exact `phoneapp_test` rehearsal and preservation/backfill recovery before `phoneapp` application. No applied migration or source ID is rewritten. Plan final table/index/FK details in the implementation ADR.

| Proposed addition | Persistence contract |
| --- | --- |
| Communication registry / thread membership | Explicit nullable source FKs with an exactly-one-source constraint for a leaf communication, unique source mapping and patient consistency; add necessary source composite keys. Do not rely solely on an unchecked polymorphic source ID. Backfill/resume without duplicate records or fabricated workflow events. |
| Recipients, receipts, work items/events, comments/revisions | Original logical patient/staff destination, immutable actor/time/version events and mutable projections with revision checks. No selectable team without membership. Patient-facing queries cannot serialize internal comments/work state. |
| Text messages/revisions | Durable original text, source/version/retry/thread identity, patient/recipient association and timestamps; no SMS transport before its adapter. |
| Generic assets, processing jobs, transcripts/segments, note versions/source links/reviews | Communication-scoped records with source/patient FK consistency and append-only provenance. Existing call-scoped `recording_assets`/`transcript_*` remain intact, with explicit bridges/read adapters rather than fake call IDs or weakened constraints for messages. |
| Activity links | Additive links to existing observations/reviews while preserving staff/patient/call relationships, source deduplication and original durations. |

Preserve backend-only credentials and current private media root. Proposed independent feature gates cover workspace, staff workflow, text, saved-message transcription, AI notes and call recording; names are settled in implementation. No new secret value, key or client-public provider credential is part of this plan. Provider/model/configuration and per-user/day, job concurrency, request size/token, cost and retry limits need an ADR and names-only examples before enabling paid work. Explicit no-provider/off behavior keeps source communications usable. New tool commands are proposals until implemented; add them to [tools](../TOOLS.md) only with working evidence.

Current 1 GiB store, free-space floor and one converter must cover retained originals, normalized output, posters and extracted audio. Benchmark/reserve those bytes before changing the media lifecycle; no automatic quota/retention increase. Reviewed artifact deletion/expiry must follow the selected policy without erasing audit/source references. Back up DB and files together and rehearse restoration with old audio/video, new text/work state and generated versions. Runtime grants remain explicit and least privilege; immutable histories are not rewritten with broad UPDATE/DELETE privileges.

## Acceptance and verification

Stage A source and automated checks are implemented; see the [evidence](../testing/2026-11-19-communication-workspace.md) for actual results and release/device gates. `test:communications` and `test:communication-client` are runnable. Stages B–G have not run; no model-evaluation command exists.

| Scenario | Required evidence / exit criterion | Current result |
| --- | --- | --- |
| Existing-source consolidation | Calls/media appear exactly once with preserved IDs, outcomes, media and source-specific audience; old clients still work; active call controls survive filters | Local DB/API/browser and public 34-source parity/reload/Range checks pass |
| Overview/patient grouping and filters | Authorized all-patient overview plus patient timeline, accessible type icons, stable pagination/counts/date boundaries, explicit text-thread expansion | Existing call/media filters and Pacific DST pass; text threads remain Stage C |
| Work and viewer semantics | Two staff accounts can listen/assign/reply/resolve independently; stale writes rejected, failed reply does not resolve, new incoming reopens, historical receipt is unknown | Not run |
| Internal versus shared audience | Patient/caregiver cannot obtain internal comments/notes/work records via list/detail/media/export or hidden routes; reassignment/revocation and derived source access remain enforced | Not run |
| Text/reply reliability | Real browser/native in-app text/reply, retries/revisions and grouped counts are correct; no claim of SMS delivery from fixtures | Not run |
| Original retention / history upgrade | Existing 0006 data/auth/media survive additive migration/backfill; unavailable originals are honest; new original hash and derivatives/expiry/space reservations/restore pass | Not run |
| Saved-message transcription | Actual selected-service synthetic audio/video conversion and attributed versioned transcript; Off/failure/restart/correction/uncertain speakers preserve media/history | Not run; service/credentials unselected |
| AI clinical draft notes | Pin text/transcript versions, trace claims to source, validate same-patient grouping, human review/correction/staleness and prompt-injection resistance; live output evaluated against synthetic source | Not run; service/model unselected |
| Staff time evidence | Source-linked manual/measured/reviewed entries preserve original seconds, actor and overlap history; no time credit from playback receipt, clip duration or job wall time | Not run |
| Live-call/telephone/SMS integration | Consented two-sided capture or real provider callback/media evidence, role/offset/partial/off handling, routing/matching/idempotency and physical calling regression | Not run; later integration dependencies |
| Existing regressions / deployment | TypeScript, relevant current call/audio/video/client/account/native/browser-session/DB suites sequentially where shared; native exports/Doctor/package and physical checks when needed; project-only rollout between calls | Local suites, exports/Doctor and public rollout pass; native package/device gates tracked in evidence |
| Plan integrity | `python3 scripts/check_project.py`, `git diff --check` | Pass; documentation/whitespace only |

Use current scripts from [testing](../TESTING.md) for each affected area. Multi-staff fixtures remain in the disposable target. Tests must cover failed/reordered/retried jobs, duplicate source import, partial backfill, access revocation during processing, media expiry while queued, source corrections during note generation, staff race/conflict and source/derived cross-patient linking. Real provider evaluation and phone controls remain separate from mocks/compilation. Explicit public smoke actions use synthetic data and must not send unsolicited calls/messages to owner devices.

## Risks and recovery

The main risks are broadening audience when merging histories, confusing receipts with completed work, losing exact originals, mismatching derived artifacts to source versions, stale or unsupported AI output, and interfering with native calls while recording. Enforce source-specific access and provenance, explicit human review and bounded independent jobs. Transcription/AI failures must never remove a communication or stop its playback.

Roll out each stage behind its own gate. Hide/disable the new workspace or processing stage using schema-compatible code while keeping legacy calling/message routes and source records. Stop future external job submission before draining/canceling in-flight work; preserve job/provider IDs to reconcile unknown outcomes rather than blindly retrying. Do not switch to an older schema-blind binary, drop backfilled history or delete accepted work to revert a UI change. Real data use and organization-wide tenancy need their own readiness work.

## Handoff

Stage A is implemented in `/home/ubuntu/phoneapp-stage15` with ADR 0011, registry migration and passing local workspace/media/call regressions. Development rollout is verified with all 34 authorized sources retained exactly once and all 13 public call cases passing. Both native previews/package checks pass and install links/QRs are ready. Owner device acceptance remains pending; continue Stage B with the earlier source/call/media/device gates preserved when proceeding. Subsequent stage work follows the evidence gates above; transcription/model choice, source retention beyond the POC, future patient note publication, practice timezone and live-call media design remain explicit decisions rather than reasons to delay the first UI/workspace slice. Preserve [current state](../PROJECT_STATE.md) and existing physical acceptance gates.
