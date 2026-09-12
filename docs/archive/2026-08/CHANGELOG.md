# Harbor Console 变更记录

> 最后整理：2026-08-04
> 记录范围：Git 历史、被清理的旧 docs、当前迁移提交的代码与测试
> 注意：`e75001f` 是迁移前基线；当前迁移提交已经通过全部 Gate，但尚未标记为已发布版本。

## 1. 记录规则

本文档同时记录版本演进和缺陷知识。每条重要变更应包含：

- 日期或 Commit。
- 变更内容。
- 原因或历史问题。
- 行为影响。
- 测试或验收证据。
- 未完成项和风险。

只有 Git 中存在的 hash 才标记为具体“已提交”历史；本次尚未发布的整体变更统一标记为“当前迁移提交”。

## 2. 2026-08-03：文档重新沉淀

状态：当前迁移提交。

- 清理旧 `docs/README.md`、ADR、plans 和 acceptance 子目录。
- 将有效信息重新组织为 `DESIGN.md`、`IMPLEMENTATION.md`、`ACCEPTANCE.md`、`CHANGELOG.md` 四份长期文档。
- 把旧文档中的架构决策、198 个稳定 API、18 条真实缺陷回归、最近验收阻塞和发布 Gate 合并到当前事实来源。
- 从当前 CSS、typed React 和前端合同/组件测试中提取 UI 规范，新增 UI-001 至 UI-012，专门防止布局塌陷、字体不一致、原生 select 差异、文字重叠、表格压缩、焦点和整页重绘问题复发。
- 明确区分历史 Commit、当前迁移提交、本地测试、真实 Harbor 验收和发布 Gate，避免文档再次混淆“实现完成”“提交完成”和“已发布”。

本地证据：2026-08-04 执行 `make check`，Go vet/race、前端格式和语法、20 条合同测试、44 个文件中的 153 条组件测试及生产构建全部通过。

## 2.1 2026-08-03 至 2026-08-04：React 全量迁移完成

状态：当前迁移提交。

### 变更

- 新增 React 19、TypeScript、Vite、ESLint、Vitest 与 Testing Library 构建链，产物继续嵌入单一 Go 二进制。
- React 接管应用根节点、会话、hash 路由、全部领域页面、Dialog 和全局 overlay；原有 CSS 按原加载顺序进入 Vite，保留 token、selector、动画和响应式规则。
- 删除 `frontend/public/runtime/`、classic renderer、HTML parser、preview 入口及其依赖；生产入口只挂载 typed React。
- `internal/webui/assets/` 是纯 Vite 生成目录，Go embed 递归嵌入 hashed bundle，不再包含 runtime 兼容资源。
- 清理 `internal/webui/` 下仍引用旧 `app.js` / `control-ui.js` 等已删除资源且未被质量门执行的 `.cjs` 死测试；新增架构合同，限制该目录只能包含 `embed.go` 和生成资产。
- 生产 bundle 按业务领域拆分，最大 JavaScript chunk 从约 849 kB 降至 181.71 kB raw，消除 500 kB 构建警告。
- Docker 和 Makefile 在 Go 编译前执行 `npm ci` / `npm run build`。

### 原因

- 旧架构依赖全局函数、事件委派与字符串 HTML 拼接，领域增长后难以维持状态边界、可测试性与组件一致性。

### 防复发

- 构建产物目录禁止手写源码；所有请求只允许使用当前稳定 `controlSpecs` / `resourceSpecs` 中声明的 operation、query 和字段。
- 中文和英文由 Codex 分别执行桌面与移动端浏览器验收，而不是仅检查词典。
- 架构合同禁止重新引入 classic runtime、字符串 DOM renderer、兼容字段或 preview 入口。
- 所有普通单选控件必须复用 `UnifiedSelect`；typed React 生产源码中的原生 `<select>` 由架构合同直接拒绝。
- TypeScript 强制 `noUnusedLocals` 和 `noUnusedParameters`，避免死字段、废弃函数与迁移残留重新进入生产源码。
- React 迁移默认不得改变旧版 UI；只有旧版同类型组件本身不一致时，才允许通过共享 primitive 做小范围统一，不能借迁移重新设计页面。

### 当前验证

- 20 条 React 架构/样式/i18n 合同测试与 44 个文件中的 153 条组件测试通过，共 0 failed。
- 完整 `make check` 通过，覆盖 Go vet/race、前端检查/测试/构建与生产二进制构建。
- 信息性 `make coverage` 通过，总语句覆盖率 61.5%；稳定 API 合同独立复验确认 198 个非废弃 operation fixture 与实现一致。
- 本轮构建二进制的 Local runtime Gate 通过：health、405、CSP、内嵌资源、demo Cookie、logout 后 401、访问日志和 SIGTERM 零退出均已实际验证。
- 迁移前基线与 React 生产入口完成 24 条认证后路由、两种语言和 1440x900、1280x800、390x844、360x800 四个视口的同矩阵比较，共 384 项检查，0 failure、0 unexpected console issue。
- React 生产入口完成 47 条页面/页签状态 × Chromium/Firefox/WebKit × 两种语言 × 四个视口的正式矩阵，共 1,128 次认证后路由检查，24/24 场景通过；该命令已接入独立 CI Browser Job。
- 扩展矩阵发现并修复英文 1280x800 制品详情操作区 78px 横向溢出，以及 WebKit 搜索关闭后 opener 焦点未恢复；修复后全矩阵通过。
- 项目详情九个 tab 的结构投影全部匹配迁移前基线；代表性创建/破坏性 Dialog 的可见字段几何一致；项目设置身份展示和单项目删除预检/精确名称确认行为已恢复。
- 所有矩阵视口均无 document/main 页面级横向溢出。
- 搜索结果、`Escape`、outside click、焦点恢复、账号、实例切换、操作中心和偏好 Dialog 均有组件或浏览器证据。
- 安全筛选、项目代理配置和用户组来源等普通单选均已迁移到共享 `UnifiedSelect`；桌面和 390px 移动端浏览器复验无页面级溢出或控制台错误。
- `make security-check` 通过：npm 依赖 0 个高危漏洞，`govulncheck` 未发现可达 Go 漏洞。
- `make browser-test` 通过：Chromium、Firefox、WebKit 的 24/24 双语四视口场景全部通过。

## 2.2 2026-08-04：公开目录补全与真实 Harbor 边界验收

状态：当前迁移提交；真实 Harbor 扩展边界和完整跨领域 Gate 均已通过。

### 变更

