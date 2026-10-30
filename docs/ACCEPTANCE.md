# 规范对齐验收记录

日期：2026-10-31。范围：`cmd/`、`internal/`、`web/` 的源码与测试，以及配置、构建、CI/CD 和当前维护文档。依据为根目录的目录、通用代码、Go、Web、React 规范。工作区原有的规范迁移继续保留，本轮补齐实现并统一验证；没有重置原有改动，也没有为实现降低规范要求。

## 对齐结果

- Go：命令行与配置边界、结构化日志、统一错误响应、严格 JSON 对象解码、UTC 毫秒时间、可取消的有界请求、会话摘要与秘密输出屏蔽、禁止认证重定向、进程内有界幂等缓存。
- Web / React：应用状态 Context、TanStack Query 查询与写入、领域 key 工厂、取消和查询失效、局部失败展示、字段错误反馈、领域公开入口、主组件拆分、外部 JSON 校验。
- 样式：51 个 CSS Modules；全局仅保留 token、元素基础规则和关键帧。类型文件可重新生成，级联层与跨组件选择器显式声明。人工扫描的 250 个跨模块选择器引用均能解析到对应模块；作用域名在不同系统路径分隔符下保持一致。
- 未发布 API 已直接更新，两端及契约同步；旧控制台路径没有保留别名。Harbor 原始资源协议按上游契约转发，其边界见 [技术决定](decisions/2026-10-31-console-boundaries.md)。
- 沿用既有模块的 kebab-case 文件名和当前 Prettier 风格，符合通用规范第 2 节；已有 `internal/app` 继续使用 JSON v1，新建时间模块的 JSON 测试使用 JSON v2。没有新增长期代码例外。

重点回归覆盖认证重定向、超大请求尾部、幂等并发与容量、注销后重放、实例切换、会话到期、请求并发上限、JSON 对象限制、构建时间精度、表单 400 字段错误、敏感 URL、日志加载取消、Firefox 严格 CSP 以及 CSS 动画作用域。

## 实际验证

本机工具：Go 1.27.3、Node 26.13.0、npm 11.20.0、Docker Server 29.5.2；GoReleaser 通过固定版本 v2.18.3 执行。完整可复现命令见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

| 检查 | 结果与命令 |
| --- | --- |
| Web 格式 | `npm --prefix web run format:check`、`web/node_modules/.bin/prettier --check scripts` 通过 |
| Web 静态与类型 | `npm --prefix web run lint`、`npm --prefix web run typecheck` 通过；没有 lint 警告 |
| Web 测试 | `npm --prefix web test`：64 个文件、276 项通过 |
| Web 构建 | `npm --prefix web run build` 通过，内嵌资源由构建生成 |
| CSS 类型、空白和版本固定 | `node scripts/generate-css-types.mjs --check`、`node scripts/check-whitespace.mjs`、`node scripts/check-deployment-pins.mjs` 通过 |
| Go 模块与格式 | `go mod verify`、`go mod tidy -diff`、全部受控 Go 文件的 gofmt / goimports v0.50.0 检查通过 |
| Go 静态分析 | `go vet ./...` 覆盖 linux / darwin / windows × amd64 / arm64；`go vet -tags integration,scale ./...`、staticcheck v0.8.2 通过 |
| Go 竞态 | `CGO_ENABLED=1 go test -race -count=1 ./...` 通过 |
| Go 集成 | `go test -tags integration,scale -count=1 ./...` 通过，含独立进程的 CLI 配置与版本测试 |
| Go 模糊测试 | `FuzzDecodeJSON`、`FuzzHarborURL`、`FuzzTimeRoundTrip` 各运行至少 3 秒通过；固定语料存放在 `testdata/fuzz/` |
| 生产依赖漏洞 | `npm --prefix web audit --audit-level=high --omit=dev`：0 漏洞；govulncheck v1.9.0：未发现漏洞 |
| 浏览器 | `npm --prefix web run test:e2e`：Chromium / Firefox / WebKit 共 50 项通过、4 项预期跳过；跳过项是仅配置在 Chromium 运行的两种主题 axe 检查在另两个引擎中的占位，不是因失败跳过 |
| 布局与交互 | 中英文、1440×900 / 1280×800 / 390×844 / 360×800、200% 有效缩放、深色、减少动画、列对齐、下拉菜单、焦点与刷新检查通过；另人工查看桌面概览与手机项目页截图 |
| 全新目录重建 | 无 `.git` 的系统临时副本中重新 `npm ci --ignore-scripts`、Web build、`go test ./...` 和 Go build；二进制报告 `dev`，健康、首页、信息接口及退出检查通过 |
| 容器 | `docker build` 通过；以 `nonroot:nonroot` 启动，健康接口及首页正常，终止后退出码 0 |
| 发布产物 | `goreleaser check`、`goreleaser release --snapshot --clean` 通过，生成六平台归档及 SHA-256；校验和检查及本机 darwin/arm64 二进制的版本 / 提交校验通过 |

快照预演在提交前执行，版本中带 `+dirty` 是当时工作区状态的真实记录；它不是已发布版本。生成的快照、镜像、截图、日志与临时工作目录没有作为源码提交。

## 验证边界

- 本轮没有连接或写入真实 Harbor；浏览器使用内存演示数据，网关行为由合成 HTTP 服务和测试数据验证。真实扫描器、外部复制、Webhook、P2P 预热和不同权限账号仍需要指定环境的集成验收，不能用 demo 结果声称这些外部链路已经通过。
- 本机实际运行 macOS arm64 和容器内 Linux；其他目标执行交叉 vet 与编译，没有声称在全部操作系统 / CPU 上运行过二进制。
- GitHub Actions 配置已更新并完成本地对应检查；此次只提交，不推送、不触发远端 CI，也不发布版本。CI 的 Node 24.22.1 环境由远端运行另行验证。
- 静态检查、测试和人工审查是本次对齐结论的依据，不构成对所有未来输入、外部版本与部署环境的无缺陷证明。
