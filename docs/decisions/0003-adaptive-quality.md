# 0003 Shared quality policy and compatible peer controls

Date: 2026-11-17 UTC. Status: accepted for the POC implementation; experimental 4K/relay expansion remains gated.

## Decision

Use shared TypeScript policy/statistics/controller modules with a narrow runtime adapter for the pinned native/browser WebRTC APIs. Presets impose ceilings while WebRTC congestion control remains active. Independent incoming limits are requests enforced by the remote sender. Effective limits intersect local preference, receiver preference, adaptation, device support, and relay budget.

Negotiate version-2 controls after a legacy-shaped join and additive feature metadata. Forward new events only when both authenticated room members advertise support. Revisioned policies/acknowledgments prevent stale updates from relaxing limits. Keep the original initiator as designated offerer, with server-issued negotiation IDs and one queued renegotiation, avoiding glare and arbitrary peer routing.

Either participant may require audio-only; clearing one request cannot override the other. Manual mode releases capture and leaves cameras off on return. Remote video requests prompt rather than activate capture. Video API/negotiation failures preserve usable audio and report limitations. Audio-first adaptation reduces video or detaches its sender, then recovers gradually after stable audio. Priority hints are optional and cannot guarantee delivery.

Default experimental Ultra off. Retain live TURN quotas and a 6 Mbps relayed-video ceiling. A configured quota does not prove host/network capacity. Browser capability enumeration can establish a capture envelope; the current native API cannot, so native 4K requires further physical verification before exposure.

## Evidence and consequences

See [verification](../testing/2026-11-17-adaptive-quality.md) and [plan 0003](../plans/0003-adaptive-call-quality.md). Tests exposed startup-estimate probing deadlock, stale feedback/recovery, jitter-delay corroboration, and unmatched camera-less transceivers; keep these as regression tests.

No dependency/provider/DB changes or paid native rebuild for this JavaScript increment. Existing clients retain initial-call compatibility; mixed versions cannot promise remote enforcement. Physical devices, actual listening, thermal behavior, and high-ceiling relay capacity remain separate acceptance evidence.