- 新增 typed React 公开目录，覆盖匿名项目、仓库、制品、搜索、分页、面包屑、刷新/历史恢复、拉取命令复制、中英文切换和返回登录。
- `HarborBrand`、登录入口、API client、models 和 locale 统一接入公开目录，不创建登录会话或 Cookie。
- 约束 `.workspace`、`.main-content`、page header、breadcrumb 和项目 tabs 的可收缩宽度，阻止长资源名把页面撑宽。
- 项目主标题最多显示 3 行，并保留完整 `title`。
- 项目机器人创建按 Harbor 组合名称的 255 字符上限计算可输入后缀；项目名已经占满长度时禁用名称和提交，避免向上游发送会触发 500 的请求。
- 新增共享 `OverflowText`，统一项目、成员、用户、组、Robot、Webhook、Label、selector、邮箱、Artifact Tag/Label 等单行长值的 260px 省略与完整 `title`。
- Dialog 表单列改为 `minmax(0, 1fr)`，共享表单子项和标题区域补齐 `min-width:0`，防止超长名称、URL、描述和 selector 扩大固定宽度 Dialog。
- 制品 Label chip 使用与共享长文本一致的 260px 上限，移动端不再越过摘要卡片。

### 真实 Harbor 证据

- 通过内网地址访问 `hb2.jzxk.cc` 对应的 Harbor `v2.15.2-a97e7b83`。
- 匿名读取 4 个公开项目，搜索并进入真实仓库与 2 个制品；刷新、历史恢复、中英文和无 Cookie 验证通过。
- 创建并回读 255 字符公开项目；创建私有 `acceptance-*` 项目；`1025 TiB` 配额被本地拒绝。
- 创建并回读 128 字符机器人名称和 1024 字符描述；错误项目名删除确认被拒绝；机器人和全部验收项目随后删除。
- 创建并回读 255 字符用户与项目成员、128 字符全局/项目 Label、255 字符 Webhook、1024 字符不可变/Retention selector、180 字符系统 Robot 和 128 字符 Artifact Tag；完成 Artifact Label 绑定与解绑。
- 真实 Label 边界为 128 字符，129 字符由 Harbor 拒绝；Retention `extras` 需要发送包含 JSON 的字符串。
- Robot POST 不持久化 `disable`，因此创建后用官方返回名称和当前 `level` 执行 PUT；真实 UI 创建停用 Robot、回读“已停用”并删除通过。
- 配额和系统配置完成修改、权威回读与原值恢复；用户组、Registry、P2P instance/policy 完成完整生命周期。
- Replication policy 完成创建、更新、手动执行与删除，执行状态为 `Succeed`；缺失 `enabled` 按停用处理，`speed: 0` 在 UI 中表示不限速。
- Scanner 完成创建、更新、回读与删除；名称、URL、凭据和描述上限分别为 128、512、512、1024 个字符，首个和默认 Scanner 均不能停用。
- Replication 描述和过滤值改用 Unicode 字符计数，1024 个中文字符通过、1025 个字符拒绝。
- 清理后 `acceptance-*`、`acceptance-final-*` 和 `codex-ui-*` 验收资源均为 0；原制品 Tag 精确恢复为 `["9"]`，Label 恢复为 `[]`。

### 视觉对照

- 迁移前基线在 255 字符项目下产生桌面 `4391px`、移动端 `3916px` 页面宽度。
- React 入口分别保持 `1280px` 和 `390px`，标题稳定为 3 行，长机器人表格保持在自身容器内。
- 390x844、412x915、1280x720 最终复验中 document 宽度分别为 390、412、1280；Dialog 外/内宽度分别为 374/372、396/394、620/618，控制台无相关 warning/error。
- 移动端宽表只在 364/386px 的局部容器内滚动；长制品 Label chip 收敛为 260px 并保持完整 `title`。
- Codex 内置浏览器完成 DOM、交互和控制台检查；其截图 API 返回 `playwright.screenshot is not a function`，因此按已允许的 fallback 使用仓库 Playwright 生成桌面和移动截图。

## 2.3 2026-08-04：容器 Gate 与最终验收收口

状态：当前迁移提交；当前实施范围综合结论为 `ACCEPTED`。

- 通过 Homebrew 安装 Docker CLI 29.7.1 与 Colima 0.10.3，并使用 Docker server 29.5.2 执行本地 container runtime Gate。
- `make docker-build VERSION=dev` 成功；构建阶段和 distroless 运行阶段均使用 Dockerfile 固定的不可变镜像 digest。
- `harbor-console:dev` 的 image/container user 均为 `nonroot:nonroot`，PID 1 实际 UID 为 65532。
- 容器读取 `/etc/harbor-console/config.yaml`，仅映射到主机 loopback；health、生产 HTML、favicon 和全部 hashed JavaScript/CSS bundle 均返回 200，并保留严格 CSP 与 `Cache-Control: no-store`。
- 向容器发送 SIGTERM 后日志记录 `server_stopped`，容器状态为 exited，退出码为 0。
- 至此 Repository quality、React architecture、Stable API contract、Local runtime、Real Harbor、Browser UI、Security regression、Findings regression 和 Container runtime Gate 全部通过；原生 OIDC 登录不在当前实施范围内。

## 2.4 2026-08-04：React 迁移后 UI 一致性收口范围登记

状态：`OPEN`，本节仅沉淀后续工作，当前文档变更不包含代码实现。

用户确认 React 全量重写的整体效果可接受，同时指出六类迁移前需求或界面信息尚未完整恢复。技术迁移完成的历史验收结论继续保留，但当前产品 UI 的最终签字重新打开，完成以下事项后必须重新执行浏览器与 Findings regression Gate：

- 取消列表工具栏、筛选区等位置的独立排序控件；所有排序统一进入可排序列的表头，通过上下小三角表达未排序、升序和降序状态。
- 所有“每页 50 条”选择器移到表格左下角，紧跟“第 xx-xx 项，共 xx 项”，与右侧翻页控件组成统一 pagination footer。
- 缩短项目中心“项目所有者”控件的无界宽度，并先定位其与“可见性”垂直中轴不一致的盒模型根因；修复必须落在共享高度、line-height、padding、border 或 icon token，禁止添加零散像素 offset。
- 项目页面和导航文案统一为“项目中心”，原“镜像资产”统一为“镜像仓库”，并同步中英文词典及相关页面状态。
- 项目中心列表上方恢复项目总数、仓库数量、自动扫描覆盖和漏洞阻止覆盖四个概览指标，使用当前账号可见的 Harbor 权威数据和统一概览 primitive。
- 删除项目与镜像仓库名称单元格中无业务语义的灰色/黄色文件夹类图标，不改变文本、行高、点击区域或整体 UI 语言。

对应计划：`plans/2026-08-04-react-ui-consistency-follow-up.md`。对应验收项：UI-013 至 UI-018。

## 2.5 2026-08-04：第二批动画、空状态与列表一致性需求登记

