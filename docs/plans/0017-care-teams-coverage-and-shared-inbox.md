# 0017 Care teams, role coverage and shared communication inbox

Status: ready for implementation; planning complete, implementation not started. Updated: 2026-11-19 UTC. No schema, runtime, service, credential or native build changes were made to write this plan.

## Outcome and scope

An office manager defines care teams, places eligible individuals in PCP/RN/MA roles, manages coverage and associates patients with a stable team. Patients communicate with that team. An authorized team member can take the first pass, claim appropriate work, request review, defer, or delegate under the owner's hierarchy. Every unresolved item stays visible with an accountable person or queue; staff discussion and work history remain internal.

This executes [0015 Stage B](0015-unified-communication-workspace.md), building on the deployed [0016 UI](0016-communication-history-usability.md) and [registry ADR 0011](../decisions/0011-communication-workspace.md). Requirements: TEAM-01–04, COM-12, COM-14–15, COM-17, PAT-01, PAT-04–05, REP-04–06, TIME-04 and OPS-01–02 in [PRD 1.5](../PRD.md). This focused plan is the sole implementation checklist for this increment; the parent retains the later product roadmap.

Deliver in three usable releases: **team/coverage management**, **team intake and claims**, then **complete handoffs/internal work**. Complete this plan only after all three releases and their recorded acceptance; an initial roster release does not implement the entire inbox.

Included: individual synthetic staff enrollment, narrowly authorized office-manager management, team role/membership/coverage, patient-team association, team-addressed recorded messages, an internal inbox, atomic claims, review requests, downward delegation, universal deferral, manager exceptions, independent receipts/work state, comments, explicit reply links and audited transitions.

Later scope: full multi-organization/self-service onboarding or credentialing, CC/Forward to additional audiences, text/SMS, transcription/summary, retained exact originals, automatic staff time credit/billing, new patient-originated live calls, Audio Call, ordinary background work notifications and recurring workforce scheduling. Current native calling/push, media limits/retention, source IDs and remaining physical gates must survive.

## Current evidence and constraints

- Current development ledger was read for planning: **0001–0007 applied, no pending migrations**. There are 25 domain tables plus ledger. Recheck before implementation; next expected migration is 0008. Planning did not migrate or reset either target.
- `users.role` currently has one primary role: practitioner, rn, ma, admin, patient or caregiver. `patient_assignments` has patient/staff links without team/provenance; there is no team, roster UI, coverage, work item or workflow event service. `AccountsStore.permitted`, message access and communication queries separately use these relationships. Authorization changes must cover all those paths, not just a new inbox endpoint.
- `audio_messages.recipient_staff_id` is currently a non-null user FK and is a routing contact, not always the logical destination. Provider-originated messages use the sender as that contact. Team addressing needs an explicit destination design; do not insert a team ID or fictitious person into a staff FK.
- Calls require both current patient access and call participation. Published recorded messages use current patient relationships; unpublished/failed drafts remain sender-only. New team membership or task assignment cannot implicitly broaden old call access.
- `communications` wraps calls/media once with patient-consistent FKs and preserved source IDs/time. Messages publish after verified conversion. No receipt, work state, response links or staff comments exist yet; current historical review status is Not recorded.
- The seed/enrollment utility supports the original synthetic Provider and Patient A/B/C, not a staff directory or public signup. Browser login is shared by one browser profile. Native enrollment/push/signing already work and must not be regenerated for new staff roles.
- The current native bridge distinguishes 401 and HTTP 403/404 access failures, but does not yet expose a typed workflow 409 conflict. New work controls must carry conflict/version outcomes end-to-end on native and browser without parsing English error text; extend the bridge if needed while retaining existing auth behavior.
- Current source is on canonical `feat/webrtc-poc`; stage16 is the prior build/audit worktree. Owner confirms core iPhone history/no-jump/overlay/playback-scrub/date controls on 1f6e7abd. Android and detailed media/Reply/interruption/accessibility checks remain open. See [0016 evidence](../testing/2026-11-19-history-usability.md).

