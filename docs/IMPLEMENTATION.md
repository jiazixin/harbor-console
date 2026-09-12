# 开发与验证

维护基线：2026-09-12。系统边界见 [DESIGN.md](DESIGN.md)，共享控件与动画见 [UI.md](UI.md)。

## 本地开发

运行环境版本以 `go.mod` 和 `package.json` 为准。首次安装依赖：

```bash
npm ci --ignore-scripts
```

在两个终端分别运行：

```bash
go run ./cmd/harbor-console
```

```bash
npm run dev
```

Go 默认 `http://127.0.0.1:8080`，Vite 默认 `http://127.0.0.1:5173`；后端地址变化时通过 `HARBOR_BACKEND_URL` 配置开发代理。浏览器使用 Vite 地址，API 经同源代理访问 Go。

## 修改位置与规则

| 改动 | 位置与验证重点 |
| --- | --- |
| 新 Harbor API | `internal/app/harbor_operations.go` 及 operation/resource 映射、校验与合同 fixture |
| 请求与数据类型 | `frontend/src/app/api-client.ts`、`models.ts`；匹配 method/path/query/body |
| 页面与业务交互 | `frontend/src/features/<domain>`；保留取消请求、权限、错误和权威回读 |
| 通用控件 | `frontend/src/components`；跨页面复用，测试用户可观察行为 |
| 全局导航与搜索 | `frontend/src/layouts`；注意焦点恢复与实例隔离 |
| 颜色/尺寸/圆角 | `styles/styles.css` 与对应共享 CSS；暗色 token 在 `workspace.css` |
| 动画 | CSS 在 `motion-system.css`；结构切换使用 `ContentTransition` |
| 语言 | `locale-context.tsx`；渲染时翻译，不改用户输入、资源名或日志 |

不要新增兼容运行时、DOM 字符串渲染器、未使用字段或页面专用基础控件。不要用全量 query / 请求版本作为动画容器 key。已有工作区修改必须保留；生成目录只能由构建重建。

## 检查命令

```bash
npm run check          # Prettier、ESLint、TypeScript
npm test               # 架构/样式/i18n 合同 + React 组件测试
make check             # 完整 Go/前端质量门 + 生产构建
npm run test:browser -- --workers=3
npm run audit
```

首次运行浏览器测试需要安装对应引擎：

```bash
npx playwright install chromium firefox webkit
```

浏览器测试由 `frontend/playwright.config.mts` 启动 Go 服务，默认端口 18484；它读取嵌入的生产资源，测试前必须执行 `npm run build`。可通过 `HARBOR_E2E_BASE_URL` 指向指定运行实例，通过 `HARBOR_E2E_PORT` 更换自动启动端口。

- `route-matrix.spec.ts`：三引擎、中英文、四种视口的路由、局部滚动、列对齐、下拉位置与搜索。
- `interaction-quality.spec.ts`：键盘焦点、portal 菜单、刷新生命周期、内容动画、减少动态效果与暗色小屏弹窗。
- Playwright 失败截图与 trace 位于系统临时目录的 `harbor-console-playwright/`；不可把测试产物复制进嵌入资产目录。

检查失败应修复根因：例如英文 badge 超宽应扩大对应列宽，不能放宽所有溢出断言或缩小文字。更新视觉合同是因为设计基线改变，不应删除行为断言来掩盖回归。

## 构建与发布

```bash
npm run build          # 重建 internal/webui/assets
make build             # 先构建前端，再生成 bin/harbor-console
make security-check    # npm audit + Go govulncheck
```

Go embed 在编译时读取资产；构建前端后需要重启/重编译 Go 服务才能看到新的生产界面。不要手动编辑 hashed bundle、index 中的 hash 或 embed 目录。

Docker 和 CI 定义分别位于 `Dockerfile` 与 `.github/workflows`。真实 Harbor 写入验证要求明确的实例与账号授权、操作前记录原值、写后回读及清理；不能用 demo 测试替代。

## 文档维护

当前文档只描述仍适用的规则与已验证事实。重要改变记录在 `CHANGELOG.md`；本次测试证据和限制记录在 `ACCEPTANCE.md`。历史记录进入 archive，不携带暂停指令、旧测试数字或过期环境结论到当前文档。
