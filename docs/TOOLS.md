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
| EAS | Owner reports an account | CLI installation, session, project linking, signing, and device registration have not been verified. |
| Apple Developer | Owner reports an account | Access credentials remain with the owner; use EAS-supported signing flow. |
| iPhone / Android | Owner and wife own the devices | Models/OS versions unknown; no remote device-control tool configured. |

## Agent tool capabilities

- Shell/filesystem tools can edit source, run available checks, and manage Git in the checkout.
- A connected GitHub tool was used to verify repository metadata. Rediscover connector availability in a new session; local Git/`gh` are also available.
- Browser automation tools were exposed in this session but have not been exercised for this project. They can assist with a future web test harness; they do not control native apps on the two physical phones.
- No dedicated database connector or native-device test connection has been verified. Add exact capabilities only after an actual connectivity/test run.

## Commands available now

Run at the repository root:

```sh
python3 scripts/check_project.py
git status --short --branch
git diff --check
```

The [GitHub Actions template](templates/docs-workflow.yml) can run the same checker on pushes and pull requests. It is **not enabled**: the CLI token lacks `workflow` scope and the connected GitHub integration also rejected workflow creation. Keep the local checker usable. When suitable credentials are available, copy the template to `.github/workflows/docs.yml`, commit/push it, and verify a hosted run. No authentication change is required for ordinary source/documentation pushes.

## Planned implementation tooling

| Area | Plan | When to mark ready |
| --- | --- | --- |
| Native app | Expo CLI, EAS CLI, Expo dependency validation, TypeScript, linting, app logic tests | Project scaffold exists, dependencies installed/pinned, commands run. |
| Signaling/backend | TypeScript and focused automated protocol/session tests | Actual runner and package scripts are committed and exercised. |
| Browser harness | Playwright if a web peer/debug harness is useful | Tests run against a real harness; browser results remain separate from physical-device results. |
| Native acceptance | Both physical phones, EAS artifacts, sanitized session diagnostics | Owners install builds and execute the matrix in the active plan. |
| DB access | Dedicated dev/test database and CLI or driver; migration runner selected with persistence stack | Connectivity verified to the recorded target without printing secrets. |
| DB tests | Disposable or isolated DB, clean install + upgrade checks | Bootstrap and migration commands work and outcomes are recorded. |

Do not invent package scripts while the project has no `package.json`. The first implementation plan must add the actual runnable commands here. Playwright tests web behavior, not native iPhone camera/audio or background ringing.

## Connection registry

Populate this table as each service is configured. Use aliases and secret references; omit live tokens, passwords, credential-bearing URLs, signing files, and sensitive device identifiers.

| Resource | Environment / alias | Endpoint or ID | Credential location | Verified |
| --- | --- | --- | --- | --- |
| EAS project | Development | Not linked | Owner's authenticated CLI session | No |
| App identifiers | iOS / Android | Not selected | Not applicable | No |
| Metro | Development | Not running | Not applicable | No |
| Signaling | Development | Not provisioned | Future ignored env/secret store | No |
| TURN | Development | Not selected | Server-issued short-lived credentials or approved equivalent | No |
| Database | Dev / test | Not provisioned | Future ignored env/secret store | No |
| Twilio | Future development | Not linked | Backend-only secret store | No |

Before using DB tooling, verify target host/database/environment and intended migration scope using [the database workflow](DATABASE.md). Do not inspect or copy credentials from unrelated projects.

## Configuration conventions

- Keep `.env.example` templates alongside the component that consumes them when implementation adds configuration. Document public vs server-only values.
- Ignore actual `.env` files. A public app variable cannot hold a privileged credential.
- Record setup commands, ports, endpoint purpose, health checks, start/stop procedure, and known failure modes when a service becomes runnable.
- Before changing AWS security groups or routing, inspect existing rules and record project-specific changes. The host's network configuration has not been verified.
- Paid-provider setup and app installations may need owner action. Prepare code/configuration first and request only the missing external step.

## References

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo WebRTC config plugin](https://github.com/expo/config-plugins/blob/main/packages/react-native-webrtc/README.md)
- [Playwright documentation](https://playwright.dev/docs/intro)
