# Harbor v2.15.2 Portal/API 覆盖审计

**审计日期：** 2026-07-31

**审计对象：** 当前仓库工作区

**官方基线：** Harbor v2.15.2

**结论：** 核心管理功能覆盖较完整，但尚未达到官方 Portal 或 Swagger 100% 等价。

## 1. 基线与方法

官方来源：

- Release：<https://github.com/goharbor/harbor/releases/tag/v2.15.2>
- Swagger：<https://raw.githubusercontent.com/goharbor/harbor/v2.15.2/api/v2.0/swagger.yaml>
- Portal 源码：<https://github.com/goharbor/harbor/tree/v2.15.2/src/portal>

本次使用的 Swagger 文件 SHA-256 为：

```text
9be2b505d4c6baba40e6d646eac2b0aa4ff11f938727ae1eaa491ca01ebf71c7
```

审计步骤：

1. 从官方 Swagger 提取全部 path/method，共 135 paths、203 operations。
2. 展开 `control.go` 的 `controlSpecs`，按真实 method/path 去重。
3. 加入 `main.go` 直接处理的 health、search、statistics、systeminfo 和 systeminfo/volumes。
4. 检查每个类型化 operation 是否被前端消费，避免把只有后端映射的接口误报为完整 UI。
5. 对照官方 Portal 路由、组件和 API 调用，抽查登录、项目、成员、规则、设置、Artifact、复制和系统管理页面。

## 2. 覆盖结果

| 指标 | 数量 |
| --- | ---: |
| Harbor v2.15.2 官方 operations | 203 |
| `controlSpecs` 唯一 method/path | 176 |
| `main.go` 直接覆盖 | 5 |
| 当前合计覆盖 | 181 |
| 未覆盖 | 22 |
| operation 覆盖率 | 89.2% |

API operation 覆盖不等于 Portal 功能覆盖。内部接口、聚合接口和 deprecated 兼容接口即使未映射，也不一定造成用户工作流缺失；反过来，接口已映射但 UI 字段不完整，也不能算 Portal 等价。

## 3. 已确认的用户可见缺口

### P0：规则编辑会改变语义或丢字段

不可变 Tag 和 Tag 保留规则编辑器只呈现 pattern，并在保存时固定生成：

```json
{
  "tag_selectors": [{"decoration": "matches"}],
  "scope_selectors": {"repository": [{"decoration": "repoMatches"}]}
}
```

因此编辑 Harbor 已存在的 `excludes`、`repoExcludes` 或 `extras.untagged` 规则时，会静默改成 include 语义并丢掉 `extras`。相关函数：

- `web/control-ui.js`: `showImmutableRuleDialog`
- `web/control-ui.js`: `retentionRuleFromForm`
- `web/control-ui.js`: `retentionRuleFields`
- `control.go`: `validateRetentionRule`

官方五种 retention template 当前都已硬编码，模板数量不是缺口；缺口是未读取 `/retentions/metadatas`、selector decoration 不完整和无损编辑失败。

### P1：登录体系与官方 Portal 不等价

当前连接页只接收 Harbor 地址、用户名和密码，后端使用 Basic Auth 请求 `/api/v2.0/projects` 验证连接：

- `web/index.html`: `#connect-form`
- `web/app.js`: 连接提交逻辑
- `main.go`: `prepareConnection`

与官方 Portal 相比，缺少 `/c/login` 会话、OIDC redirect login、OIDC onboarding 和数据库认证自助注册。OIDC 用户目前只能把 CLI Secret 当 Basic Auth 密码连接。此项属于产品架构差异，不应通过把 Harbor Cookie 或 Token 暴露给浏览器解决。

### P1：项目级审计缺失

`projectTabs` 只有仓库、成员、机器人、Webhook、项目规则、Tag 保留、P2P 预热和设置。项目级扩展审计 `/projects/{project}/auditlog-exts` 与 legacy `/projects/{project}/logs` 均未映射，也没有页面。全局 `/auditlog-exts` 已实现，不能替代项目成员可访问的项目审计入口。

### P1：项目成员搜索不完整且用户组接口权限错误

- 添加普通用户只能输入精确用户名，没有 `/users/search` 的防抖候选和已有成员过滤。
- 非 LDAP 用户组搜索调用 `/usergroups`；该列表通常要求系统管理员权限。普通项目管理员应调用 `/usergroups/search`，否则可能收到 403。
- LDAP 模式的 `/ldap/groups/search` 已实现，不能覆盖非 LDAP 用户组场景。

相关函数：`showAddMemberDialog`、`loadProjectMemberGroups`；相关网关 operation：`user-groups`。

### P1：项目内容信任设置缺失

`validateProjectMetadata` 已允许 `enable_content_trust` 和 `enable_content_trust_cosign`，但 `projectSettings` 没有 Notary/Cosign 开关，保存逻辑也不回传这两个字段。官方 Portal 提供两个独立开关。

### P1：Proxy Cache 更新不完整

创建 Proxy Cache 项目时可设置 registry、`proxy_speed_kb` 和 `max_upstream_conn`；创建后项目设置只读显示带宽与最大连接数，也不能按官方允许条件修改 registry。必须按系统管理员权限和 Harbor 返回的可编辑条件控制，而不是始终只读。

### P2：Artifact 列表与详情信息不完整

- 未调用 `/icons/{digest}`，列表没有 Artifact 类型图标。
- 列表没有 Signed 状态；已有 Cosign/Notation accessory 只能在详情 Accessories 间接发现。
- 列表没有 Annotations 列。
- 详情只展示前三个 annotation，没有展开完整列表的入口。

