# 变更记录

## 2026-10-22：代码质量清理与工具链升级（v1.0.1）

**工具链与漏洞**

- Go 由 1.27.2 升为 1.27.3；Docker builder 改用 `golang:1.27.3-alpine3.23` 并固定 Registry 返回的 digest。
- CI 与 Release 工作流的 Node.js 由 22.22.2 改为 24.22.1（Active LTS，含 2026-10-20 安全修复）；`engines` 最低版本提高到已修复安全问题的 22.23.4 / 24.22.1 / 26.12.1。
- CI 中的 govulncheck 由 v1.6.0 升为 v1.9.0。Actions 与 distroless 运行镜像已是最新固定版本，未改动。

**死代码与未使用项**

- Go：删除未调用的 `projectArtifactCount`、`sortDemoByID`；仅测试使用的 `newApp` 移入测试文件，`webui.ReadFile` 删除，测试改用 `webui.Files()`；演示网关 `handleControl` 删除未使用的 `list` 参数；只用于 GET 的 `harborJSON` 改名为 `harborGetJSON` 并去掉固定的 method 参数。
- Web：删除未使用的 `ApplicationDialogKind`、`parseAuditRoute`；两处重复的 `auditQueryValue` 合并到 `app/audit-log.ts`；约 45 个只在本文件使用的类型和常量取消导出。
- CSS：删除 27 个已无组件使用的类及其规则（旧操作中心、分页器、表格页脚等，约 370 行）和未使用的 `--motion-distance-small`；动态拼接的 `log-level-*`、`harbor-banner-*` 保留。

**可读性**

- 演示网关的大型分派函数（最长 447 行）按业务域拆分：保留策略、垃圾清理与审计清理、Job Service、安全中心、制品 Tag/标签、制品扫描、机器人、标签、项目设置、项目成员、仓库、预热策略、用户与用户组各自独立；case 内容未改动。`demoControlHandler` 的返回值改为具名并补充说明。
- 含义不清的局部变量改名：`data` → `loadedConsoleData`、`scanLog`、`addition`、`form`、`replicationData`，`info` → `adapterInfo`。
- 限流测试改为逐次断言，消除 staticcheck 对 `!allow() || !allow()` 的误报。

## 2026-10-19：开源发布准备

- 采用 Apache License 2.0，新增 `LICENSE`；中英文 README 改为开源项目结构（徽章、快速开始、部署、版本与发布、目录例外、贡献、许可证）。
- 参照 MirrorDock 新增 GoReleaser 发布：`.goreleaser.yaml` 构建 linux / darwin / windows 的 amd64 与 arm64，输出在忽略的 `bin/release/`；`release.yml` 在推送 `vX.Y.Z` tag 时先测试并核对内置版本，再发布 GitHub Release。
- CI 拆为 Web 与 Go 两个任务，固定到 checkout v7.0.1、setup-node v7.1.0、setup-go v7.0.0，运行于 `ubuntu-24.04` 且不保留 checkout 凭据；只在 `main` 推送和 Pull Request 时触发；增加 darwin / windows 交叉 vet 与 GoReleaser 快照构建。
- 新增 `scripts/check-build-version.sh`，启动二进制并核对 `server_started` 日志中的版本与提交。
- 首次在 GitHub Linux runner 运行浏览器矩阵：DejaVu Sans 下复制页英文表格溢出 1–5px。复制策略“方向”列 104→112px，执行记录“状态”列 112→120px、“任务统计”列 128→140px；断言未放宽。
- 修复浏览器测试偶发失败：对话框模块按需下载期间会先显示“正在打开对话框”占位对话框，`dark mobile` 用例的未命名 `getByRole("dialog")` 可能测量到即将被替换的占位元素而得到空的 `boundingBox`。改为按对话框名称定位。
- Dependabot 每个生态的 minor / patch 更新合并为一个分组 PR，major 单独提交，并限制同时打开的 PR 数量。
- Dependabot 忽略 `@types/node` 大版本更新：类型版本不应超过 `engines` 中最低支持的 Node.js 运行时。
- 合并 Dependabot npm 分组更新（react / @types/react 19.3、typescript-eslint 8.71、vite 8.3、Playwright 1.64 等 11 项）：表单提交处理改用 `SubmitEvent<HTMLFormElement>`（`FormEvent` 已废弃）；公开目录不再用 `void` 丢弃解构值；构建保留 `index.html` 入口的 modulepreload，不再为懒加载路由注入预加载链接。WebKit 会把加载完成 3 秒时仍无使用方的预加载报为警告，慢速 runner 上路由矩阵因此偶发失败（vite 8.2 下的 main 也出现过），断言未放宽。
- 移除 Dependabot（与 MirrorDock 一致）：删除 `.github/dependabot.yml`，`check-deployment-pins.mjs` 不再要求该文件；依赖改为手动升级，Actions 与基础镜像仍须固定 SHA / digest。
- 中文 README 改为主入口：`README.zh-CN.md` → `README.md`，英文版 `README.md` → `README.en.md`；同步语言切换链接、发布包文件、`AGENTS.md` 与文档索引，并在 README 目录例外中登记。

