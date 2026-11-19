# Video-message implementation evidence

Updated: 2026-11-19 UTC. [Plan 0014](../plans/0014-video-messages.md), [ADR 0010](../decisions/0010-video-messages.md). Worktree: `/home/ubuntu/phoneapp-stage14`, branch `feat/video-messages`. Synthetic captures only; no physical video acceptance claimed.

## Implemented source and isolated evidence

Source adds native/browser deliberate video-with-sound capture, camera selection before recording, preview/re-record/discard/send, progress/cancel/retry, mixed history, private posters and later video playback. Migration 0006 expands existing message metadata; legacy audio history/grants remain compatible. New clients use `/messages/v2`, old clients omit video before pagination. Private files and grants preserve the existing session/device/patient audience. The worker normalizes H.264/AAC MP4, corrects rotation, strips extra metadata, generates a JPEG poster and verifies duration/dimensions/size before publication. No live-call recording, transcription, Twilio, message notifications or staff time credit is added.

Initial checks: TypeScript passes; clean/upgrade/recovery DB suite passes (8 scenarios / 9 Node tests), including a 0005 audio row preserved through 0006. Existing audio integration passes (8 scenarios / 9 Node tests), account integration passes (6 scenarios / 7 Node tests), native call suite passes (7 scenarios / 8 Node tests), HTTPS browser-session suite passes (4 scenarios / 5 Node tests), and 7 account-client cases pass. Existing unit/server suite passes 58 cases. New video integration currently passes metadata/private poster/Range, legacy contract/late enrollment, role/revocation/grant binding, disabled-create with retained playback, invalid/mismatched/silent/oversized/queued inputs, portrait rotation, duration/FPS rejection, real Chromium camera+sound capture/preview/send/page-close/later play/video reply, recovery/asset restore/expiry/orphan checks. Final expanded slow-upload case and all final counts will be recorded after rerun.

## Processing budget and simultaneous local call checks

Private fixture: 120 seconds, 1280×720 at 30 fps, WebM VP8/Opus moving synthetic pattern with tone. Normalized output: 120,008 ms, 31,295,825-byte MP4, 1280×720/30, 5,543-byte JPEG. First run took 34.69 seconds with about 1 ms maximum Node timer delay.

Second run overlapped local unit/browser WebRTC tests: conversion 67.926 seconds, 45.40 CPU user seconds plus 0.52 system seconds, peak reported RSS 131,864 KiB, about 7 ms maximum timer delay. All 13 local browser scenarios passed in 39 seconds, including real synthetic two-way media and forced TURN. These measurements support a single low-priority bounded converter for this POC; they do not prove WAN throughput, perceptual synchronization, sustained multi-call capacity or native device compatibility. CPU/memory limits and global store/free-space reserves remain enforced. Private benchmark input/output/resource logs stay outside Git/EAS.

## Native source and pending compilation

Pinned Camera 57.0.6, Video 57.0.5, existing Audio 57.0.5. Guarded postinstall patches stop camera/player on early native call signals and prevent camera preview reopening on foreground return. Force these packages to source-build through Expo autolinking. Existing call background modes (`voip`, `audio`, `remote-notification`) and camera/mic descriptions remain after prebuild. Both JS exports and Expo Doctor 21/21 pass at the first checkpoint. Expo Video config does not remove the background audio mode used for calls; runtime message player disables background/now-playing/cache/PiP features.

Cloud previews/package inspection, development migration/rollout, public synthetic smoke and physical handset matrix are pending at this checkpoint. Do not treat JS export or patch inspection as native compile/runtime evidence. Remaining 0011/0012 physical gates remain open.
