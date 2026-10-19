# Harbor Console

**简体中文** | [English](README.md)

Harbor Console 是面向 Harbor v2.15.x 的一体化管理控制台。它通过服务端类型化
API 网关连接 Harbor，在同一工作区内提供项目、仓库、制品、安全、复制、保留、
预热、用户、扫描器、审计和系统运维能力。

应用以单个 Go 二进制发布，React 生产包、样式、翻译和演示数据全部嵌入，运行时
无需单独部署前端服务、访问 npm registry 或外部 CDN，适合纯内网环境。

## 主要能力

- **完整的日常管理入口：** 项目与成员、仓库与制品、Tag、Label、扫描、SBOM、
  保留、复制、远端仓库、机器人、Webhook、P2P 预热、审计、Job Service、扫描器、
  用户、用户组、配额和系统配置。
- **连接多个 Harbor：** 一个浏览器会话最多保存 20 个相互隔离的 Harbor 连接，
  可以随时切换。凭据只在建立连接时由浏览器提交，连接成功后不会回传，也不会持久化到
  浏览器存储。
- **类型化上游网关：** 浏览器只能调用明确声明的 Harbor v2.15 操作，不提供
  任意上游 URL 或 HTTP 方法代理。
- **中英文界面：** 支持简体中文和英文，并保存语言、时区、CLI、主题和仓库视图偏好。
- **完全离线：** 所有前端资源均嵌入可执行文件。
- **内置演示：** 没有 Harbor 环境也能验证主要页面和操作流程。
- **生产运行基础：** 结构化日志、请求与响应限制、优雅退出、健康检查、限速、
  严格 Cookie 和写操作同源校验。

## 当前范围

Harbor Console 目前通过 Harbor Basic Auth 访问上游。OIDC 用户可以使用 Harbor
用户名和 CLI Secret 连接。暂未实现浏览器原生 OIDC 跳转登录、OIDC onboarding
和数据库账号自助注册。

项目只面向 Harbor v2.15 的非废弃操作，不保留旧 Harbor API 的兼容层。操作合同取自
v2.15.2，与已在真实实例上验证的最新版本 v2.15.4 完全一致。

## 环境要求

- Go 1.26.9 或更高版本
- Node.js 22.22.2+（22 系列）、24.15.0+（24 系列）或 26+，用于前端检查
- Docker 或其他 OCI 镜像构建工具

## 快速开始

使用内置默认配置运行：

```bash
go mod download
npm --prefix web ci --ignore-scripts
npm --prefix web run build
go run ./cmd/harbor-console
```

