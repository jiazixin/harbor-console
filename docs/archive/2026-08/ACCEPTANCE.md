# Harbor Console 验收文档

> 文档状态：发布验收标准
> 最后整理：2026-08-05
> Harbor 基线：v2.15.2

## 1. 验收原则

自动测试、demo、截图和成功 toast 都不能单独证明发布可接受。验收必须分别报告仓库质量、API 合同、真实 Harbor、浏览器 UI、安全回归和缺陷回归，不能只给一个模糊的“通过”。

没有可访问的真实 Harbor v2.15.2 时，总结论最高只能是 `PROVISIONAL`。

## 2. 发布 Gate

| Gate                  | 结果                          | 通过条件                                                                                                                   |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Repository quality    | PASS/FAIL                     | 格式、空白、依赖、pin、vet、race、前端检查、前端测试和构建全部通过                                                         |
| React architecture    | PASS/FAIL                     | 无 classic 全局控制器、字符串 DOM renderer 或兼容运行时；页面、状态和 overlay 由 typed React feature 与共享 primitive 管理 |
| Stable API contract   | PASS/FAIL                     | 198 个非废弃 v2.15.2 operation method/path 双向一致                                                                        |
| Local runtime         | PASS/FAIL                     | health、UI、CSP、session、logout、日志和优雅退出通过                                                                       |
| Real Harbor workflows | PASS/FAIL/BLOCKED             | 真实读取、写入、回读和清理完成                                                                                             |
| Browser UI            | PASS/FAIL/BLOCKED             | Codex 对规定视口、中文和英文分别执行完整交互与视觉验收，无溢出、塌陷、重叠和关键交互失败                                   |
| Security regression   | PASS/FAIL                     | 凭据、Origin、重定向、输入、响应和日志边界正确                                                                             |
| Findings regression   | PASS/FAIL/BLOCKED             | REG-001 至 REG-018 和 UI-001 至 UI-034 独立记录                                                                            |
| Container runtime     | PASS/FAIL/NOT RUN             | 非 root、health、嵌入 UI 和 SIGTERM 通过                                                                                   |
| Native OIDC login     | NOT IMPLEMENTED               | 不得报告为 PASS                                                                                                            |
| Overall release       | ACCEPTED/REJECTED/PROVISIONAL | 无开放 P0/P1，全部范围内 Gate 通过                                                                                         |

## 3. 最近一次已知证据

### 3.1 2026-08-04 React 全量迁移与视觉验收

在当前工作区已完成以下证据：

- 完整 完整质量检查：PASS，包含格式、空白、deployment pin、`go mod tidy -diff`、Go vet/race、前端检查/测试/构建和生产二进制构建。
- 信息性 覆盖率检查：PASS，总语句覆盖率 61.5%；`internal/app` 61.1%、`internal/config` 78.9%、`internal/observability` 72.0%。覆盖率不是发布 Gate 的替代品。
- 前端合同测试：20 passed；React component test：44 个文件、153 passed；0 failed；TypeScript `noUnusedLocals` / `noUnusedParameters` 已进入正式配置。
- React architecture Gate：PASS。生产入口直接挂载 typed React；`frontend/public/runtime/`、classic renderer、HTML parser 与 preview 入口均不存在；`internal/webui/` 只允许 `embed.go` 和 Vite 生成的 `assets/`，旧式未执行 `.cjs` 测试已清理，并由架构合同防止回归。
- Stable API contract Gate：PASS。198 个 Harbor v2.15.2 非废弃 operation 的 method/path 双向合同与排序 fixture 独立复验通过。
- Local runtime Gate：PASS。使用本轮构建出的 `bin/harbor-console` 在独立 loopback 端口复验：health GET 200、POST 405、JSON/no-store、严格 CSP、纯内嵌 hashed 资源、demo `HttpOnly` + `SameSite=Strict` Cookie、logout 后 session 401、访问日志只记录 path 且不包含 Cookie，以及 SIGTERM 后 `server_stopped` 和退出码 0 均通过。
- Vite 生产构建按领域拆包，最大 JavaScript chunk 为 181.71 kB raw / 57.17 kB gzip，不再出现 500 kB bundle warning。
- 迁移前 `e75001f` 基线与当前 React 生产入口均通过认证后浏览器矩阵：24 条路由、简体中文和英文、1440x900、1280x800、390x844、360x800，共 384 项检查，0 failure、0 unexpected console issue；仅记录 8 次预期的初始 `/api/session` 401 探测。
- 当前 React 生产入口另通过正式 Playwright 跨浏览器 Gate：47 条页面/页签状态 × Chromium、Firefox、WebKit × 简体中文/英文 × 4 个规定视口，共 1,128 次认证后路由检查，24/24 场景通过；逐路由检查加载完成、无 error state、document/main 无横向溢出、无认证后 console warning/error，并验证全局搜索与焦点恢复。
- 项目详情 repositories、members、robots、webhooks、rules、retention、audit、preheat、settings 九个 tab 的表格/内容结构投影与迁移前基线一致；成员、机器人、Webhook、标签和预热策略等代表性创建 Dialog 的可见字段几何一致。
- 项目设置恢复迁移前的 `普通项目 / Standard` 身份展示；单项目删除先执行 `project-deletable`，有仓库时显示 Harbor 拒绝信息，不打开确认框，可删除时要求输入精确项目名；批量删除流程保持独立。
- 扩展矩阵首次发现英文 1280x800 制品详情操作区溢出 78px，以及 WebKit 鼠标打开搜索后 opener 焦点不可靠；操作区改为有界换行，搜索按钮显式保存焦点后，三个引擎全矩阵复验通过。
- 搜索 260ms debounce、Harbor 官方字段结果、`Escape` 关闭、opener 焦点恢复和中英文切换均通过。
- 所有普通单选控件已统一为 `UnifiedSelect`，typed React 源码不存在原生 `<select>`，并由架构合同固定。安全筛选提交、项目代理配置、用户组来源切换及 390px 移动端局部表格滚动均完成生产浏览器复验，无新增溢出或控制台错误。
- 未登录公开目录已经由 typed React 接管，匿名项目、仓库和制品的搜索、分页、面包屑、浏览器历史恢复、刷新恢复、拉取命令复制、中英文切换和返回登录均有真实 Harbor 证据；匿名流程不创建 Cookie 或登录会话。

