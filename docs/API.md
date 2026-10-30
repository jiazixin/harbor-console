# 接口约定

本文是控制台 `/api/` 接口的唯一契约来源，适用于 Go 服务端（`internal/app/http_errors.go`、`internal/app/http_upstream_errors.go`）与内嵌 Web 客户端（`web/src/app/api-errors.ts`）。通用规则见 [代码规范.md](../代码规范.md) 第 5 节。

## 通用约定

- `GET /healthz` 无需登录，返回 `{"status": "ok"}`；`GET /api/info` 返回 `{"version", "capabilities"}`，能力为 `demo`、`multiple_instances`、`public_catalog`。
- 每个响应带 `X-Request-ID`（入站值匹配 `^[A-Za-z0-9-]{1,64}$` 时沿用），与服务端日志的 `request_id` 相同；`/api/` 响应带 `Cache-Control: no-store`。
- 请求体必须是 `application/json`（否则 415 `unsupported_media_type`），不超过 1 MiB，未知字段返回 400。
- 创建资源的 `POST`（`/api/sessions`、`/api/demo-sessions`、`/api/instances`、`/api/instances/demo` 与所有 `POST /api/operations/*`）接受 `Idempotency-Key`：同一会话（登录前使用下述创建 Cookie）内 24 小时（进程存活期间）重复提交返回首次的状态码与响应体；同一键但请求不同返回 409 `idempotency_key_reused`。
- `/api/operations/<operation>` 只开放允许列表中的操作与方法，其余返回 404 / 405。分页列表以 `offset` 与 `limit`（1–100，默认 20，`offset` 须为 `limit` 的整数倍）请求，服务端换算为 Harbor 的 `page` / `page_size`；响应为 `{"items", "total", "offset", "limit"}`，不分页的列表一次返回全部，`limit` 为条目数。客户端不发送 `page` / `page_size`。
- 非列表操作直接返回 Harbor 的资源；Harbor 未返回内容时为 204（Harbor 返回 201 时保持 201），`Location` 头原样转发；Harbor 返回的非 JSON 文本作为 JSON 字符串返回。
- 公开目录（`POST /api/public/projects|repositories|artifacts`）的请求体以 `offset`、`limit` 分页，响应与控制列表相同。

## 响应格式

失败响应的正文固定为：

```json
{
  "error": {
    "code": "instance_limit_reached",
    "message": "session instance limit reached",
    "details": { "limit": 5 }
  }
}
```

- `code`：snake_case 错误码，是客户端分支和选择文案的唯一依据。
- `message`：给开发者看的英文说明，客户端不展示。
- `details`：可选，结构按错误码定义，见下表。

服务端不再生成任何中文或面向用户的文案；中英文文案都由 `web/src/app/api-errors.ts` 按 `code`（参数错误再按 `reason`）映射。未知的 `code` 按状态码显示通用文案。`web/tests/locale-contract.test.mjs` 检查服务端使用的每个错误码和原因码在前端都有文案，且服务端源码（演示数据文件除外）不含中文字符串。

## 通用错误码

| 状态码 | `code` | 含义 | `details` |
| --- | --- | --- | --- |
| 400 | `invalid_argument` | 请求体、查询参数或路径参数无效 | `fields`，见下节 |
| 400 | `query_too_long` | 查询串超过上限 | — |
| 400 | `invalid_instance_id` | 实例标识无效 | — |
| 401 | `unauthenticated` | 未连接、会话过期或不存在 | — |
| 403 | `permission_denied` | 跨站写请求（`Sec-Fetch-Site` / `Origin` 不是当前控制台） | — |
| 404 | `not_found` | 控制操作、资源或公开目录资源不在允许列表中 | — |
| 404 | `instance_not_found` | 会话中不存在该 Harbor 连接 | — |
| 404 | `demo_data_missing` | 演示模式下该资源没有数据 | — |
| 404 | `demo_unsupported` | 演示模式不支持该操作 | — |
| 405 | `method_not_allowed` | 操作不支持该方法，带 `Allow` | — |
| 409 | `instance_exists` | 同一地址和账号已经连接 | — |
| 409 | `instance_limit_reached` | 会话实例数达到上限 | `limit` |
| 409 | `last_instance` | 不能移除最后一个实例 | — |
| 409 | `idempotency_key_reused` | 幂等键已用于不同请求 | — |
| 413 | `payload_too_large` | 请求体超过 1 MiB | — |
| 415 | `unsupported_media_type` | 请求体不是 JSON | — |
| 429 | `rate_limited` | 连接、演示或公开目录请求过于频繁 | — |
| 500 | `internal` | 未预期的服务端错误，详情只写日志 | — |

## 参数错误

`invalid_argument` 的 `details` 固定为 `{"fields": [{"path": "rules.0.tag_selectors", "reason": "invalid_count"}]}`：

- `path` 是请求中的点分路径，数组下标从 0 开始；查询和路径参数使用参数名；整个请求体无效时为空字符串。
- `reason` 是 snake_case 原因码，例如 `required`、`too_long`、`invalid_text`、`unknown_field`、`not_boolean`、`not_object`、`not_positive_integer`、`out_of_range`、`invalid_value`、`invalid_count`、`duplicate`、`invalid_url`、`password_policy`、`invalid_cron`、`not_supported`。完整列表以 `web/src/app/api-errors.ts` 的 `reasonMessages` 为准，新增原因码时两端同时修改。
- 客户端先查 `路径:原因` 的专用文案（数组下标按 `*` 匹配），再用原因码的通用文案并填入字段名称。

