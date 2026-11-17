# Tools and access inventory

Updated: 2026-11-16. Record verified capabilities separately from proposals. Connection details belong here; secret values do not. Tool availability and account sessions can change between threads.

## Verified environment

| Tool/resource | Observed state | Use / limits |
| --- | --- | --- |
| Working tree | `/home/ubuntu/phoneapp` on Ubuntu EC2 | Shared project checkout; preserve unrelated projects on this host. |
| Git / GitHub | Git installed; `gh` authenticated as `cnm4us`; repository accessible with push permission | Remote `https://github.com/cnm4us/phoneapp.git`; public at bootstrap. Do not paste authentication output containing credentials. |
| Node / npm | Node 22.21.1; npm 10.9.4 | Available, but project SDK/runtime compatibility must be checked when scaffolding. |
| Python | Python 3 installed | Runs documentation check without third-party dependencies. |
| Docker | Not found on PATH | Disposable container DB testing is unavailable until configured. |
| PostgreSQL client | `psql` not found on PATH | No database connection has been established. |
| EAS | CLI 27.10.0 installed globally; authenticated as `mbcollins2`; project linked | Android build submitted. No suitable iOS internal-distribution credentials found in noninteractive mode. Owner approved iPhone pay-as-you-go. |
| Apple Developer | Owner reports an account | Access credentials remain with the owner; use EAS-supported signing flow. |
| iPhone / Android | Owner and wife own the devices | Models/OS versions unknown; no remote device-control tool configured. |
| nginx / certbot | Installed; dedicated hostname site/certificate deployed | `https://phoneapp.bawebtech.com/health` verified. Other sites were not edited. |
| coturn | Installed; project-specific unit running | Local/public UDP/TCP/TLS packet exchange verified; physical-phone media pending. Stock coturn unit disabled. |

## Agent tool capabilities