打开 [http://127.0.0.1:8080](http://127.0.0.1:8080)，填写 Harbor 根地址、用户名和
密码或 CLI Secret。也可以直接进入演示模式，演示模式不会连接 Harbor。

使用配置文件：

```bash
cp configs/config.example.yaml configs/config.local.yaml
CONFIG_FILE="$PWD/configs/config.local.yaml" go run ./cmd/harbor-console
```

## 配置

YAML 配置可以被环境变量覆盖。

| 环境变量              | 作用                               | 默认值                   |
| --------------------- | ---------------------------------- | ------------------------ |
| `CONFIG_FILE`         | YAML 配置文件路径                  | 存在时读取 `configs/config.local.yaml` |
| `LISTEN`              | 监听地址                           | `127.0.0.1`              |
| `PORT`                | 监听端口                           | `8080`                   |
| `HEALTH_URI`          | 健康检查路径                       | `/health`                |
| `LOG_LEVEL`           | `debug`、`info`、`warn` 或 `error` | `info`                   |
| `LOG_FORMAT`          | `json` 或 `logfmt`                 | `json`                   |
| `ACCESS_LOG`          | 是否记录访问日志                   | `true`                   |
| `LOG_HEALTH_CHECKS`   | 是否记录健康检查请求               | `false`                  |
| `READ_HEADER_TIMEOUT` | 请求头读取超时                     | `5s`                     |
| `READ_TIMEOUT`        | 请求读取超时                       | `20s`                    |
| `WRITE_TIMEOUT`       | 响应写入超时                       | `30s`                    |
| `IDLE_TIMEOUT`        | Keep-Alive 空闲超时                | `90s`                    |
| `SHUTDOWN_TIMEOUT`    | 优雅退出期限                       | `10s`                    |

完整示例见 [configs/config.example.yaml](configs/config.example.yaml)。

## 容器运行

```bash
docker build -t harbor-console:local .
docker run --rm -p 127.0.0.1:8080:8080 harbor-console:local
```

镜像使用非 root 用户运行，监听 `0.0.0.0:8080`，默认配置位于
`/etc/harbor-console/config.yaml`。

挂载自定义配置：

```bash
docker run --rm -p 127.0.0.1:8080:8080 \
  -v "$PWD/configs/config.local.yaml:/etc/harbor-console/config.yaml:ro" \
  harbor-console:local
```

示例默认只把主机端口发布到 `127.0.0.1`，不会直接暴露到网络。只有在已经配置
认证反向代理或等效网络边界后，才应有意改为其他主机绑定地址。

## 架构

```text
浏览器
   |
   | HttpOnly 控制台会话 Cookie
   v
Harbor Console（Go）
   |-- HTTP 处理器与内存连接会话
   |-- 类型化 Harbor v2.15 网关
   |-- 嵌入式中英文 Web 客户端
   |-- 相互隔离的演示状态
   |
   | 服务端 Basic Auth / CLI Secret
   v
一个或多个 Harbor 实例
```

仓库目录：

```text
cmd/harbor-console/     可执行程序入口
internal/app/           HTTP 应用、会话、网关和演示编排
internal/config/        YAML 与环境变量配置
internal/observability/ 结构化日志与访问日志
internal/buildinfo/     构建版本元数据
web/                    React、TypeScript、共享组件、领域页面、样式与测试
web/embed.go            Go 嵌入入口（包名 webui）
web/dist/               Vite 生成产物（不提交）
configs/                部署配置示例
docs/                   设计、开发、验收与变更记录
scripts/                仓库质量检查工具
```

目录布局遵循根目录 [目录规范.md](目录规范.md)。`web/` 独立拥有 npm 清单、锁文件、Vite/TypeScript/ESLint 配置、`src/`、`public/`、`tests/` 和 `e2e/`；Go 单元测试靠近源码，固定测试数据放 `internal/app/testdata/`。`internal/app` 的网关、会话和演示逻辑共享内部类型，保留单包边界。

所有示例命令均从仓库根目录执行。先安装依赖，再运行 `npm --prefix web run build` 生成 `web/dist/`，然后执行 Go 构建、启动、测试、vet 或浏览器测试。生成资源不提交；CI/CD 在 `.github/workflows/ci.yml` 中直接编排检查、测试和构建。Go 覆盖率报告放在 `coverage/go.out`，清理产物时必须保留配置和业务数据。

配置优先级为环境变量 > YAML > 内置默认值。`CONFIG_FILE` 相对路径以进程工作目录为基准，部署时建议使用绝对路径；显式指定空路径或不存在的文件会报错。未设置该变量时读取工作目录下的 `configs/config.local.yaml`（不存在则使用默认值）。本地配置统一放在被忽略的 `configs/config.local.yaml`，不自动查找根目录或 `bin/` 下的旧配置。Vite 的本地环境文件位于 `web/.env*`，不进入 Git 或容器上下文。

应用会话与演示状态保存在内存，日志输出到标准输出，不创建本地数据库或上传目录；重启会丢失会话。外部 Harbor 持久数据由 Harbor 自身负责备份，部署本项目仅需按需只读挂载配置。历史记录和已完成计划归入 `docs/archive/`，当前操作以 README 和开发文档为准。

## 安全边界

- 浏览器认证状态只有一个随机的 `HttpOnly`、`SameSite=Strict` 控制台会话 ID；
  Local Storage 和 Session Storage 仅保存非敏感界面偏好与公开目录导航状态。
- Harbor 密码和 CLI Secret 只保存在进程内存中，并随会话过期；实例地址和用户名会
  返回浏览器，用于标识当前连接。
- 写操作必须具备有效会话并通过同源校验。
- 上游方法、路径、查询字段和 JSON 请求体均使用白名单。
- 上游重定向只能发生在相同协议和主机内。
- 请求、响应和执行时间均有明确限制。
- 访问日志不记录查询字符串，也不会主动记录密码或 Token。

未登录公开目录属于服务端出站请求功能：它接受用户提供的 Harbor 地址，并由服务端
向三个固定的匿名 `GET` 目录接口发起请求。这是 SSRF 与出站访问（egress）信任边界，
不是任意代理。部署时必须通过 DNS、IP 白名单、网络策略或防火墙限制可访问目标，
并且不要把公开目录直接开放给不可信用户。

会话、Harbor 凭据、演示状态和限速数据均保存在单个进程内。进程重启会断开全部浏览器
会话。当前应部署单个应用副本；若要无状态横向扩容，需要另行实现共享会话与共享限速，
目前不在支持范围内。

生产环境应部署在 HTTPS 反向代理之后。如果使用 HTTP 连接 Harbor，控制台与
Harbor 之间传输的 Basic Auth 凭据不会被加密。
“允许自签名证书”（Skip TLS）会关闭所选连接的证书校验，只能用于可信的临时或内网
Harbor；生产环境或不可信目标不得启用。

## 开发命令

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

GitHub Actions 使用同一套质量门和依赖漏洞审计，并在 Chromium、Firefox 和 WebKit
中执行认证后路由矩阵，同时完成镜像构建、非 root 运行、健康检查、嵌入式界面和
优雅退出的 smoke test。浏览器运行时不会再下载 npm 模块，React 与依赖已编入嵌入式
Vite 产物。Dependabot 检查 Actions、Go 模块、npm 依赖和 Docker 基础镜像。

## 文档

- [文档索引](docs/README.md)
- [设计基线](docs/DESIGN.md)
- [实施规范](docs/IMPLEMENTATION.md)
- [验收计划](docs/ACCEPTANCE.md)
- [变更记录](docs/CHANGELOG.md)

## 项目状态

当前应用使用类型化 React 管理会话、路由、页面、Dialog 和全局浮层。
本轮上线前检查的结果、修复及未完成的部署验证统一记录在
[验收记录](docs/ACCEPTANCE.md)。历史真实 Harbor 或容器通过记录不能替代当前工作区
的发布验证；上线前须完成目标 Harbor 和容器环境的验收。