## Harbor 上游错误

调用 Harbor 失败时，`details` 中的 `harbor_status` 是 Harbor 返回的状态码，响应不包含 Harbor 的内部错误文本。客户端只按错误码展示文案。

| `code` | 状态码 | 含义 |
| --- | --- | --- |
| `harbor_bad_request` | 400 | Harbor 拒绝请求参数 |
| `harbor_unauthorized` | 401 | Harbor 凭据无效 |
| `harbor_forbidden` | 403 | Harbor 账号无权限；连接时为 401 |
| `harbor_not_found` | 404 | Harbor 资源不存在 |
| `harbor_method_not_allowed` | 405 | Harbor 版本或资源状态不允许 |
| `harbor_conflict` | 409 | 资源已存在或状态冲突 |
| `harbor_precondition_failed` | 412 | Harbor 前置条件未满足 |
| `harbor_unprocessable` | 400 | Harbor 无法处理 |
| `harbor_rate_limited` | 429 | Harbor 限流 |
| `harbor_server_error` | 503 | Harbor 返回 5xx |
| `harbor_error` | 503 | Harbor 返回其他错误状态 |
| `harbor_timeout` | 503 | 请求 Harbor 超时 |
| `harbor_canceled` | 503 | 请求 Harbor 被取消 |
| `harbor_invalid_response` | 503 | Harbor 返回的数据格式无效 |
| `harbor_readback_mismatch` | 503 | 写入后回读的数据与请求不一致 |
| `harbor_too_many_redirects`、`harbor_redirect_refused`、`harbor_certificate_invalid`、`harbor_unreachable`、`harbor_read_failed`、`harbor_unknown_error` | 503 | 连接 Harbor 的传输层失败 |
| `harbor_write_unconfirmed` | 503 | Harbor 已接受写入但确认失败；`details.reason` 是确认失败的错误码 |

演示模式模拟 Harbor 的行为：演示数据的错误按同样的 `harbor_*` 码返回，不透传内部错误文本。

## 仪表盘警告

`GET /api/dashboards/current` 的 `warnings` 是对象数组，每项为 `{"source": "projects", "code": "...", "message": "...", "details": {...}}`，`code` 与 `details` 和错误响应相同；资产明细不完整时为 `asset_details_incomplete`。


## 会话、实例与边界

| 方法 | 路径 | 请求 / 响应 |
| --- | --- | --- |
| POST | `/api/sessions` | `url`、`username`、`password`、`skip_tls_verify`；201 会话对象 |
| POST | `/api/demo-sessions` | 严格空对象 `{}`；201 演示会话 |
| GET / DELETE | `/api/sessions/current` | 当前会话 / 退出（204） |
| GET / POST | `/api/instances` | 实例集合 / 添加实例（201） |
| POST | `/api/instances/demo` | `{}`；201 新演示实例 |
| PUT | `/api/instances/current` | `{"id":"连接标识"}`；切换实例 |
| DELETE | `/api/instances/{id}` | 删除连接 |
| GET | `/api/dashboards/current` | 聚合视图与结构化部分失败警告 |
| GET | `/api/search-results` | Harbor 项目与仓库搜索结果 |

旧会话、连接、演示、仪表盘、搜索、about 和 control 路径不再注册，没有兼容别名。自有时间字段使用 UTC 固定毫秒精度，例如 `2026-10-31T00:00:00.000Z`。Harbor 原始资源的字段与枚举由外部契约定义，参见技术决定；分页选择 offset/limit 是因为界面需要跳页和总数。

所有创建型 POST 均接受 `Idempotency-Key`。登录前先 GET `/api/sessions/current`，它在未登录时返回 401，并设置仅 HttpOnly 可见的创建作用域 Cookie；随后携带该 Cookie 和幂等键登录。相同键但方法、路径、请求体、媒体类型或操作实例不同返回 409。缓存最多 4096 条、64 MiB；在执行写入前预留响应容量，容量不足返回 503 `unavailable`，不会提前淘汰未满 24 小时的结果。重放仍受会话有效性约束，退出、过期或服务重启后不能恢复已失效的授权。

请求体上限 1 MiB，响应上限 8 MiB；分页聚合最多 100 页 / 10000 项，项目聚合原始响应总量最多 32 MiB，超限返回 503 `collection_too_large`。演示实例最多接受 256 次、累计 8 MiB 的编辑请求，超限返回 503 `demo_capacity`，重新进入演示可建立新实例。上述错误均有界面文案。429 始终带 `Retry-After`。

服务同时处理最多 64 个请求；超出立即返回 503 `unavailable` 与 `Retry-After: 1`，不排无限队列。每个 Harbor 客户端最多建立 16 个同主机连接，等待也受请求截止时间约束。

`/api/info` 的 `console.build_date` 在具备构建元数据时以 UTC 毫秒时间返回；无元数据时省略该字段，不使用 `unknown` 或 `null` 代替时间。
