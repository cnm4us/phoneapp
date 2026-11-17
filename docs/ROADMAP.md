# Delivery roadmap

| Milestone | Status | Requirements | Exit evidence |
| --- | --- | --- | --- |
| M0 Documentation foundation | Complete | OPS-02 | Linked PRD/plans/state/tooling; documentation check passes locally. |
| M1 Two-device WebRTC POC | In progress: app/services implemented; native/device acceptance pending | POC-01–07 | EAS builds installed on iPhone/Android; device report covers foreground audio/video, cross-network, forced relay, teardown, and errors. |
| M2 Patient and time foundation | Backlog | PAT-01–03, TEAM-01, TIME-04–08, REP-01–02, OPS-01 | Reproducible DB migrations; synthetic patient/contact workflow; reviewed manual time and export reconciliation. |
| M3 Telephone integration | Backlog | COM-02–03, COM-05–06, TIME-01 | Calls both directions via service number; locked/background tests; idempotent call/time records. |
| M4 Messaging and browser sessions | Backlog | COM-01, COM-04, COM-06, TIME-02–03 | Browser participation; two-way messaging; active time review and ambiguity handling. |
| M5 Consented transcription | Backlog | TX-01–04 | Consent/no-recording flow, attributed draft transcript, corrections, retention/failure behavior. |
| M6 Production readiness | Deferred | OPS-03 plus all applicable product requirements | Agreed privacy/security/clinical/billing/operations acceptance and production readiness review. |

The M1 duration display is experimental; durable call-derived time arrives with the ledger/integration milestones. Reorder later milestones when evidence or user priorities justify it. Record scope changes in the PRD and the relevant plan.

M1 plan: [0001](plans/0001-webrtc-poc.md). Create later plans when their scope is concrete using [the template](plans/TEMPLATE.md). Do not preapprove providers, spending, or billable behavior through this roadmap.

Supporting [plan 0002](plans/0002-browser-companion.md) adds an initial COM-01 browser participant for solo M1 testing. The browser page is deployed and passes automated media checks; this does not complete the later patient-facing browser/access workflow or replace the original physical-device matrix.

Next planned communications iteration: [0003 adaptive call quality](plans/0003-adaptive-call-quality.md), covering COM-07–09. The implementation plan is ready: opt-in very high ceilings, controls for reducing both outgoing and incoming video, audio-first adaptation, and coordinated audio-only mode. Implementation and quality/device acceptance have not started; original M1 acceptance remains open.
