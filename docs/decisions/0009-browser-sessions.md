# 0009 Persistent browser sessions

Status: accepted for the owner's requested browser sign-in iteration, 2026-11-18. [Plan 0013](../plans/0013-persistent-browser-sign-in.md).

Reuse revocable hashed `auth_sessions` credentials in a host-only Secure/HttpOnly/SameSite=Strict cookie (`__Host-phoneapp_session`, Path=/, no Domain). Browser sessions last a fixed 30 days, including browser-profile reopen when cookies are retained; restoration does not refresh their deadline. Store neither enrollment codes nor session secrets in localStorage/sessionStorage. The browser client holds only a fixed noncredential signed-in marker, account data and normal in-memory UI state.

New browser enrollment/restore endpoints opt in explicitly; cookie-authenticated API requests require `X-Phoneapp-Browser: 1`, matching Origin for writes and permitted Fetch Metadata. APIs do not enable CORS. An expected-account header rejects stale tabs before returning another signed-in account's data. Failed/stale authentication responses cannot clear a newer client identity. Do not clear a potentially newer cookie on an arbitrary stale 401; explicit online Sign out revokes and expires it. Offline logout failure remains visible as signed in until retry succeeds.

For the currently open desktop page, a valid non-native bearer request with browser same-origin Fetch Metadata may upgrade that session to 30 days and install the cookie when none exists. This avoids a fresh enrollment merely to receive the new JS bundle. Node/CLI and native bearer flows remain compatible, including their current lifetimes and device ownership. Browser session responses do not return a reusable bearer secret; the static `browser-session` token field is only a client-state marker.

No migration or new credential/signing key. Cookie operation rechecks active account/session and existing patient authorization; message media still uses short-lived operation-bound grants. Reload restores account sign-in, not microphone/camera capture, in-progress uploads or WebRTC transport. Signout uses small keepalive requests on page exit where applicable; browser profiles share one cookie identity across tabs.

Tests use an isolated synthetic DB and real HTTPS Chromium, including cookie flags, JS invisibility, reload/new-tab/profile restore, signout/expiry, open-tab upgrade and hostile request/account boundaries. Production identity/MFA/inactivity policy remains a later design. Revisit this fixed POC lifetime and cookie strategy before production authentication or cross-origin clients.
