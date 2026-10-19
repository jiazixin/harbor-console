# Harbor Console

[简体中文](README.zh-CN.md) | **English**

Harbor Console is a self-contained administration interface for Harbor v2.15.x. It
connects to Harbor through a typed, server-side API gateway and provides one consistent
workspace for projects, repositories, artifacts, security, replication, retention,
preheating, users, scanners, audit data, and system operations.

The application is distributed as a single Go binary. Its React production bundle,
styles, translations, and demo data are embedded, so it can run in isolated
environments without a web service, package registry, or external CDN at runtime.

## Highlights

- **Broad Harbor administration:** projects, members, repositories, artifacts, tags,
  labels, scans, SBOM, retention, replication, registries, robots, webhooks, P2P
  preheating, audit, job service, scanners, users, groups, quotas, and system settings.
- **Multiple Harbor connections:** one browser session can keep up to 20 isolated Harbor
  connections and switch between them. Credentials are accepted during connection but
  are never returned to the browser or persisted in browser storage.
- **Typed upstream gateway:** the browser can call only explicitly declared Harbor
  v2.15 operations. Arbitrary upstream URL and method proxying is not available.
- **Bilingual interface:** Simplified Chinese and English with persisted language,
  timezone, CLI, theme, and repository-view preferences.
- **Offline-ready:** all UI assets are embedded in the executable.
- **Built-in demo:** important workflows can be evaluated without a Harbor installation.
- **Operational defaults:** structured logs, bounded requests and responses, graceful
  shutdown, health checks, rate limits, strict cookies, and same-origin write protection.

## Scope

Harbor Console currently authenticates upstream requests with Harbor Basic Auth. An OIDC
user can connect with their Harbor username and CLI secret. Native browser-based OIDC
login, OIDC onboarding, and database self-registration are not implemented.

The project targets the non-deprecated operations of Harbor v2.15. The operation contract
was captured from v2.15.2 and is identical in v2.15.4, the newest release verified against
a live instance. Compatibility shims for older Harbor APIs are intentionally not included.

## Requirements

- Go 1.26.9 or newer
- Node.js 22.22.2+ (22.x), 24.15.0+ (24.x), or 26+ for web checks
- Docker or another OCI builder for container images

## Quick Start

Run with built-in defaults:

```bash
go mod download
npm --prefix web ci --ignore-scripts
npm --prefix web run build
go run ./cmd/harbor-console
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080), then connect with a Harbor base URL,
username, and password or CLI secret. The demo button creates an isolated local session
without contacting Harbor.

To use a configuration file:

```bash
cp configs/config.example.yaml configs/config.local.yaml
CONFIG_FILE="$PWD/configs/config.local.yaml" go run ./cmd/harbor-console
```

## Configuration

YAML values can be overridden with environment variables.

| Environment variable  | Purpose                                | Default                    |
| --------------------- | -------------------------------------- | -------------------------- |
| `CONFIG_FILE`         | YAML configuration path                | `configs/config.local.yaml` when present |
| `LISTEN`              | Listener address                       | `127.0.0.1`                |
| `PORT`                | Listener port                          | `8080`                     |
| `HEALTH_URI`          | Health endpoint                        | `/health`                  |
| `LOG_LEVEL`           | `debug`, `info`, `warn`, or `error`    | `info`                     |
| `LOG_FORMAT`          | `json` or `logfmt`                     | `json`                     |
| `ACCESS_LOG`          | Enable request logs                    | `true`                     |
| `LOG_HEALTH_CHECKS`   | Include health requests in access logs | `false`                    |
| `READ_HEADER_TIMEOUT` | Header read timeout                    | `5s`                       |
| `READ_TIMEOUT`        | Request read timeout                   | `20s`                      |
| `WRITE_TIMEOUT`       | Response write timeout                 | `30s`                      |
| `IDLE_TIMEOUT`        | Keep-alive idle timeout                | `90s`                      |
| `SHUTDOWN_TIMEOUT`    | Graceful shutdown deadline             | `10s`                      |

See [configs/config.example.yaml](configs/config.example.yaml) for the complete file.

## Container

```bash
docker build -t harbor-console:local .
docker run --rm -p 127.0.0.1:8080:8080 harbor-console:local
```

The image runs as a non-root user, listens on `0.0.0.0:8080`, and includes a default
configuration at `/etc/harbor-console/config.yaml`.

Mount a custom configuration when needed:

```bash
docker run --rm -p 127.0.0.1:8080:8080 \
  -v "$PWD/configs/config.local.yaml:/etc/harbor-console/config.yaml:ro" \
  harbor-console:local
```

The examples bind the host port to `127.0.0.1` so the console is not published to the
network by default. Change the host bind deliberately only when an authenticated reverse
proxy or an equivalent network boundary is in place.

## Architecture

```text
Browser
   |
   | HttpOnly console session cookie
   v
Harbor Console (Go)
   |-- HTTP handlers and in-memory connection sessions
   |-- typed Harbor v2.15 gateway
   |-- embedded bilingual web client
   |-- isolated demo state
   |
   | Basic Auth / CLI secret over server-side HTTP
   v