状态：`OPEN`，本节继续补充后续工作，当前文档变更不包含代码实现。

- 全面恢复共享线性动画覆盖。概览和项目中心之外的一级页面也必须使用相同 route motion；复制管理的复制策略/执行记录、其他页内 tab、筛选结果以及列表/卡片切换使用统一 content motion。
- 空状态统一在所属内容区居中。安全中心“没有高风险 CVE”“没有危险制品”和 P2P“暂无 P2P 实例”的截图证明当前左对齐行式布局不符合目标；相同问题必须全系统排查。
- 原“镜像资产”改名后的跨项目镜像仓库页面恢复列表展示，在工具栏右侧复用现有列表/卡片切换按钮，并为视图切换补齐统一动画。
- 所有筛选页面在存在活动筛选时恢复“取消筛选”操作；取消只清理筛选并回到第一页，不能丢失视图模式、每页条数和有效排序。
- P2P 官方 Provider 卡片删除 Dragonfly、Kraken 版本号，避免形成只支持固定版本的产品暗示；Provider 名称和真实能力合同继续保留。
- 为具备权威 total 的列表增加统一 section 数量摘要。优先覆盖镜像仓库、审计日志、管理中心用户、用户组、机器人账号，并对其他页面做完整盘点，不限于已列示例。

对应计划继续使用 `plans/2026-08-04-react-ui-consistency-follow-up.md`。新增验收项：UI-019 至 UI-025。

## 2.6 2026-08-04：列表排序、筛选与远端仓库视图补全

状态：当前未提交工作区；本节记录本轮已实现的局部 UI 收口。

- 项目中心概览的自动扫描与漏洞阻止指标分别使用扫描和漏洞图标；项目表的可见性、自动扫描和漏洞阻止表头支持真实全量排序与分页。
- 跨项目镜像仓库恢复明确的“筛选”和活动筛选“取消筛选”按钮；制品数、拉取次数、创建时间和最近推送列统一居中，数字列为五位数及千分位预留稳定宽度，创建时间也支持排序。
- 复制管理状态筛选使用中文状态文案；策略和执行记录的全部数据列使用共享表头排序，并由完整加载的数据集执行真实排序。
- 远端仓库新增共享列表/卡片切换、偏好持久化和名称、类型、状态、创建时间排序；列表与卡片使用相同的已排序数据。
- `npm run check`、20 条合同测试、44 个文件中的 155 条组件测试和 Vite 生产构建通过。Codex 内置浏览器完成中文桌面与 390x844 移动验证，项目、镜像仓库、复制管理和远端仓库无相关 console warning/error。

本轮未重新执行真实 Harbor、三浏览器全矩阵或容器 Gate，因此不改变整体发布结论；其余 UI-013 至 UI-025 事项仍按计划继续盘点。

## 2.7 2026-08-04：排序正确性、稳定渲染与仓库时间语义修复

状态：当前未提交工作区；完成根因修复、组件/合同门禁与文档同步。

根因：

- 项目中心把完整 query string 作为带 `motion-content-enter` 容器的 React `key`，排序、筛选或翻页都会卸载并重建整块表格；项目概览 effect 又依赖整个 `routeState` 对象，纯排序也会清空并重新请求概览，造成页面多区域闪烁。
- 远端仓库、跨项目镜像仓库、审计、复制和 P2P 页面存在相同类别的“排序值/query/请求完成计数驱动动画重挂载”或刷新先清空成功数据问题。
- Harbor v2.15.2 的 `Project.repo_count` 与 `Repository.artifact_count` 都是在数据库列表查询后装配的派生字段。此前项目中心把 `repo_count` 透传给 Harbor，项目详情把 `artifact_count` 透传给 Harbor；接口可以成功返回，但底层顺序不会按这些字段变化。
- 项目详情手写的排序白名单只包含 `-artifact_count`、`-pull_count`、`-update_time`，表头切换到升序后会被路由解析回退为默认排序。
- Harbor Repository API 只将 `update_time` 定义为仓库更新时间；v2.15.2 实现还会在拉取计数落库以及制品/标签变更时更新该值，因此把它展示为“最近推送”不准确。
- 共享稳定表格只有 `min-width: 100%`。在 360/390 窄屏下，多列项目表被压缩到视口宽度，表头文字、排序箭头和点击区域互相重叠，自动化点击“仓库数”会实际命中相邻的“漏洞阻止”。

修复：

- 项目中心的概览请求只依赖名称、可见性和所有者筛选；排序与分页不再清空概览。表格不再由 query 驱动重挂载，已有数据在重新校验期间保持 DOM identity。
- `repo_count`、项目 metadata 与项目内 `artifact_count` 改为对当前账号完整可见数据集排序后分页；仓库排序抽取为共享比较器，跨项目与项目内列表使用同一数值、时间和名称规则。
- 项目、项目详情、跨项目仓库和复制页面的排序白名单统一由 `createSortValues` 双向生成。远端仓库只在列表/卡片结构切换时重挂载；排序不再重播内容动画。审计、复制和 P2P 的请求完成计数重挂载已移除，刷新保留已有成功内容。
- 跨项目仓库、项目内仓库和公开目录的 `update_time` 列统一改为“最近更新 / Last updated”，统计脚注明确为 Harbor 仓库更新时间；Tag retention 的真实“最近推送”语义保持不变。
- 新增架构门禁：禁止 query、排序值和 `contentVersion` 驱动动画容器 `key`，禁止 `setContentVersion` 强制重挂载；新增排序合同门禁，要求路由型列表使用 `createSortValues`。
- 共享 `.data-table-stable` 改为 `min-width: max(100%, 760px)` 并继续由 `.table-scroll` 承担局部横向滚动；新增合同门禁锁定该规则，保证窄屏排序按钮保持独立命中区域。

验证：

- `npm run check` 通过，包含 Prettier、ESLint、TypeScript 和 whitespace 检查。
- 项目中心、项目详情、跨项目仓库、远端仓库、复制、审计、P2P 与共享仓库排序共 8 个测试文件、32 条测试通过；新增断言确认排序前后 table DOM 为同一节点、派生字段实际改变行顺序且未透传给 Harbor。
- 前端完整测试通过：24 条合同测试、45 个组件测试文件中的 167 条测试全部通过；合同包含排序双向白名单、稳定内容 identity、仓库时间文案和窄屏表格点击区域门禁。
- `npm run test:browser` 的 24 项 Chromium、Firefox、WebKit 路由矩阵全部通过，覆盖中文/英文与 1440x900、1280x800、390x844、360x800 视口。
- Codex 内置浏览器完成桌面与 390x844 交互复验：项目仓库数升降序分别得到 `9, 9, 11, 15, 18, 24` 与 `24, 18, 15, 11, 9, 9`，排序前后表格尺寸保持不变且没有 loading 闪回；移动端“仓库数”和“制品数”命中正确字段，页面无横向溢出，镜像仓库页面不存在“最近推送”，无相关 console warning/error。
- `go test ./...`、Vite 生产构建和 `git diff --check` 通过，嵌入式生产资源已重新生成。