相关函数：`artifactTable`、`artifactDetailOverview`、artifact accessory 渲染逻辑。

### P1：Helm Chart 拉取命令错误

`artifactPullCommand` 无论类型都生成：

```text
docker|podman|nerdctl pull host/project/repository:tag
```

Helm Chart 应按官方 Portal 生成：

```text
helm pull oci://host/project/repository --version tag
```

Digest、无 Tag、普通 IMAGE 和 CHART 必须分别测试，不能仅靠字符串中出现 `CHART` 判断。

### P3：英文模式有动态中文残留

已确认示例：

- `Users are managed by OIDC 认证`
- 复制策略排序项 `策略编号`、`策略编号（倒序）`、`最早更新`

原因包括动态片段只翻译外层文本，以及复合 option 文本未进入完整翻译字典。相关函数：`authModeLabel`、`adminUsersSection`、`replicationPoliciesSection`。

## 4. 未覆盖的 22 个 API operation

以下路径均省略 `/api/v2.0` 前缀。

| # | Method | Path | 分类 | 补全处理 |
| ---: | --- | --- | --- | --- |
| 1 | GET | `/audit-logs` | deprecated/Portal legacy | 兼容批次映射，不作为当前全局审计主接口 |
| 2 | GET | `/icons/{digest}` | Portal 使用 | 实现并用于 Artifact 列表 |
| 3 | GET | `/internalconfig` | internal/API-only | 只读类型化映射，禁止直接展示敏感值 |
| 4 | GET | `/ping` | API-only | 类型化映射，可用于上游可达性诊断 |
| 5 | HEAD | `/projects` | API-only | 保留 HEAD 语义和响应头 |
| 6 | GET | `/projects/{project_name_or_id}/_deletable` | stable utility | 删除项目前预检 |
| 7 | GET | `/projects/{project_name_or_id}/artifacts` | stable aggregate | 映射并测试分页/过滤；是否增加 UI 由 Portal 对照决定 |
| 8 | GET | `/projects/{project_name_or_id}/members/{mid}` | stable detail | 映射并用于编辑前刷新成员详情 |
| 9 | GET | `/projects/{project_name_or_id}/metadatas/` | stable metadata | 类型化映射 |
| 10 | POST | `/projects/{project_name_or_id}/metadatas/` | stable metadata | 严格请求体验证后映射 |
| 11 | GET | `/projects/{project_name_or_id}/metadatas/{meta_name}` | stable metadata | 类型化映射 |
| 12 | PUT | `/projects/{project_name_or_id}/metadatas/{meta_name}` | stable metadata | 严格请求体验证后映射 |
| 13 | DELETE | `/projects/{project_name_or_id}/metadatas/{meta_name}` | stable metadata | 类型化映射 |
| 14 | GET | `/projects/{project_name_or_id}/webhook/jobs` | deprecated | 兼容映射；UI 继续使用 execution/task/log 新接口 |
| 15 | GET | `/projects/{project_name_or_id}/webhook/lasttrigger` | deprecated | 兼容映射；不作为新 UI 数据源 |
| 16 | GET | `/projects/{project_name}/auditlog-exts` | Portal 使用 | 实现项目扩展审计页 |
| 17 | GET | `/projects/{project_name}/logs` | Portal legacy | 作为实例兼容降级，不与扩展审计混合计数 |
| 18 | GET | `/repositories` | stable aggregate | 类型化映射和分页测试 |
| 19 | GET | `/retentions/metadatas` | Portal 使用 | 驱动 retention 模板和 selector 能力 |
| 20 | GET | `/scans/schedule/metrics` | deprecated | 兼容映射；UI 继续优先 `/scans/all/metrics` |
| 21 | GET | `/usergroups/search` | Portal 使用 | 项目成员用户组搜索改用该接口 |
| 22 | GET | `/users/search` | Portal 使用 | 项目成员普通用户搜索使用该接口 |

## 5. 当前已覆盖较完整的模块

- 项目 CRUD、分页、过滤、排序、批量删除和 CVE 导出
- 仓库 CRUD、批量删除、列表/卡片视图和推送指引
- Artifact 详情、Tag、Label、copy、scan/SBOM、stop、log 和 Accessories
- Replication policy/execution/task/log/stop
- Registry adapters、动态表单、ping 和 CRUD
- 项目/系统 Robot 与细粒度权限
- Webhook CRUD、execution、task 和 log
- Retention execution、task 和 log
- P2P preheat instance/policy/execution/task/log
- Scanner CRUD、ping、default 和 metadata
- Security summary、vulnerability、export、allowlist 和 scan-all
- 用户、用户组、LDAP import、quota、GC、audit purge、Job Service 和 system config
- Public catalog、About、Swagger 链接、多实例和 permissions

## 6. 审计验证与限制

已通过：

```text
GOCACHE=/tmp/harbor-go-cache go test ./... -count=1
GOCACHE=/tmp/harbor-go-race-cache go test -race ./... -count=1
GOCACHE=/tmp/harbor-go-cache go vet ./...
node --check web/app.js
node --check web/control-ui.js
node --check web/admin-ui.js
node --check web/i18n.js
node --test frontend-tests/*.test.cjs
git diff --check
```

前端测试为 17/17 通过。浏览器已用内置 demo 抽查关键页面，但本次未连接真实 Harbor v2.15.2 环境，因此权限矩阵、OIDC 跳转、Notary/Cosign 和 Proxy Cache 更新仍必须在集成验收中确认。