这证明当前本地工作区的 React 架构和浏览器 UI Gate 已通过；真实 Harbor 与 container runtime 证据见下一节。

### 3.2 2026-08-04 真实 Harbor 与容器环境复查

- 目标 `hb2.jzxk.cc` 可通过内网地址 `192.168.30.10` 访问；本机代理 DNS 返回错误地址时，可使用内网 DNS `192.168.5.51` 或直接使用该地址。实际连接的 Harbor 版本为 `v2.15.2-a97e7b83`。
- 匿名公开目录读取通过：读取 4 个公开项目，搜索 `test`，进入 `test/almalinux` 并读取 2 个制品，验证拉取命令复制、刷新恢复、浏览器前进/后退、简体中文与英文切换；流程前后 Cookie 数均为 0。
- 授权写入边界通过：创建并回读 255 字符项目、255 字符用户及项目成员、128 字符全局/项目 Label、255 字符 Webhook、1024 字符不可变与 Retention selector、180 字符系统 Robot、128 字符 Artifact Tag，并完成 Artifact Label 绑定/解绑。
- Label 名称真实上限为 128 字符：128 字符创建成功，129 字符由 Harbor 拒绝；Label 描述 1024 字符创建成功。前后端校验均按该权威边界实施。
- Retention `rules[].params.*.extras` 必须是包含 JSON 的字符串，而不是对象；真实 Harbor 创建和回读已验证该序列化合同。
- 系统 Robot 的 `disable` 在 POST 创建时不会生效。生产流程先 POST，再用创建响应中的官方 Robot 名称和当前 `level` 执行 PUT；浏览器创建停用 Robot 后列表显示“已停用”，随后通过 UI 删除，控制台无相关错误。
- 项目配额和系统配置均完成读取、修改、权威回读和原值恢复；用户组、Registry、P2P provider/policy 均完成 create、read back、update 和 delete 生命周期。
- Replication policy 完成创建、更新、手动执行、执行结果回读和删除，真实执行状态为 `Succeed`。Harbor 省略 `enabled` 时语义为停用；新建策略仍默认启用；`speed: 0` 在 UI 中规范化为不限速 `-1`。
- Scanner 完成创建、更新、回读和删除。首个 Scanner 必须启用且自动成为默认 Scanner；默认 Scanner 编辑时不能停用。真实字段上限为名称 128、URL 512、访问凭据 512、描述 1024 个字符，前端和 Go 网关使用同一边界。
- Replication 描述和过滤值按 Unicode 字符而不是 UTF-8 字节计数；1024 个中文字符通过，1025 个字符在提交前被拒绝。
- 超长值视觉验收覆盖 390x844、412x915 和 1280x720：document 宽度始终等于视口；移动 Dialog 为 374/396px，内部 scroll width 为 372/394px；桌面 Dialog 为 620px，内部为 618px。超宽规则表只在自身容器滚动，长 Label、用户、成员、Robot、Webhook、selector、Tag 和 Artifact Label 使用共享省略与完整 `title`。
- 制品摘要中的 Label chip 统一限制为 260px；390px 与 1280px 真实截图确认其保持在卡片内并显示省略号，不改变原颜色、字号、间距或操作结构。
- 超长项目名会使 Harbor 组合后的项目 Robot 名称超过 255 字符并返回上游 500。当前 UI 按项目名计算剩余名称长度；无可用长度时禁用名称输入和提交，并显示明确原因。
- 清理后 `acceptance-*`、`acceptance-final-*` 和 `codex-ui-*` 项目、用户、Robot、Label、Registry、Replication、Scanner 与 P2P 资源数量均为 0；被测制品 Tag 精确恢复为 `["9"]`，Label 恢复为 `[]`，没有遗留验收资源。最终清理由 React UI 完成，并通过固定解析到 `192.168.30.10` 的 Harbor API 独立复核。
- 完整质量检查、依赖安全扫描、浏览器测试 和 `git diff --check` 均通过；最新结果为 20 条合同测试、44 个文件中的 153 条组件测试，以及 Chromium/Firefox/WebKit 的 24/24 双语四视口场景。npm audit 和 `govulncheck` 均未发现漏洞。
- 真实 Harbor Gate：PASS。第 9 节要求的核心读取、CRUD、执行、权威回读、恢复和清理矩阵已经覆盖项目、用户/成员/组、Label、Webhook、规则、Robot、Artifact、配额、系统配置、Registry、Replication、Scanner 和 P2P。
- Container Gate：PASS。使用 Docker client 29.7.1、Docker server 29.5.2 和 Colima 0.10.3 执行 容器构建，两个基础镜像均按 Dockerfile 中的不可变 digest 拉取并成功构建 `harbor-console:dev`。
- 容器以 `nonroot:nonroot` 配置运行，PID 1 的实际 UID 为 65532；`/etc/harbor-console/config.yaml` 存在并被 `CONFIG_FILE` 使用。容器仅映射到主机 loopback `127.0.0.1:18487`。
- 容器 health 返回 200、JSON、`Cache-Control: no-store` 和严格安全头；生产 HTML、favicon、全部 hashed JavaScript/CSS bundle 均返回 200。发送 SIGTERM 后日志包含 `server_stopped`，容器退出码为 0。