## Confirmed rules and initial prototype defaults

The delegation hierarchy and universal right to defer are owner requirements. Defaults below make the first implementation concrete; they are proposed operational choices, not claims that they are already implemented or a clinical scope-of-practice decision engine.

### Roles, membership, coverage and patient assignment

| Concept | Meaning / boundary |
| --- | --- |
| Individual identity / authorized role | The actual staff actor and their permitted capabilities. PCP is the care-team function of an eligible practitioner. Assigning coverage does not promote an MA into an RN/PCP. |
| Office-manager capability | Manage authorized team rosters, coverage and patient/team associations; handle operational exceptions. It does not itself grant clinical/source reading, claim, delegation or clinical resolution rights. A person with both responsibilities needs both grants explicitly. |
| Team roles and membership | Stable PCP/RN/MA positions with eligible people, effective membership and history. No shared team login. A staff member may belong to more than one team, with access evaluated per patient/source. |
| Coverage | Who is available for a role now, separately from membership and clinical access. Absence does not remove the patient from the team or erase work. |
| Patient association | One active primary care team per patient in the initial prototype; caregiver access to multiple patient records remains separate. Retain effective association history and original communication destinations. |
| Work routing / ownership | A current team/role queue and at most one claimed individual owner, independently of original addressee, requested reviewer and viewer receipts. |

Initial team setup: managers may save incomplete **Draft** teams. Following the described composition, patient assignment to an active team requires at least one eligible PCP, RN and MA member. Membership minimums are distinct from who is available that day. Coverage gaps keep the team/inbox intact, flag manager attention and allow intake to continue. Removing the last required member or archiving an assigned team needs a replacement/reassignment workflow rather than an orphaned patient. Record this activation policy in the implementation ADR.

Start coverage with explicit Available/Unavailable overrides, optional explanation and effective intervals; no calendar/HR integration or recurring shifts. Store UTC intervals and display Pacific time as the existing prototype does. A Today shortcut uses actual Pacific day boundaries, including 23/25-hour days. Coverage changes and expiry are evaluated server-side. Exclude unavailable people from default named delegation suggestions; an otherwise authorized member may explicitly accept/claim despite their availability indicator, with that override recorded. Availability is not an access credential.

Roster editing is a dedicated management permission. Keep source clinical access separately checked. For the first prototype, eligibility can use the existing controlled synthetic practitioner/rn/ma directory; managers choose among those roles and cannot grant professional privileges through a team form. Do not present this as production credential verification.

### Team intake and source compatibility

New patient/caregiver messages address the patient's currently authorized care team. The team inbox has no mandatory MA-first, RN-first or PCP-first intake order. Staff replies show the actual actor/role and, where relevant, the team they represented. An explicit directed reviewer is distinct from the patient's intended recipient.

Preserve every historical direct recipient; never relabel all old messages as team-addressed. Give new messages an explicit immutable team destination and patient-team association reference. Team membership/association changes can alter current authorization and operational routing, without rewriting that original address or copying records into a new patient history.

Before enabling team sends, an ADR must settle the additive message destination schema and versioned contract, including the current non-null staff contact field. A legitimate team message may have no individual staff addressee. Never manufacture a staff actor just to satisfy a legacy constraint. Add compatible expansion/serialization or a tested legacy adapter; retain existing source IDs and private media grants. A legacy handler may translate an authorized team-contact reference into an explicit team destination, but team IDs must not become user/sender FKs or bypass patient authorization.

Old patient/media/calling paths remain supported. Old direct sends retain their actual original destination and may enter the patient's configured operational team queue without pretending the original address was different. Updated team sending and workflow UI use advertised capabilities. Test older clients' read/play/reply behavior before cutover; do not silently hide new published messages or claim an unlinked legacy reply completed a work item. If a mutation requires a newer capability, provide a tested upgrade/cutover path while preserving calling, sign-in and existing history.