One or more Harbor instances
```

Repository layout:

```text
cmd/harbor-console/     executable entry point
internal/app/           HTTP application, sessions, gateway, and demo orchestration
internal/config/        YAML and environment configuration
internal/observability/ structured logging and access logs
internal/buildinfo/     build version metadata
web/                    React, TypeScript, shared components, feature pages, styles, and tests
web/embed.go            Go embed boundary (package webui)
web/dist/               generated Vite output (ignored)
configs/                deployment configuration examples
docs/                   design, development, acceptance, and change records
scripts/                repository quality tooling
```

The layout follows [目录规范.md](目录规范.md). `web/` owns npm manifests, its lockfile,
tool configuration, source, public resources, unit/contract tests and E2E tests.
The Go embed entry lives beside the generated resources because embed paths cannot
traverse parent directories. `internal/app` retains its shared internal domain types.

Run all documented commands from the repository root. Install dependencies first,
then run `npm --prefix web run build` to generate `web/dist/` before Go
build/run/test/vet and browser checks. Generated assets are not tracked.
CI/CD directly orchestrates checks, tests and builds in `.github/workflows/ci.yml`.
Go coverage reports belong in `coverage/go.out`; configuration and runtime data
must be preserved when cleaning generated files.

Configuration precedence is environment > YAML > built-in defaults. Relative
`CONFIG_FILE` paths resolve against the process working directory; use absolute paths
in deployments. Explicit empty or missing paths fail. An unset `CONFIG_FILE` reads
optional `configs/config.local.yaml` relative to the working directory and uses defaults
if absent. Local configuration belongs in this ignored path; root and `bin/` configuration
files are not automatically discovered.
Vite reads local environment files from `web/`; these are excluded from Git and Docker.

Sessions and demo state are in memory and reset on restart. Logs go to stdout; this
service creates no database or upload directory. Harbor owns and backs up its persistent
data. Only configuration needs an optional read-only mount. Archived documents and older
plans retain historical paths; use the current README and development guide for commands.

## Security Model

- Browser authentication state consists only of a random, `HttpOnly`, `SameSite=Strict`
  console session ID. Local and session storage contain only non-secret UI preferences
  and public-catalog navigation state.
- Harbor passwords and CLI secrets stay in process memory and expire with the session.
  Instance URLs and usernames are returned to identify the active connection.
- Write operations require a valid session and a same-origin request.
- Upstream methods, paths, query fields, and JSON bodies are allowlisted.
- Upstream redirects are limited to the same scheme and host.
- Requests and responses have explicit size limits and timeouts.
- Access logs omit query strings and never intentionally log credentials or tokens.

The unauthenticated public catalog is an outbound-request feature: it accepts a
user-supplied Harbor URL and the server makes anonymous `GET` requests to three fixed
catalog endpoints. Treat this as an SSRF and egress trust boundary. Restrict console
access and enforce outbound DNS, IP, and network-policy controls (for example, an
allowlist); do not expose the catalog as an unrestricted public proxy.

Sessions, Harbor credentials, demo state, and rate limits are process-local. Restarting
the process disconnects every browser session. Run one application replica; stateless
horizontal scaling requires a shared session and rate-limit design that is not currently
implemented.

Deploy behind an HTTPS reverse proxy. Connecting to a Harbor instance over plain HTTP
exposes Basic Auth credentials on the network between Harbor Console and Harbor.
The “allow self-signed certificates” (skip-TLS) option disables certificate verification
for the selected connection. Use it only for a trusted disposable or internal Harbor
instance, never for production or untrusted endpoints.

## Development

```bash
npm --prefix web run dev    # Vite
npm --prefix web run build  # web/dist; required before Go commands
npm --prefix web run check
npm --prefix web test
go vet ./cmd/... ./internal/... ./web
go test -race ./cmd/... ./internal/... ./web -count=1
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -o bin/harbor-console ./cmd/harbor-console
docker build -t harbor-console:dev .
```

The GitHub Actions workflow runs the same quality gate and dependency vulnerability audit,
executes the authenticated route matrix in Chromium, Firefox, and WebKit, builds the
container image, and smoke-tests its non-root runtime, health endpoint, embedded UI, and
graceful shutdown.
The browser never downloads npm modules at runtime; React and its dependencies are
compiled into the embedded Vite bundle. Dependabot checks the GitHub Actions references,
Go modules, npm dependencies, and Docker base-image digests and opens update pull requests
for review.

## Documentation

- [Documentation index](docs/README.md)
- [Design baseline](docs/DESIGN.md)
- [Implementation rules](docs/IMPLEMENTATION.md)
- [Acceptance plan](docs/ACCEPTANCE.md)
- [Change record](docs/CHANGELOG.md)

## Project Status

The application uses typed React for sessions, routes, pages, dialogs, and global
overlays. Results, fixes, and remaining deployment checks for the current pre-release
review are recorded in [ACCEPTANCE.md](docs/ACCEPTANCE.md). Historical Harbor and
container results do not certify the current worktree. Validate the target Harbor
instance and container environment before release.
