<p align="center">
  <img src="web/public/favicon.svg" width="88" alt="Harbor Console logo">
</p>

<h1 align="center">Harbor Console</h1>

<p align="center">
  面向 Harbor v2.15 的一体化管理控制台：一个 Go 二进制，内嵌中英文 React 界面与服务端类型化 API 网关。
</p>

<p align="center">
  <a href="https://github.com/jiazixin/harbor-console/actions/workflows/ci.yml"><img src="https://github.com/jiazixin/harbor-console/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/jiazixin/harbor-console/releases/latest"><img src="https://img.shields.io/github/v/release/jiazixin/harbor-console?sort=semver" alt="Release"></a>
  <img src="https://img.shields.io/badge/Go-1.27.3-00ADD8?logo=go&logoColor=white" alt="Go 1.27.3">
  <img src="https://img.shields.io/badge/Harbor-v2.15.x-60B932" alt="Harbor v2.15.x">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache-2.0"></a>
</p>

<p align="center">
  <b>简体中文</b> · <a href="README.en.md">English</a>
</p>

---

Harbor Console 为 Harbor 管理员提供统一的工作区，覆盖项目、仓库、制品、安全、复制、保留、预热、用户、扫描器、审计和系统运维。浏览器不直接访问 Harbor：凭据保存在 Go 服务端，只转发明确声明的 Harbor v2.15 操作。React 产物、样式、翻译和演示数据全部嵌入二进制，运行时无需单独的前端服务、npm registry 或 CDN，适合纯内网环境。

> [!IMPORTANT]
> - **只支持 Harbor v2.15。** 操作合同取自 v2.15.2，与已在真实实例上验证的最新版本 v2.15.4 完全一致；不保留旧 Harbor API 的兼容层。
> - **上游使用 Basic Auth。** 使用 Harbor 用户名和密码，或 OIDC 用户的 CLI Secret 连接。暂未实现浏览器原生 OIDC 登录、OIDC onboarding 和数据库账号自助注册。

## 功能特性

- **完整的日常管理入口**：项目与成员、仓库与制品、Tag、Label、扫描、SBOM、保留、复制、远端仓库、机器人、Webhook、P2P 预热、审计、Job Service、扫描器、用户、用户组、配额和系统配置。
- **连接多个 Harbor**：一个浏览器会话最多保存 20 个相互隔离的连接并随时切换。凭据只在建立连接时提交一次，不会回传浏览器，也不会写入浏览器存储。
- **类型化上游网关**：方法、路径、查询字段和 JSON 请求体均使用白名单，不提供任意 URL 或方法代理。
- **中英文界面**：支持简体中文和英文，并保存语言、时区、CLI、主题和仓库视图偏好。
- **离线单二进制**：全部前端资源嵌入可执行文件，运行时不下载任何内容。
- **内置演示**：没有 Harbor 环境也能体验主要页面和操作流程。
- **生产运行基础**：结构化日志、请求与响应限制、限速、健康检查、优雅退出、严格 Cookie 和写操作同源校验。

## 运行要求

| 项目 | 要求 |
| --- | --- |
| Harbor | v2.15.x |
| 预编译版本 | Linux、macOS 或 Windows，amd64 / arm64 |
| 从源码构建 | Go 1.27.3+；Node.js 22.23.4+（22 系列）、24.22.1+（24 系列）或 26.12.1+；npm |
| 容器镜像 | Docker 或其他 OCI 镜像构建工具 |

## 快速开始

### 1. 下载预编译版本