因此，2026-08-04 React 技术迁移提交的综合结论为 `ACCEPTED`。Repository quality、React architecture、Stable API contract、Local runtime、Real Harbor、Browser UI、Security regression、Findings regression 和 Container runtime Gate 均已通过；Native OIDC login 明确不在当前实现范围内。

### 3.3 2026-08-04 新增 UI 一致性收口范围

用户在 React 迁移提交后确认技术重写结果可用，同时指出以下迁移前需求或界面信息没有完整恢复：统一表头排序、分页条数位置、项目筛选控件几何、项目中心文案、四个项目概览指标，以及项目/镜像仓库列表中的无语义图标。

这些事项登记为 UI-013 至 UI-018，状态为 `OPEN`。上一节的 `ACCEPTED` 只记录已完成 React 技术迁移提交的历史验收结果，不代表当前产品 UI 已经最终收口。完成这批事项后必须重新运行 Browser UI、Findings regression 和相关 repository quality Gate，才能给出新的整体发布结论。

### 3.4 2026-08-04 第二批 UI 一致性问题

用户提供的安全中心截图显示“没有高风险 CVE”和“没有危险制品”仍按普通内容贴左排列，没有在各自 panel 内容区居中；P2P 截图显示 Provider 卡片暴露 Dragonfly/Kraken 版本号，并且“暂无 P2P 实例”同样贴左且把图标、标题和说明挤在一行。

同时确认当前动画只覆盖部分一级页面，复制管理的复制策略/执行记录切换等页内内容没有统一进入动画；跨项目镜像仓库的列表展示与列表/卡片切换需要恢复；筛选后的取消操作缺失；多处列表 section 没有像复制策略一样显示权威总数摘要。

这些事项登记为 UI-019 至 UI-025，状态为 `OPEN`。必须执行全路由、全 tab、全筛选列表和全数量摘要盘点，不能只修截图或示例页面。

### 3.5 2026-08-04 列表交互局部复验

- Repository quality 局部 Gate：PASS。`npm run check`、20 条前端合同测试、44 个文件中的 155 条组件测试和生产构建均通过。
- 项目中心：自动扫描/漏洞阻止概览图标正确；可见性、自动扫描和漏洞阻止表头存在并驱动完整可见项目集排序，而非只改变图标。
- 镜像仓库：搜索后“筛选”按钮可见，活动筛选后“取消筛选”可见；列表/卡片切换保留筛选结果；制品数、拉取次数和两个时间列使用居中稳定列宽。
- 复制管理：状态下拉显示“进行中、成功、失败、已停止”；策略与执行记录的数据表头均可排序，任务统计降序后 URL 与行顺序同步变化。
- 远端仓库：默认列表视图、卡片切换、名称降序和偏好持久化通过；列表与卡片顺序一致。
- Browser UI 局部 Gate：PASS。Codex 内置浏览器完成中文桌面和 390x844 移动检查，无空白页、框架错误层、相关 console warning/error、页面级重叠或不可达控件。