Legacy access needs explicit provenance. Merely adding team membership beside existing direct `patient_assignments` can leave an old team with unintended access after reassignment. Inventory/classify those grants, preserve genuine independent direct access and explicitly adopt selected synthetic grants into team-managed access during pilot cutover. Define the effective access resolver/projection in the ADR. Do not silently delete direct grants or assume all legacy links should survive a team move. Test old-team loss/new-team access and existing call-participant constraints across history/media/grants as well as the inbox.

### Claim, request review, delegate and defer

| Action | Eligible actor | Effect |
| --- | --- | --- |
| Claim | Any current source-authorized clinical team member taking appropriate unowned work | Atomic ownership acquisition; no mandatory first-pass role. Claims do not remove required review or grant new permissions. |
| Flag / Request review | Any such team member | Ask a role/person for review with an internal reason. This does not force the reviewer to own the item or steal someone else's claim. |
| Delegate | Current owner, according to the matrix below | Offer work to an eligible lower role or named member. Recipient can accept or defer. |
| Defer | Any clinical role on unclaimed work or its claim, offer or review request | Record inability/unavailability/scope reason and maintain visible unresolved routing; no higher-role permission is needed to decline. |
| Manager route / arrange coverage | Authorized office manager | Resolve an operational routing gap through coverage or authorized reassignment; not a clinical delegation or clinical completion. |

| Acting role | May delegate to | May defer |
| --- | --- | --- |
| PCP | RN or MA | Always; requires office-manager attention |
| RN | MA | Always, including PCP-delegated work |
| MA | Nobody | Always, including PCP/RN-delegated work |

The rank controls delegation authority only. Do not infer that the application can determine a clinical task's suitability from its text. Users assess capability; separately configured review/source permissions remain enforced. Same-role or upward help uses a review request/deferral rather than disguising it as downward delegation. A manager's operational capability cannot be used to bypass clinical/source access checks.

A member may defer an unclaimed item without first claiming it. Record their personal decision and keep an accountable queue; do not make it disappear for other members. A personal inability to handle an item already owned by someone else must not remove that person's claim. Declining one's own claim, offer or review request has the corresponding release/decline effect below. PCP deferral still raises manager attention.

Initial handoff default: delegation is an **offer with acceptance**. The giver retains coordination ownership while a named recipient or eligible role-pool member considers it. Acceptance atomically transfers the one owner. Named refusal withdraws the offer and leaves the giver aware/responsible; role-pool refusal records that person's decision while other eligible members can accept. The giver may withdraw or defer at any time; that invalidates stale offers. No automatic silent acceptance or timeout resolution. Anyone can still request review while another person owns the main work.

Review requests have their own state and actor history. Requested review can be completed, deferred or withdrawn with attribution. Opening/playing a clip is not completion of a required review. An owner can continue coordinating, but cannot resolve an item with outstanding required review; requester withdrawal must be explicit and recorded. Review flags do not allow unilateral takeover of an existing owner.

Initial deferral routing defaults:

- Unavailable/capacity: return to the relevant role/team pool; preserve other people's ability to claim.
- Scope/capability: MA defaults to RN review and may request PCP; RN defaults to PCP; there is no mandatory initial intake ladder.
- Uncertain destination: keep visible in team review with an operational routing flag.
- PCP deferral: retain unresolved work and create a sticky manager-attention exception. Manager arranges qualified coverage/reassignment; claiming by another person alone does not erase that exception or simulate clinical review.
- No eligible coverage, repeated circular handoffs or an invalid named target: preserve queue responsibility and expose manager attention, rather than drop the item or automatically resolve it.

These are prototype defaults to record/configure in the implementation ADR. Reasons should support quick categories with optional internal detail; deferral is not contingent on a supervisor approving it. Manager screens receive the operational category/assignment metadata they need. Clinical free-text reasons and source content require separate source access. Clearing an operational exception records an actual route/coverage outcome and acceptance; it does not resolve the clinical work.

### Independent state, receipts, comments and responses

Keep these axes distinct:

- Source/media availability, including pending/processing/available/failed/expired.
- Work state: Needs review, Needs response, Waiting for patient, Resolved, with a no-response-needed reason where appropriate.
- Ownership/routing: unclaimed role/team queue, current individual owner, pending offer and requested reviewer.
- Operational flags: coverage gap, manager attention or stale assignment.
- Viewer receipt: opened, playback started/completed if actually measured, explicit Mark reviewed; actor/time/source version. Prefetch, download and polling create no viewing receipt.

Use append-only action/receipt/comment revisions plus a current versioned projection. Every mutation has an idempotency key and expected work version. Document a consistent lock order across roster/access and work mutations, with bounded retry/idempotency behavior. Two claims/acceptances/resolutions race safely; one wins, the other receives a clear conflict and reloads. Repeated retries do not duplicate work events or patient messages. Store original seconds/times without inventing staff time from a receipt, clip length, delegation or queue waiting.

Staff discussion is visibly Internal. Only currently source-authorized staff can read/comment; patients/caregivers and an operational-only manager cannot obtain it through hidden routes, list/count payloads, detail, media, export or notifications. Start with bounded plain text, author/time and append-only edits to one's own comment; no hard deletion or attachments in this slice. Comments never count as patient replies or default AI input.

Make media responses explicitly source-linked. Same-patient reply chains can share one work root: an initial incoming communication creates a work item, its published staff reply links to that root, and a later explicitly linked incoming response reopens it. Unrelated messages from the same patient start separate work; do not group by timestamp/proximity. The communication log still retains every source once; the staff inbox counts work items, not duplicate leaf messages. Broader text-thread grouping remains Stage C.

Workflow Reply requires ownership or an explicit authorized handoff; an unowned item offers Claim and reply. Preserve patient/team and original response links throughout recording/upload/retry. Failed/draft uploads do not mark Responded. Only a published authorized reply may move current work to Waiting for patient, with conditional ownership/state checks. Media publication and workflow effects have distinct outcomes: a late accepted/published reply must not overwrite a newer handoff/resolution or be deleted to make state agree. Surface a reply-after-handoff conflict for review. A retry returns the already committed outcome, not another delivery. Legacy unlinked sends remain standalone and never silently complete another item.

### Coverage changes, cutover and history

Roster/coverage edits must deal with unresolved work atomically: withdraw invalid offers, identify owners who lost authorization, and retain the work in an eligible role/team queue or manager exception with a recorded reason. Absence alone does not revoke source access or erase a claim's history. Patient reassignment preserves patient/communication/media IDs and original addresses; current routing and authorization are reevaluated explicitly. Do not silently send a draft to a different team/person after a membership change; require an explicit destination check/retry.

Use a recorded prospective cutover for automatic inbox creation on new **published incoming** communications. Drafts/failed unpublished media remain sender-only. Existing history starts Not recorded, with no fabricated New/Heard/Resolved events or bulk notifications. A source-authorized staff action can explicitly queue an old item for review, recording that present-time decision. Outgoing messages do not create incoming work unless an explicit staff task is created. Reopening through a linked incoming reply is idempotent.

Work creation/publication/route changes must be transactional or use a durable retryable outbox so a converter crash/restart cannot lose or duplicate inbox work. Recheck authorization and destination before publication, preserve already accepted source identities, and distinguish processing delay from staff handling time.

## UI and demonstration

Office manager: Teams, role members, coverage, patient assignments and an operational Manager attention queue. Display active/draft/gap states and explicit consequences before a roster change affects pending work. The manager may route operational exceptions without automatically receiving a recording/player or internal clinical text.

Clinical staff: Needs attention / Assigned to me / All, plus team/role/owner/review/manager-flag filters and the existing patient/type/date filters. Show **To**, **Assigned to**, **Review requested from**, work state and pending acceptance separately. Reuse full-width patient-first records, quiet refresh, stable pagination/counts and the retained-position detail overlay. Work actions live only in the authorized staff view; patient history retains shared content and their own access boundaries. Unavailable roles show a useful coverage state rather than an enabled no-op.