在 [Releases](https://github.com/jiazixin/harbor-console/releases/latest) 下载对应平台的包，并用 `checksums.txt` 校验。将 `1.0.1` 替换为要安装的版本：

```sh
VERSION=1.0.1
curl -LO "https://github.com/jiazixin/harbor-console/releases/download/v${VERSION}/harbor-console_${VERSION}_linux_amd64.tar.gz"
curl -LO "https://github.com/jiazixin/harbor-console/releases/download/v${VERSION}/checksums.txt"
sha256sum --ignore-missing -c checksums.txt
tar -xzf "harbor-console_${VERSION}_linux_amd64.tar.gz"
./harbor-console
```

包内包含二进制、`LICENSE`、中英文 README 和 [configs/config.example.yaml](configs/config.example.yaml)，Windows 为 `.zip`。CI 只实际运行 linux/amd64，其余目标仅交叉编译。

### 2. 连接 Harbor

打开 <http://127.0.0.1:8080>，填写 Harbor 根地址、用户名和密码或 CLI Secret。点击“使用演示数据预览”可进入相互隔离的本地演示会话，不会连接 Harbor。

### 3. 从源码构建

在仓库根目录执行。必须先构建 Web，因为 `web/embed.go` 会把 `web/dist/` 嵌入二进制：

```sh
go mod download
npm --prefix web ci --ignore-scripts
npm --prefix web run build
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -o bin/harbor-console ./cmd/harbor-console
./bin/harbor-console
```

## 配置

配置文件选择顺序为 `-c` / `--config` > `CONFIG_FILE` > 工作目录下可选的 `configs/config.local.yaml`。文件内的字段仍按环境变量 > YAML 文件 > 内置默认值覆盖。显式指定空路径或不存在的文件会报错；多次指定不一致的配置路径也会报错。相对路径以进程工作目录为基准，部署时建议使用绝对路径。

```sh
cp configs/config.example.yaml configs/config.local.yaml
./bin/harbor-console -c "$PWD/configs/config.local.yaml"
# 等价长参数：--config；也可继续使用环境变量
CONFIG_FILE="$PWD/configs/config.local.yaml" ./bin/harbor-console
```

```sh
./bin/harbor-console -h          # 或 --help：显示帮助
./bin/harbor-console --version   # 显示版本、提交与构建时间
```

帮助和版本命令不读取配置、不启动服务。无参数启动仍使用上述配置选择顺序，默认文件缺失时使用内置默认值。参数错误退出码为 2，配置或启动失败为 1，帮助和版本正常输出为 0。

| 环境变量 | 作用 | 默认值 |
| --- | --- | --- |
| `CONFIG_FILE` | YAML 配置文件路径 | 存在时读取 `configs/config.local.yaml` |
| `LISTEN` | 监听地址 | `127.0.0.1` |
| `PORT` | 监听端口 | `8080` |
| `HEALTH_URI` | 健康检查路径 | `/health` |
| `LOG_LEVEL` | `debug`、`info`、`warn` 或 `error` | `info` |
| `LOG_FORMAT` | `json` 或 `logfmt` | `json` |
| `ACCESS_LOG` | 是否记录访问日志 | `true` |
| `LOG_HEALTH_CHECKS` | 是否记录健康检查请求 | `false` |
| `READ_HEADER_TIMEOUT` | 请求头读取超时 | `5s` |
| `READ_TIMEOUT` | 请求读取超时 | `20s` |
| `WRITE_TIMEOUT` | 响应写入超时 | `30s` |
| `IDLE_TIMEOUT` | Keep-Alive 空闲超时 | `90s` |
| `SHUTDOWN_TIMEOUT` | 优雅退出期限 | `10s` |

完整示例见 [configs/config.example.yaml](configs/config.example.yaml)。

## 部署

### Docker

```sh
docker build -t harbor-console:local .
docker run --rm -p 127.0.0.1:8080:8080 harbor-console:local
```

镜像基于 distroless，以 `nonroot` 用户运行，监听 `0.0.0.0:8080`，默认配置位于 `/etc/harbor-console/config.yaml`。需要时挂载自定义配置：

```sh
docker run --rm -p 127.0.0.1:8080:8080 \
  -v "$PWD/configs/config.local.yaml:/etc/harbor-console/config.yaml:ro" \
  harbor-console:local
```

示例只把端口发布到 `127.0.0.1`。只有在已配置认证反向代理或等效网络边界后，才应绑定到其他地址。

### 状态与备份

会话、Harbor 凭据、演示状态和限速数据都保存在进程内存中，重启即丢失；日志输出到标准输出。控制台不创建数据库或上传目录，Harbor 自身的数据由 Harbor 负责备份，本项目只需按需只读挂载配置文件。请只部署一个副本：横向扩容需要共享会话与共享限速，目前未实现。

## 安全边界

- 浏览器只持有一个随机的 `HttpOnly`、`SameSite=Strict` 会话 Cookie；Local Storage 与 Session Storage 只保存非敏感界面偏好和公开目录导航状态。
- Harbor 密码和 CLI Secret 只保存在服务端内存中并随会话过期；实例地址和用户名会返回浏览器，用于标识当前连接。
- 写操作必须具备有效会话并通过同源校验；上游重定向限于相同协议和主机；请求与响应均有大小和时间限制；访问日志不记录查询字符串，也不会主动记录凭据。
- **公开目录会产生出站请求。** 未登录公开目录接受用户提供的 Harbor 地址，由服务端向三个固定接口发起匿名 `GET`。这是 SSRF 与出站访问信任边界：请限制谁能访问控制台，并通过 DNS、IP 白名单或网络策略约束出站目标。
- 生产环境应部署在 HTTPS 之后。用 HTTP 连接 Harbor 时，控制台与 Harbor 之间的 Basic Auth 凭据不加密。“允许自签名证书”会关闭该连接的证书校验，只能用于可信的临时或内网实例。

## 架构

```text
浏览器 ──HttpOnly 会话 Cookie──▶ Harbor Console（Go）
                                  ├─ HTTP 处理器与内存会话
                                  ├─ 类型化 Harbor v2.15 网关
                                  ├─ 嵌入式中英文 Web 客户端
                                  └─ 相互隔离的演示状态
                                         │ Basic Auth / CLI Secret
                                         ▼
                                一个或多个 Harbor 实例
```

设计细节见 [docs/DESIGN.md](docs/DESIGN.md)。

## 开发

```sh
npm --prefix web run dev      # Vite 开发服务器，代理到 Go 后端
npm --prefix web run check    # Prettier、ESLint、TypeScript
npm --prefix web run build    # 生成 web/dist；任何 Go 命令之前必须执行
npm --prefix web test         # 合同与组件测试
go vet ./cmd/... ./internal/... ./web
go test -race ./cmd/... ./internal/... ./web -count=1
npm --prefix web run test:browser   # Playwright 路由矩阵
```

浏览器引擎安装、覆盖率、漏洞审计和“改哪里”见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。推送到 `main` 和提交 Pull Request 时，[CI](.github/workflows/ci.yml) 会运行 Web 与 Go 检查和测试、依赖漏洞审计、Chromium / Firefox / WebKit 路由矩阵、容器构建与 smoke test，以及覆盖全部发布目标的 GoReleaser 快照构建。依赖由维护者手动升级；Actions 与 Docker 基础镜像分别固定到提交 SHA 和 digest，由 `scripts/check-deployment-pins.mjs` 检查。

## 版本与发布

- 发布 tag 采用 `v主版本.次版本.修订版本`，预发布如 `v1.2.0-rc.1` 会自动标为 Pre-release。
- 推送 tag 触发 [Release 工作流](.github/workflows/release.yml)：先测试该提交，核对构建出的二进制恰好报告该版本和提交，再由 GoReleaser 发布 linux / darwin / windows 的 amd64 与 arm64 包及 `checksums.txt`。
- 版本、提交和构建时间通过 `-ldflags` 注入 `internal/buildinfo`，显示在 `--version`、`server_started` 日志和“关于”页面中；直接 `go build` 显示 `dev`。

本地预演（不发布，输出在忽略的 `bin/release/`）：

```sh
go install github.com/goreleaser/goreleaser/v2@v2.18.3
goreleaser check
goreleaser release --snapshot --clean
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | 架构，API、会话与部署约束 |
| [docs/UI.md](docs/UI.md) | 颜色、控件、表格、动效、键盘与响应式规范 |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | 修改位置、检查命令、构建与发布 |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | 当前发布验证了什么、哪些尚未覆盖 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 重要变更与设计决定 |

## 项目结构

```text
cmd/harbor-console/      可执行程序入口
internal/app/            HTTP 应用、会话、网关和演示
internal/config/         YAML 与环境变量配置
internal/observability/  结构化日志与访问日志
internal/buildinfo/      构建版本元数据
web/                     唯一的 npm / Vite 边界：React 源码、测试、E2E、embed.go
configs/                 配置示例；本地实例被忽略
scripts/                 CI 使用的仓库检查脚本
docs/                    设计、实施、验收与变更记录
.github/                 CI 与 tag 发布工作流
.goreleaser.yaml         GoReleaser 多目标发布配置
bin/                     忽略的本机二进制，含 bin/release/ GoReleaser 产物
```

目录基线只在 [目录规范.md](目录规范.md) 维护，协作规则见 [AGENTS.md](AGENTS.md)。本项目的目录例外：

| 基线规则 | 实际行为 | 原因与依据 | 适用范围 / 重新评估条件 |
| --- | --- | --- | --- |
| §3 根目录 README | 中文 `README.md` 为主入口，英文翻译为 `README.en.md` | 用户要求中文 README 优先展示 | 两份同步维护；放弃英文版时评估 |
| §7.1 配置入口 | 增加 `-c` / `--config`，优先于 `CONFIG_FILE`；默认路径和字段环境覆盖保持不变 | 用户要求增加命令行参数 | 程序启动；配置协议改变时评估 |
| §4 `bin/` 只放可执行文件 | GoReleaser 输出（二进制、压缩包、checksums、元数据）在 `bin/release/` | 根 `dist/` 未被忽略，且保留给 Node / Web 产物 | 发布构建；更换发布工具时评估 |

## 参与贡献

欢迎提交 Issue 和 Pull Request。提交前请：

1. 阅读 [AGENTS.md](AGENTS.md) 与 [目录规范.md](目录规范.md)，新文件按其中的目录规则放置；
2. 在本地运行上文“开发”中的检查，界面改动还需通过浏览器路由矩阵；
3. 测试只使用演示模式或可丢弃的 Harbor 实例，不要写入生产 Harbor。

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。本项目为独立项目，与 Harbor 项目及 CNCF 无隶属关系。