本节只关闭上述明确复验范围，不代表 UI-013 至 UI-025 全部完成；真实 Harbor、Chromium/Firefox/WebKit 全矩阵和容器 Gate 本轮未重新执行。

### 3.6 2026-08-05 UI-031 排序列视觉轴复验

- Repository quality 局部 Gate：PASS。最终 `npm run check`、27 条前端合同测试、46 个组件测试文件中的 171 条测试、`go test ./...`、Vite 生产构建和 `git diff --check` 均通过。
- Browser UI Gate：PASS。最终 `npm run test:browser` 的 24/24 Chromium、Firefox、WebKit 场景全部通过，覆盖简体中文/英文以及 1440x900、1280x800、390x844、360x800。
- 真实页面像素证据：PASS。复制策略和执行表在 1280x800、390x844 新鲜 demo 会话中逐列读取 `getBoundingClientRect()`；列名相对表头、首行内容相对单元格、列名相对首行内容的最大绝对偏差为 `0.004px`。排序按钮与首行内容相对 padding 后可用宽度的最大正溢出为 `0.461px`，满足 `<=1px` 合同。
- 移动布局证据：PASS。390x844 下 document/main 横向溢出均为 `0`；复制策略表 `920px`、复制执行表 `950px` 宽度由各自 `.table-scroll` 承担，未把页面撑宽。策略和执行桌面/移动截图均已在本轮新鲜 demo 会话采集。
- 控制台与页面身份：PASS。目标页面均为 `Replication · Harbor Console`，策略/执行 URL 正确，DOM 快照包含完整表格，无框架错误层；四个截图状态 console 均无 warning/error。

UI-031 本轮状态更新为 `CLOSED`。本节只关闭排序列视觉轴和相关稳定列宽范围，不改变真实 Harbor、Container 或其他历史范围的独立 Gate 结论。

### 3.7 2026-08-05 UI-033 复制执行详情长值与列稳定性复验

- 修复复制执行详情任务表的源/目标长资源值：源和目标各自使用稳定列宽，文本最多显示两行并保留 `title` 完整值入口。
- 操作列固定为单行居中，状态列以实际 `status-badge` 盒模型居中，开始/结束时间列保持单行并复用 `table-cell-time`。
- Codex 内置浏览器在 `http://127.0.0.1:9999/#/replication?tab=executions` 的演示会话中复验：1280x720 下任务表宽度 `1040px`，各列起点独立且 document 横向溢出为 `0`；390x844 下 Dialog 宽度 `374px`，任务表由 `.table-scroll` 承担 `1040px` 局部滚动，document/main 横向溢出均为 `0`。
- 复制任务组件测试 7/7 通过，生产 Vite 资源和 `bin/harbor-console` 构建成功。

UI-033 本轮状态更新为 `CLOSED`。本节只关闭复制执行详情的长值、操作、状态和时间列布局范围，不改变真实 Harbor、Container 或其他历史范围的独立 Gate 结论。

## 4. 验收安全规则

- 使用专用、可丢弃的 Harbor v2.15.2 实例。
- 所有资源使用本次报告声明的专用前缀，例如 `acceptance-*` 或 `codex-ui-*`。
- 不对生产项目执行删除、Retention、Webhook、复制、GC 或系统设置写入。
- 密码、CLI Secret、Cookie、Token、Authorization 和 OIDC secret 不得出现在文件、命令参数、URL、日志、截图或报告。
- 验收前后分别保存 `git status --short`；验收过程不应修改 tracked files。
- 发现缺陷先记录复现和证据，不在同一验收过程静默修复后继续签字。
- 破坏性操作需要目标环境所有者明确授权。

## 5. 环境记录

报告中记录以下非敏感信息：

```text
Repository commit:
Branch:
Working tree status:
Go version:
Node.js version:
Browser and version:
Operating system:
Harbor version:
Harbor host:
Authentication mode:
System administrator account name:
Project administrator account name:
Restricted account name:
Acceptance resource prefix:
Container engine and version:
```

## 6. Repository Quality Gate

不得先运行会写文件的格式化命令。按顺序执行：

```bash
# Go 格式检查
# 空白检查
# 部署版本检查
# 模块检查
# Go 静态检查
# Go 竞态测试
# 前端静态检查
# 前端测试
# 生产构建
git diff --check
```