- Shell/filesystem tools can edit source, run available checks, and manage Git in the checkout.
- A connected GitHub tool verified repository metadata, but workflow/PR writes were denied in this session. Authenticated Git/`gh` successfully pushed the feature branch and opened [draft PR 1](https://github.com/cnm4us/phoneapp/pull/1). Rediscover availability in a new session; ordinary CLI repository writes work, while workflow-write scope is still missing.
- Browser automation tools were exposed in this session but have not been exercised for this project. They can assist with a future web test harness; they do not control native apps on the two physical phones.
- No dedicated database connector or native-device test connection has been verified. Add exact capabilities only after an actual connectivity/test run.

## Commands available now

Run at the repository root:

```sh
python3 scripts/check_project.py
npm run typecheck
npm test
npm run doctor
npm run bundle:check
npm run smoke
git status --short --branch
git diff --check
```

The [GitHub Actions template](templates/docs-workflow.yml) can run the same checker on pushes and pull requests. It is **not enabled**: the CLI token lacks `workflow` scope and the connected GitHub integration also rejected workflow creation. Keep the local checker usable. When suitable credentials are available, copy the template to `.github/workflows/docs.yml`, commit/push it, and verify a hosted run. No authentication change is required for ordinary source/documentation pushes.

## Implementation tooling and remaining setup

| Area | Plan | When to mark ready |
| --- | --- | --- |
| Native app | Expo CLI, global EAS CLI 27.10.0, TypeScript, Expo Doctor, native generation and JS bundles available | Native cloud result and physical behavior are separate; see current state/report. No dedicated lint runner configured. |
| Signaling/backend | Node tests via `tsx`; actual local HTTP/WSS protocol tests and public smoke | 15 tests pass; no media in signaling smoke. |
| Browser harness | Playwright if a web peer/debug harness is useful | Tests run against a real harness; browser results remain separate from physical-device results. |
| Native acceptance | Both physical phones, EAS artifacts, sanitized session diagnostics | Owners install builds and execute the matrix in the active plan. |
| DB access | Dedicated dev/test database and CLI or driver; migration runner selected with persistence stack | Connectivity verified to the recorded target without printing secrets. |
| DB tests | Disposable or isolated DB, clean install + upgrade checks | Bootstrap and migration commands work and outcomes are recorded. |

See `package.json` for actual scripts. Playwright has not been installed/exercised; it would test web behavior, not native iPhone camera/audio or background ringing. Linux relay diagnostics use `python3 scripts/check-turn.py --transport udp` (or `tcp`/`tls`) and private `.env.server`. They do not prove physical-phone media.

## Connection registry

Populate this table as each service is configured. Use aliases and secret references; omit live tokens, passwords, credential-bearing URLs, signing files, and sensitive device identifiers.

| Resource | Environment / alias | Endpoint or ID | Credential location | Verified |
| --- | --- | --- | --- | --- |
| EAS project | Development | `@mbcollins2/phoneapp`, UUID `942392a3-1d9c-4d2c-91b0-0ad939e4e1fd` | Authenticated CLI session | Yes |
| App identifiers | iOS / Android | `com.bawebtech.phoneapp.poc` | Not applicable | Configured; native/device result pending |
| Metro | Development | Port 8081, `npm run start:tunnel`; ephemeral URL in its terminal | Existing Expo session | Tunnel started; recheck process |
| Signaling | Development | `https://phoneapp.bawebtech.com`, WSS `/signal`, private listener 8787 | `.env.server` (600), creator key entered in app | Public health/WSS smoke passed |
| TURN | Development | Host `phoneapp.bawebtech.com`; 3478 UDP/TCP, 5349 TLS, UDP relay 49160-49200 | `.env.server` master secret + `/etc/phoneapp/turnserver.conf`; client HMAC credentials expire | Local/public probes pass; real phones pending |
| Database | Dev / test | Not provisioned | Future ignored env/secret store | No |
| Twilio | Future development | Not linked | Backend-only secret store | No |

Before using DB tooling, verify target host/database/environment and intended migration scope using [the database workflow](DATABASE.md). Do not inspect or copy credentials from unrelated projects.

## Configuration conventions

- Keep `.env.example` templates alongside the component that consumes them when implementation adds configuration. Document public vs server-only values.
- Ignore actual `.env` files. A public app variable cannot hold a privileged credential.
- Record setup commands, ports, endpoint purpose, health checks, start/stop procedure, and known failure modes when a service becomes runnable.
- Before changing AWS security groups or routing, inspect existing rules and record project-specific changes. The host's network configuration has not been verified.
- Paid-provider setup and app installations may need owner action. Prepare code/configuration first and request only the missing external step.

## Service operation

Full instructions and recovery: [setup/runbook](SETUP.md). `phoneapp-signaling` and `phoneapp-turn` are enabled systemd services. Check with `sudo systemctl status phoneapp-signaling phoneapp-turn --no-pager`; restart only the affected project unit after checks. Their runtime follows this development checkout, so account for running services before changing branches/dependencies. Generated native folders and private artifacts are ignored.

The AWS role cannot describe/manage EC2 security groups. No AWS rules were changed by the agent. Owner confirmed inbound TCP 3478/5349, UDP 3478 and `49160-49200` were added; public relay probes subsequently passed. AWS Console requires an ordinary ASCII hyphen for the range. A configured health flag alone does not prove reachability.

EAS Android build: [2cf8e5a8](https://expo.dev/accounts/mbcollins2/projects/phoneapp/builds/2cf8e5a8-cb84-44f6-8189-a1faf3e31a9c), finished successfully. iOS noninteractive submission stopped before upload because internal-distribution credentials were missing; owner interaction for Apple signing/device registration remains necessary. Pay-as-you-go for the iPhone build is explicitly authorized.

`npm run start:tunnel` uses installed local ngrok tooling. Keep the Metro terminal running while development clients use it; no persistent Metro systemd service was installed. Do not start duplicate listeners on 8081 or 8787.

## References

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo WebRTC config plugin](https://github.com/expo/config-plugins/blob/main/packages/react-native-webrtc/README.md)
- [Playwright documentation](https://playwright.dev/docs/intro)
