# Delivery roadmap

| Milestone | Status | Requirements | Exit evidence |
| --- | --- | --- | --- |
| M0 Documentation foundation | Complete | OPS-02 | Linked PRD/plans/state/tooling; documentation check passes locally. |
| M1 Two-device WebRTC POC | In progress: app/services implemented; native/device acceptance pending | POC-01–07 | EAS builds installed on iPhone/Android; device report covers foreground audio/video, cross-network, forced relay, teardown, and errors. |
| M2 Patient and time foundation | Started: DB, synthetic directory and foreground call/history implemented; full time/export work pending | PAT-01–03, TEAM-01, TIME-04–08, REP-01–02, OPS-01 | Reproducible DB migrations; synthetic patient/contact workflow; reviewed manual time and export reconciliation. |
| M3 Telephone integration | Backlog | COM-02–03, COM-05–06, TIME-01 | Calls both directions via service number; locked/background tests; idempotent call/time records. |
| M4 Messaging and browser sessions | Backlog | COM-01, COM-04, COM-06, TIME-02–03 | Browser participation; two-way messaging; active time review and ambiguity handling. |
| M5 Consented transcription | Backlog | TX-01–04 | Consent/no-recording flow, attributed draft transcript, corrections, retention/failure behavior. |
| M6 Production readiness | Deferred | OPS-03 plus all applicable product requirements | Agreed privacy/security/clinical/billing/operations acceptance and production readiness review. |

The M1 duration display is experimental; durable call-derived time arrives with the ledger/integration milestones. Reorder later milestones when evidence or user priorities justify it. Record scope changes in the PRD and the relevant plan.

Owner's proposed next product slice is [0007 provider/patient app calls and post-call transcripts](plans/0007-provider-patient-calls-transcripts.md): role-specific patient directory and patient account experience, patient-addressed App Audio/Video calls with native incoming ringing, shared durable history, and opt-in transcripts after processing. This brings a narrow part of M2/M3/M5 forward; telephone numbers, SMS, live captions, LLM summaries, full billing/time review, and production use remain outside it. PAT-04, TEAM-02, COM-10, TX-05, and REP-03 capture the new requirements. Packaging (one binary with roles or separate shared-source variants), retention, and service choices remain proposed/unselected. The persistence prerequisite is now implemented through [0008 database foundation](plans/0008-database-foundation.md): dedicated MariaDB dev/test schemas, two migrations, synthetic A/B/C seed, and verified tooling/constraints/permissions. The [0009 foreground account slice](plans/0009-authenticated-foreground-calls.md) adds owner-enrolled synthetic identities, authorized provider/patient directory, foreground incoming Answer/Decline, private WebRTC rooms and shared durable history. Native background/locked incoming calls, production identity, capture/storage and transcripts remain pending. No new paid service or native build was initiated; original M1 physical acceptance stays open.

M1 plan: [0001](plans/0001-webrtc-poc.md). Create later plans when their scope is concrete using [the template](plans/TEMPLATE.md). Do not preapprove providers, spending, or billable behavior through this roadmap.

Supporting [plan 0002](plans/0002-browser-companion.md) adds an initial COM-01 browser participant for solo M1 testing. The browser page is deployed and passes automated media checks; this does not complete the later patient-facing browser/access workflow or replace the original physical-device matrix.

Communications quality iteration: [0003](plans/0003-adaptive-call-quality.md), COM-07–09. Native/browser controls and adaptation are implemented; browser/server deployed with automated acceptance. Physical native/Safari and experimental Ultra hardware/relay-capacity gates remain open. Original M1 acceptance is unchanged.

Testing usability: [plan 0004](plans/0004-call-testing-usability.md) adds short test codes, four-hour rooms, disconnect diagnostics, and stable native full-screen presentation. Server/browser checks pass; owner full-screen/sustained-call confirmation remains open.