## 2.8 2026-08-05：侧栏品牌与一级路由动画根因收敛

状态：当前未提交工作区；实现、质量门禁、生产构建与完整浏览器复验均已完成。

根因：

- 侧栏和顶栏同时提供实例切换入口，侧栏实例卡片重复占用首屏空间；品牌组件另外手绘橙色 `H`，与生产 favicon 形成两套视觉标识。
- 一级路由已经由 `ApplicationShell` 的 keyed 内容 owner 执行 `motion-route-enter`，但概览和项目详情又在领域组件内重复添加同一 route motion，动画 owner 不唯一。
- 跨项目镜像仓库在进入后按项目加载仓库。旧实现每 4 个项目形成一个固定批次，必须等待整批结束才启动下一批；真实实例项目越多，首屏等待越明显。
- 仓库统计区在初始数据完成前完全不渲染，数据返回后整段 DOM 插入并把列表向下推移。用户看到的“没有动画而闪烁”本质是请求批次屏障与布局跳变，不是缺少 CSS class。

修复：

- `HarborBrand` 直接复用 `/favicon.svg`；删除侧栏实例卡片，顶栏实例切换器继续作为唯一入口，实例菜单、焦点恢复和切换能力保持不变。
- 删除领域页面重复的 `motion-route-enter`，一级 route motion 只由 `ApplicationShell` 执行；新增架构门禁，禁止 feature 重新声明 route motion owner。
- 仓库扇出请求改为 4 worker 的完成即补位队列，消除固定批次之间的等待屏障。
- 仓库 header、四项统计和 table shell 在首帧即保持稳定结构；加载完成只更新既有内容并执行一次共享 content motion，刷新已有数据时不重播。

验证：

- `npm run check`、25 条前端合同测试、45 个组件测试文件中的 168 条测试、Vite 生产构建、`go test ./...` 与 `git diff --check` 全部通过。
- ApplicationShell 与跨项目镜像仓库的定向断言覆盖 favicon 品牌、唯一实例入口、唯一 route motion owner、加载期稳定统计结构和 worker 完成即补位。
- Codex 内置浏览器完成中文桌面与 390x844 交互复验：侧栏品牌实际加载 `/favicon.svg`，侧栏实例卡片为 0，顶栏实例切换按钮为 1 且菜单可正常打开；概览、项目中心与镜像仓库切换时 `.motion-route-enter` 均只有 1 个 owner，移动端 document/main 无横向溢出且仓库统计区保持挂载。
- `npm run test:browser` 的 24 项 Chromium、Firefox、WebKit 路由矩阵全部通过，覆盖中文/英文与 1440x900、1280x800、390x844、360x800 视口。

## 2.9 2026-08-05：共享下拉浮层裁切根因修复

状态：当前未提交工作区；共享组件、质量门禁、生产构建与完整浏览器复验均已完成。

根因：

- 全部单选控件复用 `UnifiedSelect`，但菜单仍以触发器为 containing block 使用 `position:absolute` 和固定向下展开。
- 分页、表格卡片与 Dialog 等 owner 普遍拥有 `overflow:hidden/auto`。靠近视口或容器底部时，菜单既不会检测剩余空间，也无法越过祖先裁切边界，因此所有页面的同类下拉都会出现截图中的空白、截断或不可点击选项。

修复：

- listbox 统一 portal 到 `document.body` 并改用 fixed 定位，从结构上脱离页面、table、panel 和 Dialog 的 overflow owner。
- 共享组件按 visual viewport 计算上下左右可用空间，空间不足时自动向上展开，限制菜单最大高度与四边安全间距，并在滚动、缩放和元素尺寸变化时持续重定位。
- 外部点击、方向键、Home/End、选中后焦点恢复、hidden form value 与 ARIA button/listbox 合同保持不变；Escape 由打开的 select owner 在 document capture 阶段统一关闭并阻止穿透外层 Dialog，消除 WebKit 不触发局部 handler 的差异；领域页面不增加任何专属定位补丁。
- 新增 UI-030 与架构合同，禁止菜单回退为祖先内 absolute 定位；浏览器路由矩阵新增页面底部分页下拉的 portal、向上翻转、视口边界和焦点恢复检查。

验证：

- `npm run check`、26 条合同测试、45 个组件测试文件中的 170 条测试、Vite 生产构建、`go test ./...` 与 `git diff --check` 全部通过。
- `UnifiedSelect` 组件测试覆盖 body portal、底部向上翻转、滚动后重定位、键盘关闭和焦点恢复；架构合同拒绝菜单回退为祖先内 absolute 定位。
- `npm run test:browser` 的 24 项 Chromium、Firefox、WebKit 路由矩阵全部通过；每个中文/英文、1440x900、1280x800、390x844、360x800 场景都会把镜像仓库分页下拉滚到视口底部，验证 `data-placement=top`、四边至少 8px 安全间距和 Escape 焦点恢复。
- Codex 内置浏览器完成 1280x720 与 390x844 实际页面复验：菜单 parent 为 `document.body` 且均向上展开，桌面和移动端均未越出 visual viewport，390 宽度下 document 横向溢出为 0。

## 2.10 2026-08-05：可排序表头与表体视觉中轴统一

状态：当前未提交工作区；实现、共享规范、自动门禁和最终浏览器证据均已完成。整体发布结论仍按项目既有 Real Harbor/Container 范围单独判断。

根因：

- 共享 `.table-sort-button` 使用 flex 将“列名 + 10px 排序指示器”作为整体居中。控件整体虽然位于列中央，但列名本身会向指示器反方向偏移 5px，因此截图中有排序按钮的表头与无图标的表体内容不在同一视觉中轴。
- 部分表格只给表头设置居中 class，表体仍使用默认对齐；项目表还依赖 `nth-child` 选择器处理个别列。列结构变化或复用共享表头后，这些隐式规则无法保证 `<th>` 与 `<td>` 同轴。
- 复制执行状态、任务统计、耗时以及复制策略方向列沿用只够中文短文案的固定宽度。英文 badge 或可排序表头超过扣除 padding 后的内容区时，浏览器从内容区起点排版超宽 inline 内容，进一步形成约 8px 的视觉偏移和相邻列侵入。
- 既有合同只检查 class、稳定列宽和窄屏点击命中，没有测量渲染后的文字与内容中心，因此“CSS 看起来居中但视觉轴偏移”能够通过测试。