End-to-end synthetic acceptance: manager creates Team A with PCP/RN/MA and associates Patient A; Patient A sends a team message; MA claims and defers for RN review; RN claims and defers to PCP; PCP claims and delegates to RN or MA; target accepts or exercises Defer; a valid published response moves to Waiting for patient and explicit resolution is recorded. Separately, PCP defers to manager attention, manager arranges alternate eligible coverage, and that clinician accepts. Test RN→MA, invalid MA→RN and invalid RN→PCP delegation directly at the API, not just hidden buttons.

Keep the owner's iPhone Patient A identity and existing history. Add separate fictitious manager, RN/MA and backup provider accounts through a controlled allowlisted seed/enrollment extension, with disabled-until-enrolled users, one-use private codes and no shared passwords. Browser profiles/isolated contexts must not share their saved-login cookie. Do not silently enroll/revoke/change the owner's current phone accounts. Onboarding genuine staff and production identity is separate.

## Implementation steps and release order

### A. Care-team and coverage management: first usable release

- [x] Inspect current source/access/schema/enrollment constraints; read development ledger without mutation and consolidate owner rules.
- [ ] Create a new isolated worktree from canonical `feat/webrtc-poc`. Record an ADR covering capabilities, membership/coverage, activation defaults, legacy-access provenance, destination compatibility and source audiences.
- [ ] Add ordered migrations starting at the rechecked next number; test clean install, populated 0007 preservation, constraints, failure recovery and scoped runtime grants.
- [ ] Add controlled synthetic staff profiles/capabilities and private enrollment aliases. Preserve existing users, source IDs, patient/caregiver bindings, sessions and push credentials.
- [ ] Implement backend-authorized manager team/role/member/coverage/patient association APIs with revisions/audit and management UI. Keep clinical access separate, including operational-only manager tests.
- [ ] Implement/rehearse explicit access-provenance pilot mapping and safe pending-work effects before patient reassignment. Existing direct calling/media continue; no fake team destinations.
- [ ] Release roster/coverage management after local/public synthetic checks and document exact outcome before enabling team intake/workflow.

### B. Team intake, shared inbox and claims

- [ ] Implement explicit team destinations and a compatible message/context contract, patient-facing team selection and stable original-address display. Demonstrate actual audio/video send→publication→team visibility without rewriting old destinations.
- [ ] Add work roots/events/current projections, durable publication capture and prospective cutover; preserve old history with unknown work/receipt status.
- [ ] Implement source-authorized inbox/counts/filtering and atomic Claim/Release with expected versions, idempotency and stable quiet UI. Verify multi-team and caregiver separation.
- [ ] Implement independent viewer receipts and explicit Mark reviewed, preserving the difference between playback and work completion.
- [ ] Release a complete team intake→claim→review demonstration, preserving older client history/calls and the existing media resource envelope.

### C. Handoffs, internal discussion and response lifecycle

- [ ] Implement non-forcing review requests, accepted downward delegation, universal deferral and manager exceptions, with the confirmed hierarchy and audited prototype routing defaults.
- [ ] Implement absence/roster change handling, invalid/declined offers, concurrent claims/accepts and circular-route visibility. No invisible/unowned unresolved work.
- [ ] Add private staff comments/revisions and permission tests for patient/caregiver/operational-manager exclusion.
- [ ] Link actual published replies to work roots, preserve drafts/destination, conditionally transition Waiting for patient, reopen on explicit incoming replies and support reasoned manual resolution. Handle late publication versus changed ownership without duplicate delivery or false completion.
- [ ] Complete both native/browser role flows, archive/Doctor/export checks, safe development rollout and bundled iPhone/Android previews/package/QR handoff. Record owner hardware outcomes separately.
- [ ] Update evidence/state/work log/tools/database/migration execution details with the actual release results. Parent Stage C and later features remain unimplemented until their own work is completed.

## Data and configuration