再执行信息性覆盖率：

```bash
# 覆盖率检查
```

通过条件：所有命令退出码为 0，无 race、无意外 generated file、无未解释的格式修改。

## 7. Stable API Contract Gate

执行：

```bash
go test ./internal/app -run 'TestHarborV2152StableOperation' -count=1 -v
```

独立确认：

- fixture 正好包含 198 条非空、唯一、已排序 operation。
- fixture 来源是 Harbor v2.15.2 官方 Swagger，不是从实现反向生成。
- method/path 双向差集为空。
- HEAD 与 GET 分开计数。
- path placeholder 只归一化名称，不合并不同资源层级。
- 不存在 `legacy-*` 或 deprecated operation 冒充稳定 operation。
- 每个写 operation 保留 body、field、type、range 和同源校验。
- repository、digest、reference 和 metadata 路径保留正确编码语义。

任一 method/path 不一致都判定 FAIL。禁止更新 fixture 来消除实现错误。

## 8. Local Runtime Gate

在未占用的 loopback 端口启动本次构建出的精确二进制：

```bash
PORT=<unused-port> LOG_FORMAT=json ./bin/harbor-console
```

验证：

- `GET /health` 返回 200、JSON、`Cache-Control:no-store`、服务名和非负 uptime。
- `POST /health` 返回 405。
- `/` 和全部静态资源来自嵌入式文件，不访问 CDN、远程字体或远程脚本。
- CSP 不放宽为不必要的 `unsafe-inline` script。
- demo 登录产生 `HttpOnly`、`SameSite=Strict` Cookie。
- logout 后保护接口返回 401。
- 访问日志不包含 query string、密码、Token 或 Cookie。
- SIGTERM 在配置期限内优雅退出。

只停止本次验收启动的 PID。

## 9. Real Harbor Gate

### 9.1 连接与会话

1. 使用密码或 CLI Secret 连接 Harbor 根地址。
2. 错误密码必须在创建 console session 或保存 connection 前被拒绝。
3. 含路径前缀、query、fragment 或 userinfo 的 URL 必须在上游请求前被拒绝。
4. 刷新浏览器后会话仍有效。
5. 添加第二个 Harbor 或 demo，双向切换，确认身份、权限、缓存和数据不泄漏。
6. 删除次要连接，当前连接仍可用。
7. logout 后保护接口返回 401。

检查 Storage 和 Network URL，不得出现 Harbor credential、Cookie、CLI Secret 或 Token。

### 9.2 读取工作流

真实验证以下模块的列表、分页、排序、过滤、空状态、403、404、5xx 和详情：

- Overview、项目、项目摘要、成员、机器人、仓库、项目审计。
- Artifact、Tag、Label、annotation、签名、漏洞、SBOM、build history 和 pull command。
- 复制策略、执行、任务、日志和远端仓库。
- Webhook、Retention、P2P 预热及各自执行、任务、日志。
- 安全概览、扫描器、CVE allowlist、用户、用户组、配额、审计、GC、扫描计划、Job Service、系统配置、About 和 Swagger。

每个列表至少检查第一页、有数据时的后一页、升降序、匹配过滤和无结果过滤。

### 9.3 写入工作流

使用 `acceptance-*` 资源完成 create、read back、update、execute（适用时）和 delete：

- 项目和项目 metadata。
- 用户成员、组成员和至少两个角色。
- Artifact Tag 和 Label。
- 项目 Robot 和系统 Robot，生成 secret 只保存在内存。
- Webhook policy。
- Immutable rule 和 Retention policy。
- Registry 和 Replication policy。
- Scanner、P2P provider/policy、用户、组、配额和可安全恢复的系统设置。

保存后必须重新读取 Harbor 权威资源，不以 toast 或 console 本地状态为准。结束时删除全部验收资源并确认列表中不存在。

## 10. Browser UI Gate

使用真实渲染页面，不使用 DOM source assertion 代替。

### 10.1 必测视口

- Desktop：1440 x 900。
- Compact desktop：1280 x 800。
- Mobile：390 x 844。
- Small mobile：360 x 800。

涉及响应式重构时增加 768 x 1024。所有关键页面验证简体中文和英文，并至少抽查 125% 页面缩放。

中文和英文必须由 Codex 分别完整执行同一套页面、交互、键盘和截图检查；不得以翻译键存在或仅切换首页替代全量验收。

### 10.2 必测页面

- 登录页。
- Overview。
- 项目列表和项目详情。
- 密集仓库或 Artifact 表格。
- Artifact 详情。
- Replication policies 和 executions。
- Administration configuration。
- 一个写操作 dialog。
- 一个权限/错误状态。
- 移动端导航和 operation center。

