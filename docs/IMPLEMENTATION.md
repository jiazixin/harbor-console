# 开发与验证

维护基线：2026-10-31。系统边界见 [DESIGN.md](DESIGN.md)，共享控件与动画见 [UI.md](UI.md)。

## 本地开发

运行环境版本以 `go.mod` 和 `web/package.json` 为准；Node 支持 22.23.4+（22 系列）、24.22.1+（24 系列）或 26.12.1+，CI 使用 24.22.1。首次安装依赖：

```bash
go mod download
npm --prefix web ci --ignore-scripts
```

在两个终端分别运行：

```bash
npm --prefix web run build
go run ./cmd/harbor-console
```

```bash
npm --prefix web run dev
```

Go 默认 `http://127.0.0.1:8080`，Vite 默认 `http://127.0.0.1:5173`；后端地址变化时通过 `HARBOR_BACKEND_URL` 配置开发代理。浏览器使用 Vite 地址，API 经同源代理访问 Go。

## 修改位置与规则

| 改动 | 位置与验证重点 |
| --- | --- |
| 新 Harbor API | `internal/app/harbor_operations.go` 及 operation/resource 映射、校验与合同 fixture |
| 请求与数据类型 | 唯一请求包装 `web/src/app/api-client.ts` 的 `api<T>`（`ApiError`、60 s 超时、`network_unavailable` / `timeout`）与 `models.ts`；用户文案只经 `web/src/app/errors.ts` 的 `errorText` 获取 |
| 服务端数据 | TanStack Query：`app/query-client.ts`（重试规则）、`app/use-loaded-query.ts`（页面加载契约）；query key 由各域的 `*-keys.ts` 定义 |
| 路由 | React Router hash 路由：路由表 `app/console-routes.tsx`（`consoleRoutes`，页面懒加载），入口 `app/router.tsx`；页面通过 `app/console-route.ts` 的 `ConsoleRoute` 读取路径段与查询参数 |
| 页面与业务交互 | `web/src/features/<domain>`；保留取消请求、权限、错误和权威回读 |
| 通用控件 | `web/src/components`；跨页面复用，测试用户可观察行为 |
| 全局导航与搜索 | `web/src/layouts`；注意焦点恢复与实例隔离 |
| 颜色/尺寸/圆角 | 设计 token（含暗色）在 `web/src/styles/tokens.css`；全局元素规则在 `base.css`，控件规则在 `components/` 的 CSS Modules |
| 动画 | CSS 在 `web/src/styles/motion.css`；结构切换使用 `ContentTransition` |
| 语言 | 界面词典与带参模板在 `web/src/app/locale-messages.ts`，模板引擎在 `message-templates.ts`；服务端只返回错误码，中英文错误文案在 `web/src/app/api-errors.ts`，契约见 [API.md](API.md)；渲染时翻译，不改用户输入、资源名或日志 |
| 应用级弹窗 | 类型与 `DialogControls` 在 `web/src/app/application-dialogs.ts`；按领域分为 `project-dialog-routes.tsx`、`resource-dialog-routes.tsx`；完成后统一调用 `complete(message, { reload, refreshConsole, navigateTo })` |

不要新增兼容运行时、DOM 字符串渲染器、未使用字段或页面专用基础控件。不要用全量 query / 请求版本作为动画容器 key。已有工作区修改必须保留；生成目录只能由构建重建。

业务专用组件和样式位于 `web/src/features/<domain>/`；独立主组件分文件，私有样式与组件同目录。跨域通过各域的 `public.ts` 协作。CSS Modules 使用 camelCase 类名，类型文件由 `node scripts/generate-css-types.mjs` 生成。`styles/` 只放设计变量、元素基础样式和关键帧，在入口导入一次。跨组件选择器引用显式的作用域类名，动画引用使用 `global(motion-content-in)` 等形式。级联顺序在 tokens.css 中声明；不要靠导入先后覆盖。

CI/CD 在 `.github/workflows/ci.yml` 中直接编排检查、测试和构建，tag 发布在 `.github/workflows/release.yml`；容器构建使用 `Dockerfile`，多目标发布使用 `.goreleaser.yaml`。它们都先生成 Web 资源，再执行 Go 编译。

## 检查命令

### 命名与可维护性