All additions below are proposed; exact table/index/flag/endpoint names belong in the implementation ADR and committed migrations. **No migration file or new command is created by this plan.**

| Proposed persistence | Contract to preserve |
| --- | --- |
| Team, role positions, membership, capability grants, coverage history | Individual user IDs, role eligibility, effective UTC intervals and audited revisions; one manager capability does not imply clinical access. |
| Patient-team association and access provenance/projection | Stable patient ID; one active primary team; current grants versus historical association; explicit adoption/revocation of managed legacy links. |
| Logical destination / routing metadata | Patient-consistent source/registry FKs, immutable original staff/patient/team destination, legitimate nullable individual contact where required, independent current work route. |
| Work roots, communication/reply links, current projection and events | Same-patient links, unique source/work membership, at most one owner/pending offer, expected revision/idempotency, original actor/role/time snapshots. |
| Review/delegation/deferral/exception events | Valid role targets, source access, audit history and accountable pending queues. Do not encode an office manager as a clinical delegate. |
| Viewer receipts and comment revisions | Actor/source-version/time; immutable revisions; strict internal audience; no automatic time credit. |

Use composite FKs/constraints for patient/team/source consistency rather than unchecked polymorphic IDs. Runtime grants stay explicit: INSERT/SELECT for immutable history, reviewed UPDATE only for current projections. No broad DELETE/DDL grants. MariaDB DDL commits implicitly; use versioned SQL split boundaries, rehearse partial-DDL recovery and never rewrite applied 0001–0007.

Before development application, take a private combined DB/media/config snapshot and verify preservation of calls, original messages/assets, enrollment/session/device/push identities and existing grants. Test clean and populated upgrades only on `phoneapp_test`; preserve hashes/IDs/timestamps and explicitly account for intended access cutover changes. Seed/cutover actions must be idempotent and target-checked. Do not reset development or edit other applications' schemas.

Feature gates should separately control roster management, new team addressing and staff workflow rollout; names are proposed until implemented. Flags do not erase recorded relationships or bypass source access. Accepted media/jobs and already captured work remain durable if a UI/mutation flag is disabled. Reconcile any in-flight publication/outbox work without fabricating historical receipts or restarting duplicate patient sends.

No new third-party provider, secret, signing capability, media quota/retention or public DB port is required. Ordinary task/background notifications are not supplied by this slice; use foreground discovery initially and never reuse call VoIP pushes for assignment alerts. New native bundled previews are needed for the role/workflow UI, using existing signing/push setup. No cloud build is submitted during planning.

## Acceptance and verification

All new team/workflow outcomes are **Not run**. Today only `db:status` read and documentation/whitespace checks apply. Extend existing runnable suites or register an additional guarded runner when implemented; do not report proposed workflow tests as currently available.

