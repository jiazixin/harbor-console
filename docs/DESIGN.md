# 架构与边界

维护基线：2026-10-02。视觉与交互规范独立放在 [UI.md](UI.md)。

## 产品范围

Harbor Console 是面向 Harbor v2.15.2 的单进程管理控制台：项目、仓库、制品、扫描与 SBOM、复制、保留、Webhook、机器人、P2P 预热、审计及系统管理。支持简体中文/英文、亮色/暗色和多实例连接。

浏览器提交 Basic Auth 密码或 Harbor CLI Secret 建立连接。原生 OIDC 跳转、OIDC onboarding、数据库账号自助注册、旧版废弃 API 和多副本共享会话不在当前实现范围内。

## 运行结构

```text
浏览器 React 客户端
    │ 同源 Console API + HttpOnly 会话 Cookie
Go HTTP 服务
    ├─ 路由、请求限制、日志与安全响应头
    ├─ 内存会话、多实例连接与 demo 状态
    ├─ 固定类型化 Harbor API 网关
    └─ embed 嵌入 Vite 生产资源
    │ 服务端 Basic Auth / CLI Secret
Harbor v2.15.2
```

| 目录 | 职责 |
| --- | --- |
| `cmd/harbor-console` | 进程启动 |
| `internal/app` | 路由、会话、固定 API 网关、校验、demo 与操作编排 |
| `internal/config` | YAML 与环境变量配置 |
| `internal/observability` | 应用与访问日志 |
| `internal/buildinfo` | 编译时版本、提交与时间 |
| `web/src/app` | 类型、API 客户端、路由、语言、偏好与应用装配 |
| `web/src/layouts` | 侧栏、顶栏和全局浮层 |
| `web/src/components` | 共享控件、表格、弹窗和状态 |
| `web/src/features` | 各业务领域页面、专用组件、样式、就近测试及写操作 |
| `web/src/styles` | 全局主题、布局基础与跨业务域共享样式 |
| `web/embed.go` | Go 资源嵌入入口，包名 webui |
| `web/dist` | Vite 生成资源；不可手工编辑 |

React、翻译、图标和样式都嵌入二进制，生产运行不需要 npm、CDN 或外部字体服务。业务页面和弹窗按需加载；全局与业务样式仍按 `main.tsx` 显式顺序一次加载。带哈希的 bundle 使用一年 immutable 缓存，HTML 要求重新验证，资源更新通过新哈希生效。Vite 开发服务器仅用于开发，通过代理连接 Go 后端。

## API 合同

- 198 个非废弃 method/path 操作由 `internal/app/testdata/harbor-v2.15.2-stable-operations.txt` 与合同测试固定。
- `harbor_operations.go` 声明上游方法、路径、路径/查询参数、请求体验证和响应语义。新增能力必须显式注册，不接受任意 URL、method/path 代理。
- HEAD 与 GET 独立；列表统一 `items + pagination`，总数来自上游 `X-Total-Count`。
- 项目名、仓库路径、digest、reference、metadata name 按各自语义验证与转义。仓库路径的双重编码不能简化为通用字符串替换。
- 排序字段必须在上游 operation 合同中允许。派生字段需要完整的权限范围数据，不能把当前页排序伪装成全量排序。
- 写入成功后刷新或权威回读；删除先执行可用的官方预检，并明确显示目标与确认步骤。
- 每个 Console API 请求的全部上游阶段共享总预算，取 18 秒与 `WRITE_TIMEOUT` 的 90% 中较小值；已有更早 deadline 与取消信号优先，预算耗尽后不启动下一阶段。系统 CVE Allowlist 写入获成功响应但确认失败时，明确提示已接受写入、最终状态未确认，先刷新回读再决定是否重试。

## 会话与信任边界

- 凭据只保存在 Go 进程内存；浏览器不持久化 Harbor 密码、CLI Secret、Token 或 Cookie。
- 控制台会话有效期 12 小时；最多 1000 个会话，每会话最多 20 个连接。进程重启使会话失效。
- 切换实例同时切换身份、HTTP Client、URL、TLS 设置和 demo 状态；数据、缓存和未完成请求不得跨实例混用。
- Cookie 使用 `HttpOnly`、`SameSite=Strict`；HTTPS 使用 `Secure`。写请求要求有效会话与同源 Origin。
- 请求体 1 MiB、上游响应 8 MiB、查询字符串 8 KiB；TLS 最低 1.2；最多三次同协议同主机重定向。
- Harbor 地址仅接受 HTTP(S) 根地址，不接受 userinfo、路径前缀、查询或 fragment。Skip TLS 按连接隔离，并在 UI 明示。
- 匿名公开目录调用固定只读接口，不创建登录会话。目标地址仍属于部署侧网络访问边界，由网络策略限制可达目标。
- 凭据不得进入 URL、日志、错误文本、截图和文档。访问日志不记录查询字符串。

## 前端状态

React 组件持有状态，类型化 API helper 承担请求；不引入字符串 DOM renderer、全局 HTML 替换或旧版兼容运行时。副作用使用 AbortController 或请求版本丢弃过期结果。会话操作拥有统一请求所有权，切换、退出和取消后旧响应不能回写；身份回调限定到发起操作的实例。可选浏览器存储不可用时仍可继续使用默认偏好。

页面刷新保持已有数据和内容容器，避免空白闪烁。排序、筛选、分页不改变页面组件 identity。跨项目聚合采用有上限的 worker pool，单项完成即可补位，处理部分失败和权限限制。

Demo 用于确定性 UI 与生命周期验证；其通过不证明真实 Harbor 的权限、字段、写入、外部复制或部署行为通过。发布范围见 [验收文档](ACCEPTANCE.md)。
