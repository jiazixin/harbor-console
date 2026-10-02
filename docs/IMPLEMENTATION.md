# 开发与验证

维护基线：2026-10-02。系统边界见 [DESIGN.md](DESIGN.md)，共享控件与动画见 [UI.md](UI.md)。

## 本地开发

运行环境版本以 `go.mod` 和 `web/package.json` 为准；Node 支持 22.22.2+（22 系列）、24.15.0+（24 系列）或 26+，CI 使用 22.22.2。首次安装依赖：

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
| 请求与数据类型 | `web/src/app/api-client.ts`、`models.ts`；匹配 method/path/query/body |
| 页面与业务交互 | `web/src/features/<domain>`；保留取消请求、权限、错误和权威回读 |
| 通用控件 | `web/src/components`；跨页面复用，测试用户可观察行为 |
| 全局导航与搜索 | `web/src/layouts`；注意焦点恢复与实例隔离 |
| 颜色/尺寸/圆角 | `styles/styles.css` 与对应共享 CSS；暗色 token 在 `workspace.css` |
| 动画 | CSS 在 `motion-system.css`；结构切换使用 `ContentTransition` |
| 语言 | `locale-context.tsx`；渲染时翻译，不改用户输入、资源名或日志 |

不要新增兼容运行时、DOM 字符串渲染器、未使用字段或页面专用基础控件。不要用全量 query / 请求版本作为动画容器 key。已有工作区修改必须保留；生成目录只能由构建重建。

业务专用组件和 CSS 位于 `web/src/features/<domain>/`；`web/src/styles/` 仅保留全局与跨域样式。`main.tsx` 显式加载这些文件，以保留现有样式阶段的覆盖顺序；不要因整理导入而按字母排序。共享与业务域中同名的 CSS 分别拥有不同规则，没有内容副本。页面共用的状态、执行详情等规则仍在共享样式中。

CI/CD 在 `.github/workflows/ci.yml` 中直接编排检查、测试和构建；容器构建使用 `Dockerfile`。两者都先生成 Web 资源，再执行 Go 编译。

## 检查命令

### 命名与可维护性

- TypeScript 的变量和函数使用 `camelCase`，组件和类型使用 `PascalCase`；Go 保持标准格式和首字母控制可见性的约定。API 请求字段按上游协议保留原名。
- 业务名称说明对象与用途：例如 `activeDialog`、`logContent`、`currentRequestVersion`、`loadProjectMembers`。跨多个步骤使用的值避免只叫 `data`、`value`、`current`；短小的通用转换函数可以使用 `value`。
- 保留语义明确的生态缩写，例如 Go 的 `ctx`、`err`、HTTP 处理器的 `w`/`r`，翻译函数 `t`、泛型 `T`/`K`/`V`。不以字数代替语义审查。前端生产代码通过 ESLint `id-length` 阻止新增无约定的单字符名称，外部对象属性不受该规则约束。
- 一个函数承担一个可以清楚命名的职责。请求编排、数据转换、表单状态与界面分区分别组织；React Hook 使用 `use` 前缀，领域专属逻辑留在领域目录。不要为了减少行数创建无实际边界的包装函数。
- 分支优先使用提前返回、明确的 `switch` 或命名函数；ESLint 将语句块嵌套限制为五层。函数和文件长度作为人工审查信号，不把大段声明式 JSX、类型定义和翻译数据一律判为复杂逻辑。
- 提取异步逻辑时保留并发、取消、权限、部分失败展示与刷新行为；用原有交互测试和针对性回归测试确认，不能仅以类型检查通过作为行为一致的证据。

### 本地命令

```bash
npm --prefix web run check
npm --prefix web run build
npm --prefix web test
node scripts/check-whitespace.mjs
node scripts/check-deployment-pins.mjs
go mod tidy -diff
go vet ./cmd/... ./internal/... ./web
go test -race ./cmd/... ./internal/... ./web -count=1
npm --prefix web run test:browser
npm --prefix web run audit
```

首次运行浏览器测试需要安装对应引擎：

```bash
(cd web && npx playwright install chromium firefox webkit)
```

浏览器测试由 `web/playwright.config.mts` 启动独立 Go 服务，默认端口 18484、三个 worker，不自动复用端口上的旧服务；它读取嵌入的生产资源，执行浏览器测试前须先运行 `npm --prefix web run build` 生成嵌入资源。可通过 `HARBOR_E2E_BASE_URL` 显式指向指定运行实例，通过 `HARBOR_E2E_PORT` 更换自动启动端口。

- `route-matrix.spec.ts`：三引擎、中英文、四种视口的路由、局部滚动、列对齐、下拉位置与搜索。
- `interaction-quality.spec.ts`：键盘焦点、portal 菜单、刷新生命周期、内容动画、减少动态效果与暗色小屏弹窗。
- Playwright 失败截图与 trace 位于`web/test-results/`；不可把测试产物复制进嵌入资产目录。

检查失败应修复根因：例如英文 badge 超宽应扩大对应列宽，不能放宽所有溢出断言或缩小文字。更新视觉合同是因为设计基线改变，不应删除行为断言来掩盖回归。

## 构建与发布

```bash
npm --prefix web run build
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -o bin/harbor-console ./cmd/harbor-console
npm --prefix web run audit
GOTOOLCHAIN="go$(sed -n 's/^go //p' go.mod)" go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 ./cmd/... ./internal/... ./web

# 可选覆盖率报告
mkdir -p coverage
go test ./cmd/... ./internal/... ./web -coverprofile=coverage/go.out -count=1
go tool cover -func=coverage/go.out
```

Go embed 在编译时读取资产；构建前端后需要重启/重编译 Go 服务才能看到新的生产界面。不要手动编辑 hashed bundle、index 中的 hash 或 embed 目录。

Docker 和 CI 定义分别位于 `Dockerfile` 与 `.github/workflows`。真实 Harbor 写入验证要求明确的实例与账号授权、操作前记录原值、写后回读及清理；不能用 demo 测试替代。

## 文档维护

当前文档只描述仍适用的规则与已验证事实。重要改变记录在 `CHANGELOG.md`；本次测试证据和限制记录在 `ACCEPTANCE.md`。历史记录进入 archive，不携带暂停指令、旧测试数字或过期环境结论到当前文档。