### 10.3 通用通过条件

- 无页面级横向 overflow。
- 无重叠文字、截断主操作、不可读列或超出容器的 label。
- 侧栏、主内容、table、dialog、log 各自滚动边界正确。
- 加载、空、403、404、验证错误、上游失败和成功状态清晰不同。
- 语言和主题切换不把控件移出容器。
- 键盘焦点可见，overlay 关闭后焦点恢复。
- Console 无相关 error/warning。
- 网络失败后可重试，不要求整页 reload。

## 11. UI 专项回归

| ID     | 问题               | 验收步骤                                                              | 通过条件                                                                                                                   |
| ------ | ------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| UI-001 | Flex/grid 塌陷     | 在 1280、390、360 宽度填入长项目名、URL、digest                       | 内容列可收缩，页面不被撑宽，主操作可达                                                                                     |
| UI-002 | 内部滚动高度塌陷   | 滚动侧栏、dialog、日志和长表格                                        | 滚动发生在正确容器，头部和关闭操作保留                                                                                     |
| UI-003 | 字体不一致         | 比较正文、按钮、输入、select、表头、分页和 badge                      | 全部继承统一字体；mono 只用于明确数据                                                                                      |
| UI-004 | 原生 select 差异   | 在支持的两个浏览器打开筛选和 dialog select                            | 统一 trigger、菜单、字体、高度、焦点和 change 行为一致                                                                     |
| UI-005 | 中英文重叠         | 中文/英文切换登录页、工具栏、风险面板和长按钮                         | 无覆盖、跳动、剪裁，较长文本可读                                                                                           |
| UI-006 | 表格列被压碎       | 360/390 宽度查看项目、仓库、复制执行和审计表并逐列点击排序            | 表格自身滚动，ID/时间/状态/动作列保持可读；表头点击区域不重叠且命中正确字段                                                |
| UI-007 | 数字和时间错位     | 使用 0、99999、100000 和完整年份时间                                  | 数字使用 tabular alignment，时间单行且列轴一致                                                                             |
| UI-008 | 长文本与图标碰撞   | 使用长 provider、annotation、用户、策略和资源名                       | 图标不缩小，文本换行或省略，并可查看完整值                                                                                 |
| UI-009 | 工具栏溢出         | 缩窄各筛选页面容器并切换英文                                          | 控件按逻辑组换行，提交/重置顺序正确                                                                                        |
| UI-010 | Overlay 焦点丢失   | 键盘打开并关闭搜索、菜单、operation center 和 dialog                  | 焦点返回 opener，focus ring 可见                                                                                           |
| UI-011 | 整页重绘抖动       | 连续切换 tab、过滤、分页和排序，并在慢响应下观察 DOM                  | page chrome、滚动和焦点稳定；排序/过滤/分页不重挂载内容 owner                                                              |
| UI-012 | 动画残留           | 快速切换路由并启用 reduced motion                                     | 无残留 pending/aria-busy，reduced motion 下无非必要动画                                                                    |
| UI-013 | 排序入口不统一     | 盘点所有可排序列表并分别切换升序、降序                                | 无独立排序控件；两种方向均被路由接受且实际行顺序正确                                                                       |
| UI-014 | 分页条数位置错误   | 检查所有含分页列表的桌面、移动和双语 footer                           | 每页条数紧跟左下角范围/总数，翻页控件位于右侧且样式统一                                                                    |
| UI-015 | 项目筛选控件错位   | 比较项目所有者与可见性控件的 computed box metrics                     | 所有者宽度受限；两控件等高并沿同一垂直中轴，无像素补丁                                                                     |
| UI-016 | 项目页文案遗留     | 检查导航、标题、面包屑、空状态和中英文词典                            | 中文统一为“项目中心”“镜像仓库”，无旧文案残留                                                                               |
| UI-017 | 项目概览缺失       | 在有数据、零项目、权限受限和部分失败状态打开项目中心                  | 四个指标存在，统计口径正确，加载/错误/零值不会造成变形                                                                     |
| UI-018 | 无语义图标残留     | 检查项目和镜像仓库名称列的桌面、移动和键盘点击区域                    | 灰色/黄色装饰图标删除，文本与交互区域稳定                                                                                  |
| UI-019 | 一级页面动画缺失   | 依次进入全部侧栏页面并比较概览/项目中心的进入行为                     | 所有一级页面只由 shell 执行一次相同线性 route motion，无静态遗漏或领域双重动画                                             |
| UI-020 | 页内切换动画缺失   | 切换复制策略/执行记录、各领域 tab、筛选和局部视图                     | 内容 owner 统一淡入，page chrome 稳定且无重复动画                                                                          |
| UI-021 | 空状态布局割裂     | 检查安全中心、P2P 及所有无数据/无结果 panel                           | 图标、标题、说明在所属内容区居中，错误状态仍明确区分                                                                       |
| UI-022 | 仓库视图能力丢失   | 在跨项目镜像仓库页切换列表/卡片并刷新、前进和后退                     | 两种视图完整，右侧复用共享切换按钮并带统一内容动画                                                                         |
| UI-023 | 取消筛选缺失       | 在所有筛选页分别激活搜索、单选和复合条件后执行取消                    | 活动筛选时按钮可见；清理正确且保留视图/分页规模/排序                                                                       |
| UI-024 | P2P 展示过度固定   | 检查 Provider 卡片和无实例状态的中英文桌面/移动布局                   | Dragonfly/Kraken 不显示版本号；空状态使用共享居中布局                                                                      |
| UI-025 | 列表数量摘要缺失   | 盘点所有具有权威 total 的列表 section                                 | 可合理展示处均使用统一 heading/count 样式和真实总数                                                                        |
| UI-026 | 派生字段伪排序     | 用跨页差异数据排序项目仓库数和仓库制品数                              | 完整数据集先排序后分页；请求不透传 Harbor 不可排序字段                                                                     |
| UI-027 | 仓库时间语义错误   | 拉取镜像后刷新跨项目、项目内和公开仓库列表                            | `update_time` 统一显示“最近更新”，不再宣称“最近推送”                                                                       |
| UI-028 | 实例入口与品牌重复 | 检查登录页、公开目录、侧栏和顶栏                                      | 品牌统一使用 favicon；侧栏无重复实例卡片，实例切换只保留顶栏入口                                                           |
| UI-029 | 异步路由加载闪烁   | 在 24 个以上项目且慢响应下进入跨项目镜像仓库                          | header、统计区和内容容器首帧稳定；请求完成后无整段插入、空白闪烁或布局跳变                                                 |
| UI-030 | 下拉菜单被裁切     | 在页面/表格底部、Dialog 滚动区和 360/390 视口打开全部 `UnifiedSelect` | 菜单 portal 脱离 overflow owner；空间不足时自动向上展开，四边保持安全间距且滚动/缩放后仍对齐触发器                         |
| UI-031 | 排序列视觉轴偏移   | 在项目、仓库、复制策略和执行表中测量居中排序列的表头与首行内容        | 列名文字、表头单元格、首行内容和表体单元格同轴，三组中心绝对偏差均不超过 1px；中英文表头/内容均不超出扣除 padding 后的列宽 |
| UI-032 | 表头/表体语义对齐断裂 | 在项目中心及其他数据表逐列比较 `<th>` 与首行 `<td>` 的语义对齐类，并测量可见性/状态 badge | 语义类必须成对一致；列名、表头单元格、首行 badge 和表体单元格中心绝对偏差均不超过 1px；禁止页面专属 offset 修复 |
| UI-033 | 复制执行详情列塌陷 | 在执行详情中使用长源/目标值并检查操作、状态、开始/结束时间列 | 源/目标最多两行省略且保留完整值；操作单行；状态 badge 居中；结束时间单行；移动端仅 `.table-scroll` 横向滚动且 document/main 不溢出 |
| UI-034 | 页码跳转缺失 | 点击标准列表或 Dialog 分页的当前页/总页数文本，输入 `0`、有效页码和超大页码后回车 | 关闭态保持原有文本；点击后原页码隐藏且仅显示短灰色底线，输入数字为橙色并且没有选中文字背景、边框或阴影；有效页码正确跳转，小于 1 归到第 1 页，大于最大页归到最大页；Escape 或点击外部取消且所有分页页面行为一致 |

