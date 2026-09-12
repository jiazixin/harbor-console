# Harbor Console

**简体中文** | [English](README.md)

Harbor Console 是面向 Harbor v2.15.2 的一体化管理控制台。它通过服务端类型化
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
- **类型化上游网关：** 浏览器只能调用明确声明的 Harbor v2.15.2 操作，不提供
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

项目只面向 Harbor v2.15.2 的非废弃操作，不保留旧 Harbor API 的兼容层。

## 环境要求

- Go 1.26.6 或更高版本
- Node.js 22 或更高版本，用于前端检查
- Docker 或其他 OCI 镜像构建工具

## 快速开始

使用内置默认配置运行：

```bash
go run ./cmd/harbor-console
```

打开 [http://127.0.0.1:8080](http://127.0.0.1:8080)，填写 Harbor 根地址、用户名和
密码或 CLI Secret。也可以直接进入演示模式，演示模式不会连接 Harbor。

使用配置文件：

```bash
cp configs/config.example.yaml config.yaml
CONFIG_FILE=./config.yaml go run ./cmd/harbor-console
```

## 配置

YAML 配置可以被环境变量覆盖。

| 环境变量              | 作用                               | 默认值                   |
| --------------------- | ---------------------------------- | ------------------------ |
| `CONFIG_FILE`         | YAML 配置文件路径                  | 存在时读取 `config.yaml` |
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
  -v "$PWD/config.yaml:/etc/harbor-console/config.yaml:ro" \
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
   |-- 类型化 Harbor v2.15.2 网关
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
frontend/               React、TypeScript、共享组件、领域页面、样式与测试
internal/webui/         Vite 生成产物与 Go 嵌入边界
configs/                部署配置示例
docs/                   架构决策与验收说明
scripts/                仓库质量检查工具
```

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
make format       # 格式化 Go 源码
make check        # 执行完整本地质量门
make security-check # 审计 npm 与可达 Go 漏洞
make coverage     # 生成并打印 Go 覆盖率
make build        # 构建 bin/harbor-console
make docker-build # 构建容器镜像
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

当前工作区已经由类型化 React 接管应用根节点、会话状态、路由、页面、Dialog 和全局
浮层，classic runtime 与兼容渲染器均已删除。本地质量、API 合同、安全、Chromium、
Firefox、WebKit 双语桌面/移动端、真实 Harbor v2.15.2 和容器运行 Gate 均已通过。
真实 Harbor 验收覆盖匿名目录，以及项目、身份、制品、策略、复制、扫描器、P2P、配额
和可恢复系统设置的完整流程，并包含权威回读、原值恢复和清理。当前实施范围的正式验收
结论为 `ACCEPTED`；原生 OIDC 登录明确不在本次实施范围内。