## 2026-10-19：1.0 上线前最终检查

**真实 Harbor 与兼容性**

- 以真实 Harbor v2.15.4 完成全域读写回归；固定的 198 个非废弃操作与 v2.15.4 一致，关于页目标版本改为 `v2.15.x`，README 与设计文档同步说明。
- 上游 412 与 5xx 错误给出明确中文说明；时间早于 1971 年的 Harbor 零值时间显示为“暂无”。
- Go 最低版本从 1.26.6 升为 1.26.9，修复 govulncheck 报告的 10 个可达标准库漏洞；随后统一升为 Go 1.27.2，Docker builder 同步改用 `golang:1.27.2-alpine3.23` 并固定 Registry 返回的 digest。开发依赖 `source-map-js` 高危通告已修复。

**界面统一**

- 样式重组为 `tokens / base / shell / page / controls / collections / feedback / dialogs / logs / motion` 与各业务域 `<domain>.css`，经计算样式快照比对确认无意外变化。
- 统一提示（`notice-info / warning / danger`）、区块标题与计数、空列表“共 0 项”、无权限错误页、按钮内加载指示和执行详情结构；Tag 保留、复制、Webhook、P2P 预热执行详情共用 `ExecutionSummary`，预热执行详情增加返回执行列表。
- 显示 Harbor 横幅公告；制品页只显示实际存在的附加信息页签，未扫描制品给出明确状态，过滤 attestation 附件。
- 浏览器矩阵逐路由检查每个表格的表头与单元格对齐方式。

**多语言**

- Go 服务端中文消息与前端全部可见文本都有英文翻译；新增 `%s` / `%d` 模板，名称和数量组成的提示也能翻译。错误视图与弹窗错误经翻译显示。
- 合同测试用与界面相同的翻译器扫描全部源码，未翻译文本无法合入。

**代码结构与缺陷修复**

- 拆分职责过多的页面与弹窗：仓库制品页、镜像仓库页、制品详情、项目列表/详情、复制管理、配置管理（认证 / 系统 / 安全）、Webhook 与预热执行历史、应用根组件、应用级弹窗、顶栏与账户弹窗。数据加载、路由解析与展示分开，弹窗完成后统一通过 `complete()` 关闭、提示、刷新与跳转。
- 新增 `useResettableState`，修复筛选草稿在挂载后立即输入时被延迟同步覆盖的问题。
- 修复仓库制品页取消导航后的未处理 Promise 拒绝；合并三份重复的 CVE 白名单解析与到期日期逻辑，以及两份可停止扫描状态判断。
- 共享 `useTaskLog` / `TaskLogPanel`，各类任务日志的取消、刷新、复制与下载行为一致。

## 2026-10-02：上线前检查与修复

- 会话请求增加取消与所有权校验，避免退出、切换实例、StrictMode 和旧回调回写过期数据；密码/CLI Secret 更新绑定原连接。
- 修复非法或不可用浏览器存储造成的启动异常、UTC 偏好无效、未知路由加载不结束和下拉禁用项键盘焦点。
- 修复项目表在窄视口下名称和可见性列重叠，以及扫描器页刷新重复请求；增加中英文 720×450 和名称列逐行几何回归。
- 页面与弹窗按需加载，Vite 让动态导入决定分包，保留 CSS 显式加载顺序；增加模块加载失败、弹窗焦点和关闭回归。
- 后端退出等待在途请求排空，全部 API 的上游阶段共享时间预算并响应取消；清理失败和替换连接的闲置 HTTP 资源。CVE Allowlist 写入获成功响应而回读失败时，明确提示最终状态未确认，避免直接重复提交。
- 收紧路径、分页、整数及身份写入请求校验，数字项目名正确标识为名称，演示实例删除后可重新添加。
- 带哈希的静态资源使用 immutable 缓存，HTML 要求重新验证；离线合同检查完整静态/动态资源图及缺失、外部和孤立资源。
- 修复两项 npm 高危传递依赖，声明真实 Node 兼容范围并同步 CI；浏览器测试使用独立服务及固定 worker，覆盖启动阶段错误，容器构建日期使用实际时间。
- 将旧验收及已完成计划归档，双语 README 的发布状态指向本轮证据。完整结果和未验证边界见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 2026-09-20：可读性与维护边界

- 应用入口分离会话生命周期和弹窗编排，领域弹窗宿主回归所属业务目录；应用级状态与日志变量使用明确名称。
- 项目详情分离路由规则与各页签加载函数，保留权限、并发请求、取消及部分失败展示。
- 复制策略分离表单状态、适配器能力查询和三块表单界面，保持提交协议与界面行为。
- 演示网关分离复制、仓库和审计处理，复用审计字段过滤；新增回归测试和前端命名/嵌套检查。验证详情见 ACCEPTANCE。

## 2026-09-19：构建与检查直接由 CI/CD 编排