修复：

- 居中的排序按钮由共享 CSS 在排序指示器对侧生成同为 10px 的平衡空间，使列名文字本身落在表头单元格中轴；排序图标继续可见且不改变点击区域。
- 项目中心、项目详情、跨项目镜像仓库、复制策略、复制执行和审计表统一在表头与表体成对使用 `table-cell-center`、`table-cell-number`、`table-cell-time`，并删除项目表基于 `nth-child` 的对齐规则。
- 复制表固定列宽按中英文最长表头和内容重新核算：执行表扩大状态、任务统计、耗时列并提高稳定最小宽度，策略表扩大方向列；移动端继续由表格 owner 局部横向滚动。
- 架构合同锁定共享平衡空间并拒绝项目表恢复特定列 `nth-child` 补丁；新增 UI-031，禁止页面专属 margin、transform 或 padding 修正。
- 路由矩阵新增真实像素测量：分别检查列名中心相对 `<th>`、首行内容中心相对 `<td>`、列名中心相对首行内容中心，绝对偏差上限统一为 1px；同时要求排序按钮和首行内容不超过扣除 padding 后的可用宽度。覆盖复制策略方向/触发/状态及复制执行触发/状态/任务统计/开始时间/耗时列的全部浏览器、语言和视口场景。

验证：

- `npm run check`、27 条前端合同测试、46 个组件测试文件中的 171 条测试、`go test ./...` 与 Vite 生产构建均通过；共享 `ToolbarSearchForm` 的草稿抗重渲染修复也有独立回归测试覆盖。
- 最终 `npm run test:browser` 在 Chromium、Firefox、WebKit 的中文/英文、1440x900、1280x800、390x844、360x800 全部 24 项场景通过。
- Codex 内置浏览器完成新鲜 demo 会话的 1280x800 与 390x844 截图。复制策略与执行列名、首行内容和列单元格的最大轴偏差为 `0.004px`；最大正向表头溢出为 `0.461px`，低于 1px 门槛；移动端 document/main overflow 均为 `0`，表格只在自身 920/950px 滚动容器内横向滚动；四个页面 console 均无 warning/error。
- `git diff --check` 在最终文档和源代码状态下通过。UI-031 本轮正式关闭；此前暂停断点保留在 `plans/2026-08-04-react-ui-consistency-follow-up.md` 第 6 节作为过程记录。

## 2.11 2026-08-05：项目中心可见性列对齐根因修复

状态：当前未提交工作区。

### 变更

- 修复 `frontend/src/features/projects/projects-page.tsx` 中“可见性”列只在表头声明 `table-cell-center`、表体 `<td>` 漏声明的问题。
- 按中英文最长表头和 badge 内容重新计算项目表固定语义列宽，避免排序控件和状态内容在窄屏或英文模式下溢出。
- 新增项目表架构合同，阻止同一列再次出现表头/表体语义类断裂。
- 扩展项目中心浏览器 Gate：逐列比较 header/body 语义类，并使用真实 `getBoundingClientRect()` 测量列名、单元格和可见性 badge 的中心轴。
- 将该规则沉淀到 `DESIGN.md`、`IMPLEMENTATION.md`，并登记为 UI-032。

### 原因

- `th { text-align:center }` 只影响表头排序按钮；默认 `td { text-align:left }` 使 `inline-flex` badge 从单元格内容区左侧开始布局。表头与表体的对齐语义没有成对声明，导致视觉中轴断裂。
- 这是列契约未闭合的问题，不是 badge 的 margin、transform 或截图缩放问题。

### 防复发

- 每列的 header/body 语义对齐类必须成对出现；新增或修改列时必须同时检查 `<th>` 和所有 `<td>`。
- 静态合同用于尽早阻止漏配，浏览器 Gate 继续测实际渲染几何，中心偏差上限为 1px。
- 禁止页面专属 offset、`nth-child`、负 margin 或 transform 掩盖列轴错误。

### 当前验证

- `npm run check`：PASS；合同测试 28/28、组件测试 46 个文件/171 条：PASS。
- `npm run build`、`go test ./...`、`git diff --check`：PASS。
- `npm run test:browser`：Chromium、Firefox、WebKit 的中文/英文、1440x900、1280x800、390x844、360x800 共 24/24 场景通过；项目中心语义配对和实际轴/宽度断言全部通过。

## 2.12 2026-08-05：复制执行详情长值与列稳定性收口

状态：当前未提交工作区；实现、组件测试、生产构建和 Codex 浏览器桌面/移动复验已完成。

### 变更

- 复制执行详情任务表的源/目标列改为独立稳定宽度，长资源值最多显示两行并通过 `title` 保留完整内容查看。
- 操作列固定为单行居中，避免“复制”在窄列中竖排；状态 badge 按实际盒模型居中；开始/结束时间复用单行时间列规则。
- 两行省略样式放在单元格内部文本节点，不直接改变 `<td>` 的 table-cell 盒模型，避免源/目标列共用起点或推动其他列。
- 移动端继续由任务表自身 `.table-scroll` 承担横向滚动，不使用页面级 `overflow-x`。
- 将规则登记为 UI-033，并同步 `DESIGN.md`、`IMPLEMENTATION.md` 和 `ACCEPTANCE.md`。

### 验证

- 复制弹窗与复制页面定向组件测试：7/7 通过；Prettier 检查通过。
- `make build` 成功，生成嵌入式 Vite 资源和 `bin/harbor-console`。
- Codex 内置浏览器在 `http://127.0.0.1:9999/#/replication?tab=executions` 演示会话中复验：1280x720 下任务表 `1040px`，列起点独立、操作单行、状态居中、结束时间单行，document overflow 为 `0`；390x844 下 Dialog `374px`，任务表由 `.table-scroll` 局部滚动，document/main overflow 均为 `0`。

### 剩余风险

- 本轮只覆盖复制执行详情的布局回归；完整 Chromium/Firefox/WebKit 全矩阵和真实 Harbor/Container Gate 仍沿用既有独立验收范围。

## 2.13 2026-08-05：全局分页页码快速跳转

状态：当前未提交工作区；共享组件、组件测试、生产构建与浏览器验收进行中。

### 变更

- 标准列表分页和 Dialog 内分页统一复用 `PageJumpControl`。
- 点击当前页/总页数文本后隐藏原页码，仅显示短灰色底线；用户输入的数字使用橙色，不自动选中文本，也不显示输入背景、边框或阴影。回车跳转到输入页码，失焦自动恢复原页码文本。
- 页码自动钳制到有效范围：小于 `1` 跳到第 `1` 页，大于最大页跳到最后一页；Escape 取消且不改变当前页。
- 将规则登记为 UI-034，并同步设计、实施和验收文档。