- TypeScript 的变量和函数使用 `camelCase`，组件和类型使用 `PascalCase`；Go 保持标准格式和首字母控制可见性的约定。API 请求字段按上游协议保留原名。
- 业务名称说明对象与用途：例如 `activeDialog`、`logContent`、`currentRequestVersion`、`loadProjectMembers`。跨多个步骤使用的值避免只叫 `data`、`value`、`current`；短小的通用转换函数可以使用 `value`。
- 保留语义明确的生态缩写，例如 Go 的 `ctx`、`err`、HTTP 处理器的 `w`/`r`，翻译函数 `t`、泛型 `T`/`K`/`V`。不以字数代替语义审查。前端生产代码通过 ESLint `id-length` 阻止新增无约定的单字符名称，外部对象属性不受该规则约束。
- 一个函数承担一个可以清楚命名的职责。请求编排、数据转换、表单状态与界面分区分别组织；React Hook 使用 `use` 前缀，领域专属逻辑留在领域目录。不要为了减少行数创建无实际边界的包装函数。
- 分支优先使用提前返回、明确的 `switch` 或命名函数；ESLint 将语句块嵌套限制为三层。函数和文件长度作为人工审查信号，不把大段声明式 JSX、类型定义和翻译数据一律判为复杂逻辑。
- 提取异步逻辑时保留并发、取消、权限、部分失败展示与刷新行为；用原有交互测试和针对性回归测试确认，不能仅以类型检查通过作为行为一致的证据。
- 页面按“数据 Hook（`use*Data`、`use*History`）+ 展示组件 + 组合页面”拆分：路由解析放在 `*-routing.ts`，查询 hook 放在业务域内；复用的请求编排放在 `*-data.ts`，表格、筛选栏和批量工具栏是独立组件，页面函数只负责组合。
- 读取服务端数据使用 `useLoadedQuery`（或 `useQuery`），不在组件里写 `useEffect + fetch + useState`；`reload` 会取消进行中的请求再重新获取。
- 写操作使用 `app/use-control-mutation.ts` 的 `useControlMutation(affectedQueries)`（基于 `useMutation`），成功后按 key 前缀失效受影响的查询；模块级辅助函数接收调用方传入的 `mutate`，不直接调用 `controlApi.mutate`。
- 组件测试用 `src/test/user.ts` 的 `setupUser` / `replaceText`（user-event）模拟操作；只有 user-event 无法产生的事件（滚动、页面卸载、原生取色器）才用 `fireEvent`，并注明原因。
- 并行请求必须一起进入同一个 `Promise.all` / `Promise.allSettled`；不要先发起多个请求、再单独 `await` 其中一个，否则导航取消时其余请求会产生未处理的拒绝。
- 由路由或父组件提供初值、又允许用户编辑的草稿（搜索框、筛选表单）使用 `lib/state/use-resettable-state.ts`。它在渲染期间重置，不要再写 `useEffect(() => setDraft(prop), [prop])`，那会覆盖挂载后立即输入的内容。
- 执行详情弹窗分别复用 `components/` 内的 `ExecutionSummary`、`ExecutionSection` 与 `DialogLoading`；任务日志复用 `components/task-log-panel.tsx`。
- 用户可见的中文文本都必须能翻译：固定文本加入 `englishMessages`，含名称或数量的文本加入 `englishTemplates`（`%s` / `%d`）。只在中文分支 `locale === "en-US" ? … : …` 内的文本除外。`tests/locale-contract.test.mjs` 会用同一套翻译器检查全部源码。

### 本地命令

默认 Web 测试只依赖源码，必须能在没有 `web/dist` 的干净检出中运行。生成资源是否混入源码、CommonJS 或 sourcemap，由构建后的 `go test ./web` 检查实际嵌入文件；该测试已包含在 `go test ./...` 中。

```bash
npm --prefix web run format:check
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
node scripts/check-whitespace.mjs
node scripts/check-deployment-pins.mjs
node scripts/generate-css-types.mjs --check
web/node_modules/.bin/prettier --check scripts
go mod verify
go mod tidy -diff
test -z "$(gofmt -l $(git ls-files '*.go'))"
test -z "$(go run golang.org/x/tools/cmd/goimports@v0.50.0 -local harbor-console -l $(git ls-files '*.go'))"
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
  GOOS=${target%/*} GOARCH=${target#*/} go vet ./...
done
go vet -tags integration,scale ./...
go run honnef.co/go/tools/cmd/staticcheck@v0.8.2 ./...
CGO_ENABLED=1 go test -race -count=1 ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...
go test -tags integration,scale -count=1 ./...
npm --prefix web run test:e2e
npm --prefix web audit --audit-level=high --omit=dev
```

首次运行浏览器测试需要安装对应引擎：

```bash
(cd web && npx playwright install chromium firefox webkit)
```