UI-001 至 UI-034 任一失败都必须记录截图、视口、语言、浏览器、复现数据和相关 selector。不能通过隐藏内容、缩小字体、页面专属 offset、`nth-child` 对齐补丁、全局无差别 animation 或恢复旧运行时代码直接关闭问题。

## 12. 历史缺陷回归

| ID      | 严重度 | 回归项                 | 通过条件                                                                              |
| ------- | ------ | ---------------------- | ------------------------------------------------------------------------------------- |
| REG-001 | P1     | 无效凭据               | 错误密码在创建 session/connection 前被拒绝，即使全部项目公开                          |
| REG-002 | P1     | 项目配额               | 读取官方 quota endpoint，保存后回读精确值并恢复原值                                   |
| REG-003 | P1     | 项目 Robot             | 新建 Robot 出现在所属项目列表，可编辑、重置、删除并在删除后消失                       |
| REG-004 | P1     | Artifact 统计          | Overview、项目摘要和可见资源总数一致并随变更刷新                                      |
| REG-005 | P1     | 清空系统 CVE allowlist | 保留完整 allowlist identity，清空后回读为 0                                           |
| REG-006 | P1     | self-registration      | `editable:false` 时只读，保存认证设置不发送该字段                                     |
| REG-007 | P1     | 部署信任边界           | 容器示例默认绑定 loopback，文档说明 public catalog egress 和 Skip TLS 风险            |
| REG-008 | P2     | 英文运行时完整性       | 动态 label、状态、错误、空状态和 toast 无界面中文残留                                 |
| REG-009 | P2     | 空时间                 | 缺失、非法和 Go 零时间显示本地化空值，不显示公元 1 年                                 |
| REG-010 | P2     | 手动 Retention         | 空 Cron 保存为 Harbor manual Schedule，不变成每日计划                                 |
| REG-011 | P2     | 焦点恢复               | 搜索、dialog、面板和移动导航关闭后恢复 opener                                         |
| REG-012 | P2     | 移动 operation center  | 390x844 和 360x800 下运行、失败、完成操作均可达                                       |
| REG-013 | P2     | 日志前缀               | WARNING/WARN 归一化后不残留 `ING]` 等片段                                             |
| REG-014 | P2     | Harbor 根 URL          | 含非根路径的 URL 在任何上游请求前被拒绝                                               |
| REG-015 | P2     | Harbor 输入限制        | comment 等字段在提交前执行 v2.15.2 长度限制并保留上游错误                             |
| REG-016 | P2     | 受限用户统计           | 统计只来自当前账号可见资源，各页面相互一致                                            |
| REG-017 | P2     | 前端回归覆盖           | i18n、Artifact、成员搜索、审计、复制、Retention、焦点、移动端和运行安全测试存在且通过 |
| REG-018 | P2     | 不可变 CI 输入         | Actions 固定完整 SHA，基础镜像固定 digest，存在自动更新机制                           |