## 2.14 2026-08-05：概览最近复制活动耗时列对齐

状态：当前迁移提交。

- 根因是概览表的“耗时”表头使用 `.table-cell-time` 居中语义类，而对应表体单元格遗漏该类，造成同一列的表头居中、内容左对齐。
- 给耗时列 `<td>` 补齐共享时间列语义类，不使用页面专属 offset 或 `nth-child` 修正。
- 新增组件测试，锁定“耗时”表头和表体单元格必须成对使用 `.table-cell-time`，继续归入 UI-032 回归基线。

### 防复发

- `frontend/src/components/data-table.test.tsx` 覆盖浮层打开、回车跳转和上下边界钳制。
- 领域页面不得复制分页跳转逻辑；新增分页必须复用共享 primitive。

## 3. 2026-08-01 至 2026-08-03：生产结构与质量体系重构

状态：当前迁移提交，基于 `e75001f` 完成演进。

### 3.1 Go 项目布局

旧问题：全部 Go 代码位于仓库根目录，`main.go`、`control.go`、`demo_control.go` 同时承担启动、HTTP、网关、会话、demo、配置和日志职责，文件名反映实现历史而非生产责任。

当前变化：

- 入口迁移至 `cmd/harbor-console/main.go`。
- HTTP、会话、类型化网关、校验和 demo 拆分至 `internal/app`。
- 配置迁移至 `internal/config`。
- 日志迁移至 `internal/observability`。
- 构建信息增加 `internal/buildinfo`。
- Web 资源迁移至 `internal/webui/assets` 并继续嵌入单二进制。
- Docker、Makefile 和 CI 统一构建 `./cmd/harbor-console`。

防复发：仓库根目录不再放业务 Go 源码；新逻辑进入明确 owner package；不为了拆包导出无必要类型。

### 3.2 API 范围从 203 全量 operation 收敛为 198 稳定 operation

旧阶段曾以 Harbor v2.15.2 的 203 个 operation 为全量目标，其中包含 deprecated 接口。生产重构后明确只支持 198 个非废弃 operation，并删除 legacy/deprecated 兼容映射。

当前证据：

- `internal/app/api_contract_test.go` 固定 `stableOperationCount = 198`。
- `internal/app/testdata/harbor-v2.15.2-stable-operations.txt` 固定稳定 method/path。
- 测试检查 missing、unexpected 和 duplicate 双向差集。

防复发：不得用 deprecated endpoint 作为新 UI 数据源；不得为了“覆盖率”重新引入 legacy operation。

### 3.3 前端按职责拆分

旧问题：`web/styles.css` 超过 7400 行，`control-ui.js` 超过 4300 行，页面样式、响应式覆盖和业务实现混在一起，容易出现后定义规则意外覆盖、修一个页面影响另一个页面、AI 无法判断真正 owner。

当前变化：

- 应用基础拆分为 `styles.css`、`workspace.css`、`form-controls.css`、`application-shell.css`、`overlays.css`、`control-plane.css`。
- 领域样式拆分为 Artifact、Identity、Replication、Administration、Preheat、Registry、Security 等文件。
- 跨领域响应式、间距和动画分别由 `responsive.css`、`spacing-system.css`、`motion-system.css` 管理。
- TypeScript/React 按 `app`、`components`、`layouts` 和 `features/<domain>` 拆分，领域模块拥有页面、Dialog 与状态映射。
- `main.tsx` 直接挂载 React 根组件；`index.html` 只声明离线生产入口，不包含 classic script 顺序。

防复发：新增样式和脚本必须进入对应 owner 文件；不得把新代码重新堆回单个超大文件；改变加载顺序必须更新合同测试。

### 3.4 Repository quality gate

新增或完善：

- `Makefile` 统一 format、whitespace、deployment pin、mod、vet、race、frontend 和 build。
- `package.json` 使用 Prettier、Node syntax check 和 `node --test`。
- GitHub Actions 使用不可变 SHA 和基础镜像 digest。
- Dependabot 每周检查 Actions 和 Docker digest。
- Docker 多阶段构建、非 root 运行、健康检查和优雅退出 smoke test。

防复发：CI 输入不得使用可移动 tag；本地 `make check` 与 CI 核心质量门保持一致。

## 4. UI 问题沉淀与修复记录

### 4.1 布局塌陷

现象：密集筛选栏、长资源名、侧栏导航、移动端 operation center、dialog 和表格在窄宽度下被压缩、撑宽页面或让操作按钮不可达。

主要根因：

- flex/grid 子项保留默认 `min-width:auto`。
- 等分列只使用 `1fr`，长文本无法收缩。
- 内部滚动区域缺少 `min-height:0`。
- table 没有自己的稳定最小宽度和滚动容器。
- 工具栏只按 viewport 响应，没有按自身容器宽度换行。
- 侧栏与主内容共享滚动边界。

已沉淀修复：

- 可收缩内容使用 `min-width:0`。
- 等分 grid 使用 `minmax(0,1fr)`。
- 侧栏固定于 viewport，导航区 `flex:1; min-height:0; overflow-y:auto`。
- table 保留可读列宽，在移动端 scroller 内横向滚动。
- 工具栏使用 bounded flex-basis、`flex-wrap` 和 container query。
- dialog、日志、命令和 operation center 各自拥有 overflow 边界。

回归证据：`frontend/tests/visual-contract.test.cjs`、`frontend/src/layouts/application-shell.test.tsx`、相关领域 component test、生产浏览器桌面/移动证据、UI-001、UI-002、UI-006、UI-009。

禁止做法：全局开启横向滚动、缩小字体、隐藏字段、负 margin 或绝对定位掩盖塌陷。

### 4.2 同一页面字体不同

现象：按钮、select、表头排序按钮、输入框和正文使用不同系统字体；中文/英文切换后字重、行高和宽度变化明显。

主要根因：浏览器 form control 默认不总是继承 body 字体；不同组件各自声明 font；mono 字体使用范围失控；按单个平台字体调试。

已沉淀修复：

- 全局正文字体由 `--font-body` 管理。
- ID、命令和固定宽数据使用 `--font-mono`。
- `button`、`input`、`select`、`textarea` 和自定义 select trigger 使用 `font:inherit`。
- 表头排序按钮继承表头 font 和 weight。
- 全局 `letter-spacing:0`，数字使用 tabular numbers。
- 不加载远程字体。

回归证据：`frontend/tests/visual-contract.test.cjs`、`frontend/src/layouts/application-shell.test.tsx`、双语生产浏览器证据、UI-003、UI-005、UI-007。

禁止做法：组件私设新正文 `font-family`、负字距压缩、依赖单一操作系统字体、用极端字重制造层级。