| Scenario | Verification during implementation | Exit evidence | Current result |
| --- | --- | --- | --- |
| Manager/clinical separation | API tests using operational-only and dual-capability fixtures | Manager edits allowed rosters/coverage/patient links; cannot fetch recordings, comments, receipts or clinically resolve without independent source access | Not run |
| Team activation and coverage | UI/API/date-clock tests | Draft setup, described role minima, absence/return/overnight/DST and last-member/closure cases preserve patient/team inbox and surface gaps | Not run |
| Patient assignment/access provenance | Populated upgrade plus cross-team API/media tests | Adopted legacy links transfer correctly; legitimate independent access retained; removed staff denied; no cross-patient/call-participant expansion | Not run |
| Team addressing and compatibility | Actual browser/native audio/video flow plus old contract fixtures | New team destination works without fictitious staff; old IDs/direct addresses/history/playback/sign-in/calls remain; unsupported writes have explicit cutover behavior | Not run |
| Claim and idempotency | Two simultaneous staff requests and delayed retry responses | Exactly one owner/event; stale actor sees typed native/browser conflict; lost response retry returns committed outcome without new mutation | Not run |
| Review versus ownership | MA requests PCP and peers request review | Review request does not force/steal ownership; required review completion/withdrawal is explicit and actor-attributed | Not run |
| Delegation matrix | PCP/RN/MA API matrix, role queues and named targets | PCP→RN/MA and RN→MA accepted; MA delegation and upward/same-role delegation denied; eligible recipient may accept/defer | Not run |
| Universal deferral and manager exception | Unclaimed item, own claim, offered work and requested review at every level | No supervisor approval needed to defer; reason/history retained, unresolved item remains visible; PCP deferral reaches manager attention | Not run |
| Roster/absence/handoff races | Membership revoked/coverage changes while offered, claimed, recording or accepting | Invalid offers withdrawn, permissions rechecked, stale mutations rejected, no orphaned or silently completed work/draft retargeting | Not run |
| Internal comments/receipts | Authorized staff, unrelated team, patient/caregiver and manager requests | Individual receipt/version history and bounded comment edits work; patient/unauthorized payloads/search/counts reveal no internal material | Not run |
| Reply publication and reopening | Real record/upload/convert/retry plus worker restart/state-change races | Published reply links once; failed draft never resolves; newer handoff not overwritten; explicit patient response reopens one root; unrelated messages stay separate | Not run |
| Cutover/backfill | Populate existing 0007 history and start prospective workflow | No fabricated historical New/Heard/Resolved or push backlog; explicit queue-old-item action is audited; outbox replay is complete/idempotent | Not run |
| Migration/grants/recovery | `test:db`, `test:db:permissions`, populated fixture restore and ledger checks | Clean/upgrade/partial-DDL recovery pass, source/auth/media preserved, immutable history protected and no destructive dev reset | Not run |
| Existing runtime/UI | `typecheck`, communication/message/account client suites, communications/audio/video/accounts/native/browser-session suites, `npm test`, browser tests as affected | Current calling, private media, saved identity, quiet full-width overlays, date picking and scrubbers remain correct | Not run |
| Public/native/hardware | Safe synthetic team/workflow smoke, Doctor/exports/archive/EAS package checks and owner role/device matrix | No owner call/message without explicit test intent; both packages retain push/calling/media; actual device outcomes separate from mocks | Not run |
| Plan integrity | `python3 scripts/check_project.py`, `git diff --check` | Valid links/requirements/whitespace | Pass for planning; documentation only |

Shared MariaDB suites run sequentially under the existing `phoneapp:test-suite` lock. Keep separate browser contexts/profiles for manager/PCP/RN/MA/patient. Test with unrelated Team B and a caregiver linked to two patients. Include zero coverage, disabled users, duplicate submissions, late worker results, session expiry, source expiry and cross-patient payload tampering. No ordinary notification/clinical/provider/billing success can be inferred from an event fixture or compiled package.

## Risks and recovery

Primary risks are unintended clinical access through roster management, stale legacy grants after reassignment, work lost between media publication and inbox creation, two staff owners/replies, forced or circular deferrals, and patient leakage of internal work. Enforce server-side capability/source checks, grant provenance, transactional versions/outbox capture and explicit queue responsibility; test each transition with concurrent actors.

Recovery uses schema-compatible feature gates and forward repair, retaining accepted sources, work events and roster history. A disabled UI must not drop accepted processing jobs or erase work. Preserve a combined backup and rehearse recovery before development cutover; do not blindly restore over newly accepted messages or revert to a pre-migration schema-blind server. Publish only Phoneapp between calls and record actual migration/flag/source/build outcomes in evidence. Existing Android/media/call/accessibility gates remain explicit throughout.

## Handoff

Planning complete; no team/coverage/workflow implementation or database migration was performed. Next on an implementation request: create the isolated worktree, settle the access/destination/provenance ADR, then deliver release A with guarded migrations and a usable manager roster before enabling intake/workflows. The prototype defaults above are explicit so routine implementation can proceed without unnecessary permission loops. Record any material policy change in the ADR/plan. Keep [current state](../PROJECT_STATE.md), [tools](../TOOLS.md) and the parent roadmap synchronized with actual evidence.