任何 P1 失败都拒绝发布。P2 必须修复或由发布负责人显式接受例外。

## 13. 安全与可靠性回归

验证：

- 未知 query 和 JSON 字段被拒绝。
- 超大请求与响应限制生效。
- 外域 Origin 的写请求被拒绝。
- 跨主机或跨协议上游重定向被拒绝。
- Skip TLS 是按连接 opt-in，不影响其他实例。
- 不支持的 icon MIME、非法 base64 和 SVG/HTML payload 不进入 DOM。
- 路径参数正确编码，不出现项目或仓库路径重复。
- 403、404、409、412、422、429 和 5xx 不被统一误报为“暂无数据”。
- 任何浏览器存储、URL、访问日志、应用日志和截图中都没有敏感值。

## 14. Container Gate

```bash
# 容器构建
docker run --rm -p 127.0.0.1:<unused-port>:8080 harbor-console:dev
```

确认：

- 镜像构建引用不可变 digest。
- 进程以非 root 用户运行。
- 读取 `/etc/harbor-console/config.yaml`。
- health 和嵌入式 UI 可访问。
- 默认示例只绑定主机 loopback。
- SIGTERM 优雅退出。

最近一次执行结果：PASS。`harbor-console:dev` 使用不可变基础镜像 digest 构建成功，容器用户为 `nonroot:nonroot`、实际 UID 65532；health、嵌入式 HTML 与所有 hashed bundle 均返回 200；SIGTERM 后记录 `server_stopped` 并以 0 退出。

## 15. 严重度与发布结论

| 严重度 | 示例                                                       | 发布影响           |
| ------ | ---------------------------------------------------------- | ------------------ |
| P0     | 凭据泄漏、认证绕过、破坏性操作命中错误资源                 | 立即拒绝           |
| P1     | 核心流程不可用、API method/path 错误、设置丢字段或语义变化 | 拒绝               |
| P2     | 可恢复的次要流程、响应式、焦点或兼容性缺陷                 | 修复或显式接受例外 |
| P3     | 轻微文案或视觉不一致                                       | 可记录后发布       |

## 16. 验收报告模板

```text
Date:
Commit / branch / working tree:
Environment:

Repository quality: PASS/FAIL
React architecture: PASS/FAIL
Stable API contract: PASS/FAIL (198/198)
Local runtime: PASS/FAIL
Real Harbor workflows: PASS/FAIL/BLOCKED
Browser UI: PASS/FAIL/BLOCKED
Security regression: PASS/FAIL
Findings regression: PASS/FAIL/BLOCKED
Container runtime: PASS/FAIL/NOT RUN
Native OIDC login: NOT IMPLEMENTED
Overall release: ACCEPTED/REJECTED/PROVISIONAL

Findings:
- [severity] [ID] title
  Reproduction:
  Evidence:
  Affected surface:

Cleanup completed:
Remaining risk:
```