### 4.3 浏览器原生组件行为不同

现象：原生 select 在不同浏览器显示不同箭头、字体、菜单高度、焦点和弹出行为，导致页面视觉不统一；页面曾存在单独实现的筛选 picker。

主要根因：只用 CSS `appearance:none` 改外观，未统一菜单行为；不同页面重复实现 select；旧 DOM 增强链难以覆盖动态控件。

已沉淀修复：

- 新增 typed React `UnifiedSelect`，所有普通单选控件统一复用同一 primitive。
- 受控 ARIA trigger/listbox 负责可访问交互；需要参与表单提交时由 hidden input 输出当前值，不再保留原生 select 或 DOM 增强器。
- 支持 change、disabled、空选项、方向键、Home/End、Escape、焦点恢复和选中态同步。
- Replication execution filter 删除独立 picker；管理计划、安全筛选、项目代理配置和用户组来源等原生单选也全部回归共享组件。
- 架构合同扫描全部 typed React 生产源码，禁止原生 `<select>` 回归。

回归证据：`frontend/src/components/unified-select.test.tsx`、`frontend/tests/architecture.test.cjs`、`frontend/tests/visual-contract.test.cjs`、生产浏览器桌面/移动证据、UI-004。

禁止做法：页面内实现第二套单选菜单；重新加入原生 `<select>`；只改箭头不验收键盘、表单值和焦点行为。

### 4.4 文字重叠和中英文布局跳动

现象：登录标题、摘要、风险面板按钮、表格 label、长 provider 和长资源名出现覆盖、剪裁或切换语言后整体跳动。

主要根因：按中文短文本设置固定高度；在按钮和 badge 中强制 nowrap 但未提供稳定宽度；图标允许 flex shrink；长文本没有 wrap/ellipsis 策略。

已沉淀修复：

- 登录标题和摘要使用稳定行结构与 `min-height`。
- 语言敏感表单行预留最小高度。
- 图标使用固定 flex basis。
- 长 provider 和数据字段使用 `overflow-wrap:anywhere`。
- 需要省略的字段同时提供完整 title。
- 移动命令允许换行，表格通过局部滚动保留列宽。
- 英文风险操作预留单行宽度。

回归证据：`frontend/tests/visual-contract.test.cjs`、相关领域 component test、双语生产浏览器证据、UI-005、UI-008。

禁止做法：绝对定位普通文字、用 transform 拉回错位、所有列统一 nowrap、没有完整查看方式的硬截断。

### 4.5 表格对齐和列宽漂移

现象：状态、动作、时间和数量列轴线不同；行数据位数变化推动列宽；排序按钮字体与表头不同；居中排序表头把文字和图标作为整体居中，导致列名与表体内容视觉中轴偏移；中等宽度时 Replication table 变得不可读。

已沉淀修复：

- 渲染后按表头语义应用 center/time class。
- 数量列预留 `5ch` 并启用 tabular numbers。
- 时间列居中、nowrap、等宽数字。
- 表头排序按钮使用 `font:inherit`。
- 居中排序表头在指示器对侧保留等宽平衡空间；表头和表体成对使用共享语义对齐类，禁止 `nth-child` 与页面专属像素补偿。
- 复制执行、项目和仓库表使用明确的稳定列宽与局部滚动。

回归证据：`frontend/tests/architecture.test.cjs`、`frontend/e2e/route-matrix.spec.ts`、projects/repositories/replication component test、桌面与移动端生产浏览器像素轴证据、UI-006、UI-007、UI-031。

### 4.6 整页重绘、闪烁和状态丢失

现象：筛选、分页或 tab 切换时整个 main content 重建，导致 page chrome 闪动、滚动位置变化、焦点丢失和竞争动画残留。

已沉淀修复：

- `ReactApplication` 负责 hash route 与领域状态，筛选、分页和 tab 使用受控 React state 更新。
- `ApplicationShell` 在路由内容之外保持稳定，侧栏、顶栏、overlay 和页面内容由明确组件边界管理。
- 数据请求使用 `AbortController` 或等价过期结果保护，快速切换时旧请求不能覆盖新状态。
- 页面进入、overlay 和反馈动画继续复用共享 motion CSS；reduced motion 下关闭非必要动画。

回归证据：`frontend/src/app/hash-router.test.ts`、`frontend/src/layouts/application-shell.test.tsx`、`frontend/tests/visual-contract.test.cjs`、生产浏览器路由/筛选证据、UI-011、UI-012。

### 4.7 焦点丢失

现象：关闭搜索、移动菜单、账号面板、operation center 和 dialog 后，键盘用户回到页面顶部或失去可见焦点。

已沉淀修复：打开 overlay 时捕获 opener；关闭时仅在 opener 仍连接 DOM 的情况下恢复焦点；dialog 首字段聚焦并把文本光标放到末尾；全局提供 `:focus-visible`。

回归证据：`frontend/src/layouts/application-shell.test.tsx`、各 Dialog component test、生产浏览器搜索与账户面板证据、REG-011、UI-010。

## 5. 2026-08-01：真实验收缺陷整改

状态：实现、本地回归和真实 Harbor 全量矩阵均已进入当前迁移提交；2026-08-04 已完成全部跨领域持久化、恢复和清理复验。

