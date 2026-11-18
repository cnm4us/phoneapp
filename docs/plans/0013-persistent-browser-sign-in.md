# 0013 Persistent browser sign-in

Status: implemented in isolated stage13; rollout/evidence in progress. Updated: 2026-11-18.

## Outcome and scope

Owner asks to avoid entering another enrollment code whenever the browser reloads for changes. Save a revocable browser session for a fixed 30 days; keep the one-use enrollment code one-use. Restore identity automatically after reload/new tab/browser-profile reopen, and revoke/forget on explicit Sign out. Existing open bearer-based tabs can adopt their current session before their first reload. Supports TEAM-01–02 and OPS-02 in [PRD](../PRD.md), building on [0012](0012-audio-messages-shared-history.md). Native enrollment/calling, recordings and time-credit semantics are unchanged; no new native build or database migration.

## Current evidence

Existing browser credentials live only in JS memory for 12h; closing/reloading loses them. Native sign-in already persists in Keychain/Keystore. `auth_sessions` has hashed tokens, expiry/revocation and nullable native device binding; it can represent the new browser lifetime without new DDL. Current HTTPS/nginx and same-origin APIs are available. [ADR 0009](../decisions/0009-browser-sessions.md) records the security/compatibility contract.

## Implementation steps

- [x] Inspect live auth/server/browser flows; isolate changes in `/home/ubuntu/phoneapp-stage13` while canonical serves calls.
- [x] Add Secure/HttpOnly/SameSite=Strict `__Host-` cookie with no Domain and Path=/, fixed 30-day server expiry, current-account checks and explicit logout revocation.
- [x] Use browser-specific enrollment/restore endpoints and an explicit request header plus Origin/Fetch Metadata guards; preserve native/CLI bearer requests.
- [x] Upgrade valid bearer credentials in already-open same-origin browser tabs when no cookie exists, so the current owner tab can reload without a fresh code.
- [x] Restore browser identity automatically; use a noncredential marker in JS instead of exposing cookie values or saving codes/tokens in Web Storage. Handle stale requests/account changes and visibly failed offline logout.
- [x] Verify real HTTPS cookie flags, reload/new-tab/profile restore, signout, fixed expiry, legacy adoption, hostile Origin/missing guard and wrong-account rejection; run existing call/message/auth regressions.
- [ ] Publish backend/browser between calls, allow the current tab to adopt its session, then verify public behavior without sending calls/messages to owner phones.
- [ ] Update exact deployed result, tools, state/work log and owner handoff.

## Data and configuration

Reuse existing `auth_sessions`; no migration, grant change, cookie signing key, provider credential or Web Storage secret. New browser enrollment has a 30-day fixed expiry; restore does not slide/extend it. Native expiry remains as implemented under 0011 and generic bearer enrollment remains 12h. Cookie deletion alone removes the local credential; explicit online logout also revokes the session server-side. If offline logout fails, keep the signed-in UI with an actionable error, rather than imply revocation succeeded.

Production browser Origin is `https://phoneapp.bawebtech.com`; tests infer their private loopback Origin and use real HTTPS. Only intended same-origin browser requests opt into cookie auth. A stale tab's expected-account header prevents it fetching a different cookie account's data. Reload ends the current browser media call as before; sign-in restoration does not automatically reopen microphone/camera or recover an in-progress upload.

## Acceptance and verification

| Scenario | Command/procedure | Expected | Actual |
| --- | --- | --- | --- |
| Cookie persistence / flags / logout / expiry / CSRF / legacy adoption | `npm run test:browser-session` | Real HTTPS Chromium + isolated DB; one enrollment suffices, HttpOnly credential stays inaccessible to JS, invalid/revoked sessions denied | 4 scenarios / 5 Node tests pass |
| Native and browser client races | `npm run test:account-client` | Native restoration remains valid; offline logout is honest and late 401 cannot clear newer account | In progress |
| Calling and messages | `npm run test:accounts`, `npm run test:audio-messages`, `npm run test:native-calls`, `npm test`, `npm run test:browser` sequentially where DB is shared | Existing permission/media/history/upload/native contracts remain compatible | Evidence recorded at rollout |
| Public restore | Isolated synthetic Provider browser profile through deployed HTTPS | Sign in once -> reload/new tab -> same identity, signout -> signed out; no calls/push/recording | Pending rollout |
| Owner current tab | Leave current browser open briefly after publish, then reload | Legacy session adopted and identity restored without another code | Owner feedback pending |

## Risks and recovery

Cookie auth adds ambient credentials; guards apply to every cookie-authenticated API while media grants keep their existing Authorization contract. Tests reject hostile/missing Origin/header and unexpected account identity. A browser profile shares one saved account across tabs; a different account needs signout or another browser profile. Session theft/XSS remains a production identity concern; this change does not claim production authentication readiness.

Disable the browser UI opt-in/revert the feature implementation while preserving sessions/data if necessary; existing bearer/native APIs stay available. Do not reset DB or revoke unrelated native devices. Cookies are scoped to this hostname and can be cleared by Sign out/browser site-data removal; owner can issue a new synthetic enrollment code after expiry/revocation. Record physical/message gates under 0012 separately.

## Handoff

Next: final checks and source-only browser/backend rollout. No Apple login, EAS build or schema change required. Keep active calls intact and record public/owner results separately.
