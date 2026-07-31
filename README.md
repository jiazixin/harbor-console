# Harbor Console / Harbor 控制台

A Go-based Harbor control plane with a Cloudflare-inspired, high-density interface. It uses Harbor's official API to manage projects, repositories, artifacts, scans, retention, replication, remote registries, and system administration. The interface supports English and Simplified Chinese, works fully offline, and ships as a single binary.

一个用 Go 编写的 Harbor 控制端。界面采用类似 Cloudflare 控制台的高密度布局，通过 Harbor 官方 API 提供项目、仓库、制品、扫描、保留策略、复制、远端仓库和系统管理能力；支持简体中文与英文，并可作为单个二进制在纯内网环境运行。

## 明确目标

- 用户界面支持简体中文和英文；首次访问按浏览器语言自动选择，右上角可随时切换并记住选择。
- 通过服务端连接 Harbor API v2，浏览器不直接接触 Harbor 凭据。
- 单个 Go 二进制包含全部前端资源，便于在内网部署。
- 没有 Harbor 环境时，可以通过内置演示数据验证全部主要页面与交互。
- 桌面和移动端均保持可读、可操作，不产生页面级横向溢出。

## 当前能力

- 项目：服务端分页、筛选、排序、单项/批量删除和单项目 CVE 导出，以及新建、编辑、用户与用户组成员、机器人账号、Webhook、不可变 Tag、Tag 保留、项目扫描器和项目配置；LDAP 认证模式下可通过官方目录接口搜索并添加项目组成员，Webhook 支持执行历史、任务明细和日志，Tag 保留支持仓库级处理结果与任务日志。
- 仓库与制品：服务端分页、搜索、排序、列表/卡片视图、推送命令指引、仓库单项/批量删除、制品详情、Tag 新增/删除/复制、漏洞报告、SBOM、重新扫描和制品删除；通过官方 `Artifact.references[].platform` 识别 OCI 多架构镜像并显示全部子平台和摘要。
- 分发：复制策略和执行记录支持服务端分页、筛选与排序，并提供策略新增/编辑/删除/手动执行、执行详情、任务列表、单任务日志和运行中任务停止。
- 远端仓库：新增/编辑/删除和保存前连通性检测；表单读取 Harbor 官方 Adapter 元数据，自动呈现 Docker Hub 固定地址、ACR/ECR/GCR 官方端点选项及各类型凭据要求。
- 制品安全：风险概览、漏洞明细、CVE 导出、系统白名单和扫描器管理；扫描器支持注册、编辑、连通性检测、设为默认、删除，以及官方 metadata 中的能力、输入/输出 MIME 类型和自定义属性查看。
- 管理：系统机器人账号、用户、用户组、配额、垃圾清理、全局扫描计划、审计日志清理、Job Service 任务监控和系统配置；数据库认证模式显示本地用户创建入口，LDAP 认证模式支持目录搜索和批量导入。审计清理支持计划、事件范围、演练、执行历史、停止和日志，任务监控支持工作池、工作器、运行任务、队列、定时任务及官方允许的暂停、恢复、停止和日志操作。
- 审计：使用 Harbor 官方扩展审计接口，支持服务端分页，以及按用户名、资源、事件类型和执行结果筛选；事件和操作说明采用“中文 [Harbor 英文原文]”显示，兼顾中文可读性与原始记录可追溯性。
- 多实例：单个浏览器会话可新增、切换和移除最多 20 个 Harbor 连接；各实例状态和凭据彼此隔离。
- 概览：分页读取全部可见项目及其全部仓库，可按存储占用、仓库数量和 Tag/制品数量排序。
- 公共目录与产品信息：未登录页可通过 Harbor 官方匿名 API 浏览公开项目、仓库和制品，不创建登录会话；登录后可查看控制端/Harbor 版本与 Harbor 上游许可证，并可在新标签页打开当前实例的官方 Swagger。
- 浏览器偏好与任务进度：可选择浏览器时区或 UTC、Docker/Podman/nerdctl 命令和仓库默认视图；批量扫描、SBOM、复制、清理和全量扫描等任务会进入全局操作中心，跨页面保留进度并显示逐项结果。

后端映射基线为 Harbor v2.15.2 官方 `api/v2.0/swagger.yaml`。浏览器只能调用控制台定义的类型化操作，不能传入任意 Harbor API 路径；公开目录允许指定 Harbor 根地址，但只能匿名调用项目、仓库和制品三个固定读取接口。

## 本地运行

环境要求：Go 1.24 或更高版本。

```bash
go run .
```