| ID      | 历史问题                                   | 根因                                              | 当前防复发措施                                                                            |
| ------- | ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| REG-001 | 公开项目环境下错误密码可能被误判有效       | 使用项目列表验证凭据                              | 改用受保护的当前用户能力验证；错误密码在建立 session 前被拒绝，真实环境与回归测试通过     |
| REG-002 | 项目 quota 读写错误                        | 把 quota 当 project metadata                      | 使用官方 quotas endpoint，独立保存和回读                                                  |
| REG-003 | 新建项目 Robot 不在项目列表                | scope/filter 与 endpoint 语义不一致               | 项目 Robot 始终使用项目级 endpoint 和生命周期测试；真实创建、回读和删除已通过             |
| REG-004 | Artifact 总数不一致                        | 混用全局统计和可见资源                            | 只从当前账号可见资源派生，并验证页面间一致性                                              |
| REG-005 | 清空最后一个 CVE 后 Harbor 仍保留          | 丢失 allowlist identity 或只看 toast              | 提交完整对象并回读 0 items                                                                |
| REG-006 | self-registration 被发送但 Harbor 标记只读 | 忽略 `editable:false`                             | UI 锁定且保存 payload 永不包含该字段                                                      |
| REG-007 | 部署示例和出站边界不清晰                   | 文档未说明 public catalog SSRF/egress 与 Skip TLS | 默认 loopback，README 和设计文档明确边界                                                  |
| REG-008 | 英文界面残留中文                           | 动态片段和 option 未在渲染时翻译                  | 完整句 key、动态词典和英文回归测试                                                        |
| REG-009 | 空时间显示公元 1 年                        | 直接格式化 Go zero timestamp                      | 共享日期工具统一识别缺失、非法和零时间                                                    |
| REG-010 | 手动 Retention 变成每日计划                | 空 Cron 被默认值覆盖                              | 保留 Harbor `Schedule` + empty Cron 语义                                                  |
| REG-011 | 关闭 overlay 不恢复焦点                    | 未捕获 opener                                     | 统一 opener capture/restore                                                               |
| REG-012 | 移动端 operation center 不可达             | 面板宽度和滚动边界错误                            | 390/360 专项布局和测试                                                                    |
| REG-013 | WARNING 解析残留 `ING]`                    | 日志前缀部分截断                                  | 完整 normalize WARNING/WARN 前缀                                                          |
| REG-014 | Harbor URL 带路径后请求错误                | 允许任意 base path 后再拼官方路径                 | 只允许实例根地址                                                                          |
| REG-015 | comment 等字段超过 Harbor 限制             | 前端和后端未按字段规范执行长度限制                | 提交前和网关使用同一字段边界及 Unicode 字符计数，保留上游错误                             |
| REG-016 | 受限用户统计泄露或不一致                   | 使用管理员范围或全局统计                          | 基于 active account 可见资源派生                                                          |
| REG-017 | 前端关键缺陷无测试                         | 早期只有少量静态合同                              | 当前扩展到 20 条合同测试和 44 个文件中的 153 条组件测试，并增加 1,128 项生产跨浏览器 Gate |
| REG-018 | CI 和基础镜像引用可漂移                    | 使用 tag 而非不可变引用                           | Actions 完整 SHA、image digest、Dependabot 更新                                           |

## 6. 2026-07-31：已提交功能补全历史

### `e75001f` test: align metadata compatibility validation

- 调整 metadata compatibility 校验测试，使其与实际兼容行为一致。
- 这是生产结构重构前的最后一个已提交 Commit。

### `24166df` docs: decide Harbor native authentication architecture

- 接受 Basic Auth / CLI Secret 多实例连接模型。
- 明确 native Harbor OIDC login、self-registration 和 Harbor session-cookie proxy 未实现。
- 未来认证方案需要独立架构决策、IdP 注册信息和真实 Harbor 验收。

### `a59d797` feat: map remaining Harbor API operations

- 补齐当时全量 parity 目标中的剩余 operation 映射和 demo 行为。
- 当时目标包含 deprecated operation；当前生产设计已收敛为 198 个稳定 operation，不能照搬旧 203 目标。

### `5b00bad` fix: complete dynamic English localization

- 修复 `Users are managed by OIDC`、Policy ID 升降序、Oldest updated 等动态英文残留。
- 新增 i18n completeness 回归测试。

### `41d5118` fix: generate type-aware artifact pull commands

- IMAGE tag/digest 继续生成 Docker/Podman/nerdctl pull。
- CHART tag 使用 `helm pull oci://... --version ...`。
- 所有消费者传递结构化 Artifact 类型，避免仅靠字符串猜类型。

### `7f2a199` feat: show artifact icons signatures and annotations

- 增加 icon API 映射、签名三态和 annotation 展示。
- 只允许安全 raster MIME，禁止 SVG/HTML。
- 当前工作区后来选择列表不拉取 Harbor 装饰图标，以减少额外请求和不稳定装饰；签名和 annotation 行为仍保留回归合同。

### `18b2767` feat: complete project trust and proxy settings

- 增加 Notary/Cosign 独立设置。
- 完善 Proxy Cache 带宽、连接数和 registry 条件编辑。
- 更新时保留未知 metadata，普通项目不发送 proxy-only 字段。

### `8a57668` feat: add project audit workflow

- 增加项目级 audit 页面和权限门控。
- 当前设计只使用稳定 extended audit endpoint，不再保留 legacy `/logs` fallback。

### `0259c88` feat: add project member directory search

- 普通用户使用 `/users/search`。
- 非 LDAP 用户组使用 `/usergroups/search`，避免项目管理员错误调用系统管理员列表。
- 加入 debounce、旧响应抑制和已有成员过滤。

### `20a8619` fix: preserve Harbor retention rule semantics

- 修复编辑 Retention/Immutable 规则时 include/exclude decoration 和 `extras.untagged` 丢失。
- 读取 metadata 驱动 selector 能力。
- 以 existing rule 为基底更新，保留未知字段。
- 这是 P0 级数据语义问题，后续任何表单更新都必须遵循无损 round-trip。

### `3259022` test: lock Harbor 2.15.2 API coverage

- 增加 operation fixture 和 API 覆盖测试。
- 当时锁定 203 operation；当前生产 fixture 已迁移为 198 个非废弃 operation。

## 7. 2026-07-31：初始基线

### `20d2df2` chore: establish Harbor Console baseline

- 建立首个可运行 Harbor Console 基线，共约 29,710 行。
- 包含单二进制、嵌入式前端、配置、日志、demo、类型化网关、基础测试、Docker 和旧 docs。
- 初始 parity 审计结果为 181/203 operations，约 89.2%。
- 初始已确认缺口包括 Retention 无损编辑、认证差异、项目审计、成员搜索、内容信任、Proxy Cache、Artifact 元数据、Helm 命令和英文动态文本。

该 Commit 是历史起点，不代表当前目录结构、API 范围或 UI 规范。

## 8. 范围外与交付说明

- 真实 Harbor 的匿名目录、项目、用户/成员/组、Label、Webhook、Immutable、Retention、系统 Robot、Artifact Tag/Label、配额、系统配置、Registry、Replication、Scanner、P2P、长值边界、恢复和清理均已复验通过。
- 生产目录重构、React 全量迁移和 UI 加固均包含在当前迁移提交中。
- Container runtime smoke test 已使用 Docker/Colima 执行并通过。
- Native OIDC login 仍为 NOT IMPLEMENTED，且不在当前 React 迁移实施范围内。
- Chromium、Firefox 和 WebKit 的中英文桌面/移动端独立跨浏览器回归已通过；未直接驱动 macOS Safari 应用。

## 9. 后续变更记录模板

```markdown
## YYYY-MM-DD：变更标题

状态：已提交 `<hash>` / 当前未提交工作区 / 已发布 `<version>`。

### 变更

- 用户可见行为。
- 代码和架构范围。

### 原因

- 原问题、复现条件和根因。

### 防复发

- 新增或更新的测试。
- 设计或实施约束。
- 浏览器和真实 Harbor 验收结果。

### 剩余风险

- 未运行项、阻塞项和显式例外。
```
