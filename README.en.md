<p align="center">
  <img src="web/public/favicon.svg" width="88" alt="Harbor Console logo">
</p>

<h1 align="center">Harbor Console</h1>

<p align="center">
  A self-contained administration console for Harbor v2.15 — one Go binary, an embedded bilingual React UI, and a typed server-side API gateway.
</p>

<p align="center">
  <a href="https://github.com/jiazixin/harbor-console/actions/workflows/ci.yml"><img src="https://github.com/jiazixin/harbor-console/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/jiazixin/harbor-console/releases/latest"><img src="https://img.shields.io/github/v/release/jiazixin/harbor-console?sort=semver" alt="Release"></a>
  <img src="https://img.shields.io/badge/Go-1.27.3-00ADD8?logo=go&logoColor=white" alt="Go 1.27.3">
  <img src="https://img.shields.io/badge/Harbor-v2.15.x-60B932" alt="Harbor v2.15.x">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache-2.0"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <b>English</b>
</p>

---

Harbor Console gives Harbor administrators one consistent workspace for projects, repositories, artifacts, security, replication, retention, preheating, users, scanners, audit data and system operations. The browser never talks to Harbor directly: the Go server holds the credentials and forwards only explicitly declared Harbor v2.15 operations. The React bundle, styles, translations and demo data are embedded in the binary, so it runs in isolated networks without a separate web server, npm registry or CDN.

> [!IMPORTANT]
> - **Harbor v2.15 only.** The operation contract was captured from v2.15.2 and is identical in v2.15.4, the newest release verified against a live instance. There are no compatibility shims for older Harbor APIs.
> - **Basic Auth upstream.** Connect with a Harbor username and password, or an OIDC user's CLI secret. Browser-based OIDC login, OIDC onboarding and database self-registration are not implemented.

## Features

- **Broad Harbor administration**: projects, members, repositories, artifacts, tags, labels, scans, SBOM, retention, replication, registries, robots, webhooks, P2P preheating, audit, job service, scanners, users, groups, quotas and system settings.
- **Multiple Harbor connections**: one browser session keeps up to 20 isolated connections and switches between them. Credentials are submitted once and are never returned to the browser or stored in browser storage.
- **Typed upstream gateway**: methods, paths, query fields and JSON bodies are allowlisted; there is no arbitrary URL or method proxy.
- **Bilingual UI**: Simplified Chinese and English, with persisted language, timezone, CLI, theme and repository-view preferences.
- **Offline single binary**: every UI asset is embedded; nothing is downloaded at runtime.
- **Built-in demo**: evaluate the main workflows without a Harbor installation.
- **Operational defaults**: structured logs, bounded requests and responses, rate limits, health checks, graceful shutdown, strict cookies and same-origin write protection.

## Requirements

| Item | Requirement |
| --- | --- |
| Harbor | v2.15.x |
| Prebuilt binaries | Linux, macOS or Windows on amd64 / arm64 |
| Building from source | Go 1.27.3+, Node.js 22.23.4+ (22.x), 24.22.1+ (24.x) or 26.12.1+, npm |
| Container image | Docker or another OCI builder |

## Quick Start

### 1. Download a release