默认读取当前目录的 `config.yaml`，监听 `127.0.0.1:8080`，打开 [http://127.0.0.1:8080](http://127.0.0.1:8080)。未找到默认配置文件时使用相同的内置默认值；通过 `CONFIG_FILE` 显式指定的文件不存在或内容无效时，程序会拒绝启动。

```yaml
server:
  listen: 127.0.0.1
  port: 8080
  read_header_timeout: 5s
  read_timeout: 20s
  write_timeout: 30s
  idle_timeout: 90s
  shutdown_timeout: 10s
health:
  uri: /health
logging:
  level: info
  format: json
  access_log: true
  log_health_checks: false
```

环境变量优先级高于 YAML，适合 Docker、Kubernetes 和 systemd 部署：

| 环境变量 | 作用 |
| --- | --- |
| `CONFIG_FILE` | YAML 配置文件路径 |
| `LISTEN` / `PORT` | 分别覆盖监听主机和端口 |
| `HEALTH_URI` | 覆盖主健康检查路径 |
| `LOG_LEVEL` | `debug`、`info`、`warn` 或 `error` |
| `LOG_FORMAT` | `json` 或 `logfmt` |
| `ACCESS_LOG` | 是否记录 HTTP 访问日志 |
| `LOG_HEALTH_CHECKS` | 是否记录健康探测请求，默认关闭 |
| `READ_HEADER_TIMEOUT` / `READ_TIMEOUT` / `WRITE_TIMEOUT` | HTTP 请求超时，例如 `20s` |
| `IDLE_TIMEOUT` / `SHUTDOWN_TIMEOUT` | 空闲连接和优雅退出超时 |

连接页面需要填写 Harbor 根地址、用户名和密码。只浏览公开目录时仅需填写 Harbor 地址，不会创建登录会话。登录后可从右上角继续添加或切换实例。自签名证书选项只应在可信内网中使用。

界面语言默认按浏览器偏好判断：语言列表中存在 `zh-*` 时使用简体中文，其余语言使用英文。登录首页和登录后的顶栏都提供语言切换；手动选择保存在浏览器 `localStorage` 中，刷新、切换实例或重新登录后仍然生效。Harbor 返回的资源名、用户输入和原始日志内容不会被翻译。

## Docker 部署

```bash
docker build -t harbor-console .
docker run --rm -p 8080:8080 harbor-console
```

容器内置 `/config.yaml`，并通过环境变量监听 `0.0.0.0:8080`。挂载自定义配置时可以使用：

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/config.yaml:/config.yaml:ro" \
  harbor-console
```

主健康检查地址默认为 `GET /health`。路径可以通过 `health.uri` 或 `HEALTH_URI` 修改；健康状态只表示控制台进程可服务，不依赖是否已登录 Harbor 实例。

```json
{"service":"harbor-console","status":"ok","uptime_seconds":42}
```

成功返回 HTTP `200` 和 `Cache-Control: no-store`。非 `GET` 请求返回 `405`。Kubernetes 可将 `/health` 同时用于 `livenessProbe` 和 `readinessProbe`；如果后续需要区分进程存活与外部依赖就绪，再拆分独立探针。

日志使用 Go 标准库 `slog`。JSON 适合 Loki、Elasticsearch 和云日志平台；`logfmt` 适合直接阅读和键值检索。访问日志包含请求方法、路径、状态码、耗时、响应字节和客户端地址，不记录查询字符串；4xx 使用 `warn`，5xx 使用 `error`，健康探测默认不记录。

## Harbor 权限

连接验证会读取官方 `GET /api/v2.0/projects`。权限完全沿用当前 Harbor 账号：普通项目成员可以操作自己有权限的项目、仓库与制品；项目管理员可管理项目成员、机器人、Webhook、Tag 规则和扫描器设置；复制策略、远端仓库、用户、用户组、全局扫描器、垃圾清理和系统配置通常需要 Harbor 系统管理员权限。单个管理员接口返回 `403` 时，其他可用页面仍能继续使用，并按当前界面语言显示错误说明。

## 安全边界

- Cookie 仅保存 256 位随机会话标识，设置了 `HttpOnly` 与 `SameSite=Strict`。
- Harbor 地址、用户名和密码只保存在当前 Go 进程内存中，会话 12 小时后失效，不写入磁盘或浏览器存储。
- 每个会话复用独立的 Harbor HTTP 客户端，设置连接超时、TLS 最低版本和同域重定向限制。
- 后端只代理预定义的 Harbor 资源，不提供任意 URL 转发接口。
- 登录、演示与匿名目录端点按来源地址分别限速，活跃会话数量也有硬上限，避免进程内存被无界占用。
- 生产部署应在 HTTPS 反向代理后运行。使用 HTTP Harbor 地址时，Basic Auth 凭据在控制台服务与 Harbor 之间不会被加密。
- Harbor 地址本身属于有意开放的连接目标，因此应只向可信用户开放本控制台，避免它被当作内网探测入口。
- 所有创建、修改、执行和删除操作都固定映射 Harbor v2.15.2 官方 API，并对路径、查询参数和 JSON 请求体进行白名单及类型校验。

## 开发验证

```bash
gofmt -w *.go
go test -race ./...
go vet ./...
node --check web/app.js
node --check web/i18n.js
node --check web/control-ui.js
node --check web/admin-ui.js
docker build -t harbor-console .
```

自动测试覆盖 URL 校验、会话保护、多实例隔离、Basic Auth、匿名公开目录、错误归一化、官方 API 路径和方法、请求体校验、分页响应头、LDAP 搜索/导入/项目组成员、扫描器 metadata、扩展审计日志、官方多架构字段、Webhook/Tag 保留任务、审计清理、Job Service、演示状态生命周期、健康检查、离线前端资源和查询白名单。浏览器验收覆盖中英文登录与切换、公共目录、项目到制品钻取、多架构列表与详情、LDAP 目录弹窗、扫描器元数据、About/Swagger 入口、Webhook 执行历史、Tag 保留仓库任务、审计清理、任务监控、系统机器人细粒度权限、扫描/复制/清理/预热结构化日志、扩展审计筛选、官方远端仓库表单、多实例、表单错误态、全局搜索、主题切换、移动导航和响应式表格。