- 删除根构建任务文件和编辑器专用规则，目录规范不再要求统一任务包装层。
- CI/CD 与 Docker 直接执行 Go、npm 命令，保留质量检查、安全扫描、浏览器测试及版本元数据注入。
- 同步双语 README 与开发命令；历史记录中的旧任务调用改为检查项目名称，原验收日期及结果保持不变。

## 2026-09-17：完整执行新版内部目录规范

- 当时补齐依赖安装和开发入口，默认测试包含 Go 与 Web。
- 按实际业务归属拆分样式，将专用规则移入 features；保留共享规则、选择器和声明，显式维护加载阶段。
- 项目专用 DialogPagination 与单元测试归属 projects，样式合同读取新位置并覆盖全部业务域 CSS。
- 新增 AGENTS.md 作为 AI 读取目录规范的入口；补全运行数据和缓存忽略规则，更新双语 README、开发与架构说明。
- 完整质量门、干净副本安装/并行检查/默认测试、42 项三浏览器回归及启动/清理验证通过；Docker 环境不可用的限制见验收记录。


## 2026-09-17：按目录规范统一 web 应用边界

- `frontend/` 更名为 `web/`，根目录 npm 清单、锁文件和 ESLint 配置移入 web；依赖版本不变。
- Go 嵌入入口迁入 `web/embed.go`，Vite 唯一输出为被忽略的 `web/dist/`，删除旧已跟踪生成资源。
- 构建流程、CI、Docker、Dependabot、Go import、测试路径、开发环境查找目录同步调整；所有依赖资源的操作显式先构建 web。
- 仓库检查脚本从自身位置解析根目录，Playwright 输出归入 `web/test-results/`，本地配置与测试产物不进入 Git/容器上下文。
- 默认配置统一为 configs/config.local.yaml，不保留根目录 config.yaml 自动查找；原 bin 下本地配置移入 configs，补充路径和优先级回归测试；clean 只删除指定二进制。
- 更新双语 README、开发/架构文档和迁移验收；归档文档保留历史布局。


## 2026-09-12：整体检查与 UI 改进（当前工作区）

### 视觉与控件

- 保留橙色品牌，统一冷灰背景、文字对比度、暗色表面、6/10/12px 圆角和面板/弹层阴影。
- 将分散的 9–10px 说明文字提高到 11px，统一紧凑工具栏、搜索、下拉和视图开关高度。英文复制状态列增加空间，保留列对齐和局部横向滚动。
- 修复引用未定义 token 的警告颜色、标签字体和次要文字；为代码背景明确提供 token，并增加未定义 token 检查。
- 区分“镜像仓库”和“远程仓库”导航、页面标题与浏览器标题。
- 禁用按钮不显示可点击的 hover 状态，危险操作有对应 hover，暗色主按钮保持可读文字，页码跳转保留键盘焦点。

### 动效与交互

- 精简 `motion-system.css`，删除旧 DOM 选择器、统计/列表/Banner 的重复入场和健康指示点持续闪动。非循环动效统一短缓出，加载指示器统一 900ms 匀速旋转。
- `ContentTransition` 统一项目、制品、安全、复制、管理与配置页签，以及仓库列表/卡片切换；mode 改变才淡入，不通过 React key 卸载已有状态。
- 刷新按钮用真实 `aria-busy` 控制旋转，保持路由容器；减少动态效果时跳过 CSS 和 Web Animations 动画，正在执行的内容动画也会取消。
- `useModal` 统一通用弹窗和全局搜索：焦点循环、背景焦点约束、关闭恢复、滚动锁及 portal 菜单处理。
- 修复键盘快速打开下拉的焦点时序、Tab 从 portal 返回错误位置，以及 WebKit 鼠标打开弹窗后的焦点恢复。
- 弹窗防重复提交，成功后仍挂载时正确解除 busy；失败可重试并通过 alert 宣告。弹窗使用动态视口高度，移除重复 toast region ID。

### 依赖与维护

- npm 锁文件将 Vitest 系列更新到 4.1.11、nanoid 更新到 3.3.19，解决审计发现的告警。
- Go 最低构建版本从 1.26.5 升为 1.26.6，以修复安全扫描发现的标准库漏洞；Docker builder 同步更新，并使用 Docker Registry 返回的 immutable digest。
- 新增弹窗与内容切换组件回归，以及三浏览器交互、暗色小屏、动效与刷新测试。浏览器套件每 worker 复用只读 demo 会话，避免扩展测试触发生产登录限流；测试之间仍隔离浏览器 context。
- 当前架构、开发、UI、验收文档重新整理；8 月原始修订完整保存在 archive，避免迁移限制和过期测试结论继续干扰维护。删除 docs 中的 `.DS_Store`。

验证结果与范围见 [ACCEPTANCE.md](ACCEPTANCE.md)。本记录描述本轮改进，提交与合并状态以 Git 历史为准，部署状态以实际环境为准。此前工作区中的功能修订一并保留。

## 历史

[2026 年 8 月变更、缺陷根因与验收证据](archive/2026-08/CHANGELOG.md)。