浏览器测试由 `web/playwright.config.mts` 启动独立 Go 服务，默认端口 18484、三个 worker，不自动复用端口上的旧服务；它读取嵌入的生产资源，执行浏览器测试前须先运行 `npm --prefix web run build` 生成嵌入资源。可通过 `HARBOR_E2E_BASE_URL` 显式指向指定运行实例，通过 `HARBOR_E2E_PORT` 更换自动启动端口。

- `route-matrix.spec.ts`：三引擎、中英文、四种视口的路由、局部滚动、列对齐（每个表格的表头与单元格 `text-align` 一致）、下拉位置与搜索。
- `accessibility.spec.ts`：Chromium 中对浅色与深色主题的关键路由运行 `@axe-core/playwright`，不允许 serious / critical 问题。
- `interaction-quality.spec.ts`：键盘焦点、portal 菜单、刷新生命周期、内容动画、减少动态效果与暗色小屏弹窗。
- Playwright 失败截图与 trace 位于`web/test-results/`；不可把测试产物复制进嵌入资产目录。

检查失败应修复根因：例如英文 badge 超宽应扩大对应列宽，不能放宽所有溢出断言或缩小文字。更新视觉合同是因为设计基线改变，不应删除行为断言来掩盖回归。

## 构建与发布

```bash
npm --prefix web run build
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -o bin/harbor-console ./cmd/harbor-console
npm --prefix web audit --audit-level=high --omit=dev
GOTOOLCHAIN="go$(sed -n 's/^go //p' go.mod)" go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...

# 可选覆盖率报告
mkdir -p coverage
go test ./... -coverprofile=coverage/go.out -count=1
go tool cover -func=coverage/go.out
```

Go embed 在编译时读取资产；构建前端后需要重启/重编译 Go 服务才能看到新的生产界面。不要手动编辑 hashed bundle、index 中的 hash 或 embed 目录。

Docker 和 CI 定义分别位于 `Dockerfile` 与 `.github/workflows`。

### 发布

发布 tag 采用 `v主版本.次版本.修订版本`（如 `v1.0.0`），预发布为 `v1.2.0-rc.1` 并自动标为 Pre-release；工作流只匹配这两种格式。推送 tag（`git tag v1.0.0 && git push github v1.0.0`）触发 `release.yml`：

1. 在不使用缓存的 runner 上执行模块、格式、imports、lint、类型、CSS 类型、静态分析、Web 构建与测试、六平台 vet、Go 竞态 / CLI 集成与漏洞检查；
2. `goreleaser build --single-target` 构建 linux/amd64，并用 `scripts/check-build-version.sh` 启动该二进制，核对 `service_starting` 日志中的 `version` 等于 tag、`revision` 等于当前提交的 12 位短 ID，不一致即中止；
3. GoReleaser v2.18.3 按 `.goreleaser.yaml` 以 `CGO_ENABLED=0 -trimpath -ldflags='-s -w'` 构建（不注入版本，Go 从 git 嵌入 tag、提交与提交时间） linux / darwin / windows 的 amd64 与 arm64，上传 GitHub Release。

产物为 `harbor-console_<版本>_<系统>_<架构>.tar.gz`（Windows 为 `.zip`，均含二进制、`LICENSE`、两份 README 与 `configs/config.example.yaml`）及 `checksums.txt`（SHA-256）。“关于”页面的 `build_date` 取提交时间以保证可复现；CI 只实际运行 linux/amd64 二进制，其余目标仅交叉编译与交叉 vet。

CI 的 `release-snapshot` 任务对每次推送执行 `goreleaser check` 与 `goreleaser release --snapshot --clean`，并以同一脚本核对快照版本。本地预演（不发布，输出在忽略的 `bin/release/`）：

```bash
go install github.com/goreleaser/goreleaser/v2@v2.18.3
goreleaser check
goreleaser release --snapshot --clean
scripts/check-build-version.sh bin/release/harbor-console_darwin_arm64_v8.0/harbor-console "$(go version -m bin/release/harbor-console_darwin_arm64_v8.0/harbor-console | awk '$1 == "mod" { print $3 }')" "$(git rev-parse --short=12 HEAD)"
```

真实 Harbor 写入验证要求明确的实例与账号授权、操作前记录原值、写后回读及清理；不能用 demo 测试替代。

## 文档维护

当前文档只描述仍适用的规则与已验证事实。重要改变记录在 `CHANGELOG.md`；本次测试证据和限制记录在 `ACCEPTANCE.md`。历史记录进入 archive，不携带暂停指令、旧测试数字或过期环境结论到当前文档。
