# ADR 0001：基于 Harbor 官方 OpenAPI 的类型化控制网关

- 状态：已接受
- 日期：2026-07-28
- 决策者：Harbor 控制台项目
- 官方基线：Harbor v2.15.2

## 背景

本项目需要从只读聚合页面升级为可替代 Harbor Portal 日常工作的中文控制端，同时保留 Go 单二进制部署和 Cloudflare 风格界面。控制端会接触管理员凭据和删除操作，不能向浏览器暴露任意 Harbor 路径代理。

## 决策

后端只提供类型化操作，每个操作固定映射到 Harbor v2.15.2 官方 `swagger.yaml` 中的 HTTP 方法、路径、查询参数和请求体。浏览器不能提交任意上游 URL、方法或路径。

官方来源：

- Release：<https://github.com/goharbor/harbor/releases/tag/v2.15.2>
- OpenAPI：<https://raw.githubusercontent.com/goharbor/harbor/v2.15.2/api/v2.0/swagger.yaml>

首批映射：

| 控制台能力 | 官方 operationId | 方法与路径 |
| --- | --- | --- |
| 项目分页 | `listProjects` | `GET /api/v2.0/projects` |
| 新建项目 | `createProject` | `POST /api/v2.0/projects` |
| 项目详情/编辑/删除 | `getProject` / `updateProject` / `deleteProject` | `GET/PUT/DELETE /api/v2.0/projects/{project_name_or_id}` |
| 项目摘要 | `getProjectSummary` | `GET /api/v2.0/projects/{project_name_or_id}/summary` |
| 项目成员管理 | `listProjectMembers` / `createProjectMember` / `updateProjectMember` / `deleteProjectMember` | `/api/v2.0/projects/{project_name_or_id}/members...` |
| 仓库分页 | `listRepositories` | `GET /api/v2.0/projects/{project_name}/repositories` |
| 仓库详情/编辑/删除 | `getRepository` / `updateRepository` / `deleteRepository` | `GET/PUT/DELETE /api/v2.0/projects/{project_name}/repositories/{repository_name}` |
| 制品分页 | `listArtifacts` | `GET /api/v2.0/projects/{project_name}/repositories/{repository_name}/artifacts` |
| 制品详情/删除 | `getArtifact` / `deleteArtifact` | `GET/DELETE .../artifacts/{reference}` |
| 扫描制品 | `scanArtifact` | `POST .../artifacts/{reference}/scan` |
| Tag 分页/新增 | `listTags` / `createTag` | `GET/POST .../artifacts/{reference}/tags` |
| 删除 Tag | `deleteTag` | `DELETE .../artifacts/{reference}/tags/{tag_name}` |
| 复制策略管理 | `listReplicationPolicies` / `createReplicationPolicy` / `updateReplicationPolicy` / `deleteReplicationPolicy` | `/api/v2.0/replication/policies...` |
| 手动执行复制 | `startReplication` | `POST /api/v2.0/replication/executions` |
| 远端仓库管理 | `listRegistries` / `createRegistry` / `pingRegistry` / `updateRegistry` / `deleteRegistry` | `/api/v2.0/registries...` |

列表响应统一为 `items + pagination`，其中总数只读取 Harbor 官方响应头 `X-Total-Count`；对象响应统一为 `data`。写操作保留 Harbor 状态码语义，并返回 `ok` 和可用的 `Location`。

## 安全与可靠性

- 写操作要求有效内存会话和同源请求。
- 请求体限制为 1 MiB，响应限制为 8 MiB。
- 路径参数逐项 `PathEscape`；查询参数逐项白名单过滤。
- Basic Auth 凭据只存在 Go 进程内存，不返回浏览器。
- 上游重定向只允许同协议、同主机，最多三次。
- 删除操作必须由界面展示资源名并二次确认。
- 连接、读取和写入沿用统一超时；Harbor 错误映射为中文提示并保留可诊断详情。

## 结果

该方案比任意 API 反向代理多一层显式映射，但能限制 SSRF、意外越权路径和版本漂移。升级 Harbor 时必须先对比新版本 OpenAPI，再更新能力矩阵和测试。