Download the archive for your platform from [Releases](https://github.com/jiazixin/harbor-console/releases/latest) and verify it against `checksums.txt`. Replace `1.0.1` with the version you are installing:

```sh
VERSION=1.0.1
curl -LO "https://github.com/jiazixin/harbor-console/releases/download/v${VERSION}/harbor-console_${VERSION}_linux_amd64.tar.gz"
curl -LO "https://github.com/jiazixin/harbor-console/releases/download/v${VERSION}/checksums.txt"
sha256sum --ignore-missing -c checksums.txt
tar -xzf "harbor-console_${VERSION}_linux_amd64.tar.gz"
./harbor-console
```

Each archive contains the binary, `LICENSE`, both READMEs and [configs/config.example.yaml](configs/config.example.yaml). Windows archives are `.zip`. Only linux/amd64 runs in CI; the other targets are cross-compiled.

### 2. Connect

Open <http://127.0.0.1:8080> and enter a Harbor base URL, username, and password or CLI secret. **Preview with demo data** starts an isolated local session without contacting Harbor.

### 3. Build from source

Run from the repository root. The web bundle must be built first because `web/embed.go` embeds `web/dist/`:

```sh
go mod download
npm --prefix web ci --ignore-scripts
npm --prefix web run build
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -o bin/harbor-console ./cmd/harbor-console
./bin/harbor-console
```

## Configuration

Configuration file selection follows `-c` / `--config` > `CONFIG_FILE` > the optional `configs/config.local.yaml` under the working directory. Field precedence remains environment variables > YAML file > built-in defaults. An explicitly empty or missing path is an error, as are conflicting repeated configuration paths. Relative paths resolve against the process working directory, so use absolute paths in deployments.

```sh
cp configs/config.example.yaml configs/config.local.yaml
./bin/harbor-console -c "$PWD/configs/config.local.yaml"
# Equivalent long option: --config; environment selection also remains supported
CONFIG_FILE="$PWD/configs/config.local.yaml" ./bin/harbor-console
```

```sh
./bin/harbor-console -h          # Or --help: show usage
./bin/harbor-console --version   # Show version, commit and build date
```

Help and version commands do not read configuration or start the server. Starting without arguments retains the selection order above; a missing default file uses built-in defaults. Exit codes are 2 for argument errors, 1 for configuration or startup failures, and 0 for successful help/version output.

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `CONFIG_FILE` | YAML configuration path | `configs/config.local.yaml` when present |
| `LISTEN` | Listener address | `127.0.0.1` |
| `PORT` | Listener port | `8080` |
| `HEALTH_URI` | Health endpoint | `/health` |
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error` | `info` |
| `LOG_FORMAT` | `json` or `logfmt` | `json` |
| `ACCESS_LOG` | Enable request logs | `true` |
| `LOG_HEALTH_CHECKS` | Include health requests in access logs | `false` |
| `READ_HEADER_TIMEOUT` | Header read timeout | `5s` |
| `READ_TIMEOUT` | Request read timeout | `20s` |
| `WRITE_TIMEOUT` | Response write timeout | `30s` |
| `IDLE_TIMEOUT` | Keep-alive idle timeout | `90s` |
| `SHUTDOWN_TIMEOUT` | Graceful shutdown deadline | `10s` |

See [configs/config.example.yaml](configs/config.example.yaml) for the complete file.

## Deployment

### Docker

```sh
docker build -t harbor-console:local .
docker run --rm -p 127.0.0.1:8080:8080 harbor-console:local
```

The image is distroless, runs as `nonroot`, listens on `0.0.0.0:8080` and ships a default configuration at `/etc/harbor-console/config.yaml`. Mount your own when needed:

```sh
docker run --rm -p 127.0.0.1:8080:8080 \
  -v "$PWD/configs/config.local.yaml:/etc/harbor-console/config.yaml:ro" \
  harbor-console:local
```

The examples publish the port on `127.0.0.1` only. Bind it to other interfaces only behind an authenticated reverse proxy or an equivalent network boundary.

### State and backups

Sessions, Harbor credentials, demo state and rate limits live in process memory and are lost on restart. Logs go to stdout. The console creates no database or upload directory; Harbor owns and backs up its own data, and only the configuration file needs an optional read-only mount. Run a single replica — horizontal scaling would need shared sessions and rate limits, which are not implemented.

## Security Model

- The browser holds only a random `HttpOnly`, `SameSite=Strict` session cookie. Local and session storage contain non-secret UI preferences and public-catalog navigation state.
- Harbor passwords and CLI secrets stay in server memory and expire with the session. Instance URLs and usernames are returned to identify the active connection.
- Writes require a valid session and a same-origin request. Upstream redirects are limited to the same scheme and host. Requests and responses have size limits and timeouts. Access logs omit query strings and never intentionally log credentials.
- **Public catalog = outbound requests.** The unauthenticated catalog accepts a user-supplied Harbor URL and the server makes anonymous `GET` requests to three fixed endpoints. Treat it as an SSRF and egress boundary: restrict who can reach the console and enforce outbound DNS / IP / network-policy allowlists.
- Deploy behind HTTPS. A plain-HTTP Harbor URL exposes Basic Auth credentials between the console and Harbor. The "allow self-signed certificates" option disables TLS verification for that connection; use it only for trusted disposable or internal instances.

## Architecture

```text
Browser ──HttpOnly session cookie──▶ Harbor Console (Go)
                                       ├─ HTTP handlers and in-memory sessions
                                       ├─ typed Harbor v2.15 gateway
                                       ├─ embedded bilingual web client
                                       └─ isolated demo state
                                              │ Basic Auth / CLI secret
                                              ▼
                                     One or more Harbor instances
```

Design details are in [docs/DESIGN.md](docs/DESIGN.md).

## Development

```sh
npm --prefix web run dev      # Vite dev server with a proxy to the Go backend
npm --prefix web run check    # Prettier, ESLint, TypeScript
npm --prefix web run build    # web/dist; required before any Go command
npm --prefix web test         # contract and component tests
go vet ./cmd/... ./internal/... ./web
go test -race ./cmd/... ./internal/... ./web -count=1
npm --prefix web run test:browser   # Playwright route matrix
```

Browser engines, coverage, vulnerability audits and where to change what are covered in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). On pushes to `main` and on pull requests, [CI](.github/workflows/ci.yml) runs web and Go checks and tests, a dependency vulnerability audit, the Chromium / Firefox / WebKit route matrix, a container build and smoke test, and a GoReleaser snapshot build of every release target. Dependencies are updated manually; Actions and Docker base images are pinned by commit SHA and digest, which `scripts/check-deployment-pins.mjs` enforces.

## Versioning and Releases

- Releases are tagged `vMAJOR.MINOR.PATCH` (pre-releases such as `v1.2.0-rc.1` are marked as such automatically).
- Pushing a tag triggers the [Release workflow](.github/workflows/release.yml): it tests the tagged commit, checks that the built binary reports exactly that version and commit, then uses GoReleaser to publish archives and `checksums.txt` for linux / darwin / windows on amd64 and arm64.
- The version, commit and build date are injected with `-ldflags` into `internal/buildinfo`. They appear in `--version`, the `server_started` log line and on the About page. Plain `go build` reports `dev`.

Local dry run (nothing is published; output goes to the ignored `bin/release/`):

```sh
go install github.com/goreleaser/goreleaser/v2@v2.18.3
goreleaser check
goreleaser release --snapshot --clean
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | Architecture, API, session and deployment constraints |
| [docs/UI.md](docs/UI.md) | Colours, controls, tables, motion, keyboard and responsive rules |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Where to change what, checks, build and release |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | What was verified for the current release and what was not |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Notable changes and design decisions |

## Project Structure

```text
cmd/harbor-console/      executable entry point
internal/app/            HTTP application, sessions, gateway and demo
internal/config/         YAML and environment configuration
internal/observability/  structured and access logging
internal/buildinfo/      build version metadata
web/                     the only npm / Vite boundary: React source, tests, E2E, embed.go
configs/                 configuration example; local instances are ignored
scripts/                 repository checks used by CI
docs/                    design, implementation, acceptance and change records
.github/                 CI and tag release workflows
.goreleaser.yaml         GoReleaser multi-target release configuration
bin/                     ignored local binaries, including bin/release/ GoReleaser output
```

The directory baseline is maintained only in [目录规范.md](目录规范.md); collaboration rules are in [AGENTS.md](AGENTS.md). Directory exceptions for this project:

| Baseline rule | Actual behaviour | Reason | Scope / re-evaluate when |
| --- | --- | --- | --- |
| §3 root README | Chinese `README.md` is the main entry; the English translation is `README.en.md` | The maintainer wants the Chinese README shown first | Keep both in sync; re-evaluate if the English version is dropped |
| §7.1 configuration entry point | Add `-c` / `--config` ahead of `CONFIG_FILE`; retain default paths and field environment overrides | User-requested CLI options | Startup; revisit if the configuration protocol changes |
| §4 `bin/` holds executables only | GoReleaser output (binaries, archives, checksums, metadata) goes to `bin/release/` | A root `dist/` is not ignored and is reserved for Node / Web output | Release builds; when the release tool changes |

## Contributing

Issues and pull requests are welcome. Before submitting:

1. Read [AGENTS.md](AGENTS.md) and [目录规范.md](目录规范.md) and place new files according to them.
2. Run the checks under [Development](#development) locally; UI changes should also pass the browser route matrix.
3. Use the demo or a disposable Harbor instance for tests — never write to a production Harbor.

## License

Harbor Console is licensed under the [Apache License 2.0](LICENSE). This is an independent project and is not affiliated with the Harbor project or the CNCF.
