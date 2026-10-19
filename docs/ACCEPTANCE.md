# 上线前验收记录

本轮日期：2026-10-19。验证对象为 `4714a6b` 之上的当前工作区（未提交）。计划见 [1.0 上线前最终检查](plans/2026-10-19-release-1.0-check.md)。

**发布结论：可发布 1.0，附 3 项部署前确认。** 本地质量检查、依赖与漏洞扫描、三引擎浏览器矩阵全部通过；真实 Harbor v2.15.4 上的主要读写流程已逐项回读验证。下文“发布剩余条件”中的项目未在本环境执行，不能视为已通过。

## 本轮结果

| 检查 | 结果 | 命令与证据范围 |
| --- | --- | --- |
| Web 格式、lint、类型 | PASS | `npm --prefix web run check` |
| Web 合同与组件 | PASS | `npm --prefix web test`；33 项合同，58 个文件 / 226 项组件测试 |
| Web 生产构建 | PASS | `npm --prefix web run build`；仅生成 `web/dist/` |
| Go 格式、模块、vet | PASS | gofmt；Go 1.27.2 下 `go mod tidy -diff`、`go vet ./cmd/... ./internal/... ./web` |
| Go 竞态测试 | PASS | Go 1.27.2 下 `go test -race ./cmd/... ./internal/... ./web -count=1` |
| Go 覆盖率 | 记录 | 本机 Go 1.27.2 下语句覆盖率 64.7%（`coverage/go.out`） |
| npm 漏洞审计 | PASS | `npm --prefix web run audit`；生产依赖 0 漏洞；开发依赖 `source-map-js` 的高危通告已通过 `npm audit fix` 更新锁文件消除 |
| Go 漏洞扫描 | PASS | 原 Go 1.26.6 有 10 个可达的标准库漏洞（net/http、crypto/tls、net/textproto，修复版本 1.26.9）；项目随后统一升为 Go 1.27.2，`GOTOOLCHAIN=go1.27.2 go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 ./cmd/... ./internal/... ./web` 未发现漏洞 |
| 部署固定版本 | PASS | `node scripts/check-deployment-pins.mjs`；Dockerfile 改用 `golang:1.27.2-alpine3.23`，digest 取自 Docker Registry 返回的 OCI index |
| 空白与差异检查 | PASS | `node scripts/check-whitespace.mjs`；`git diff --check` |
| Chromium / Firefox / WebKit | PASS | `npm --prefix web run test:browser`，48/48；最终源码连续两次运行。路由矩阵新增每个表格表头与单元格 `text-align` 一致的断言 |
| 真实 Harbor API 合同 | PASS | 真实 v2.15.4 swagger 与固定的 198 个非废弃操作逐项一致；仅多出已废弃的旧审计日志接口 |
| 真实 Harbor 读写流程 | PASS | 见下节；每次写入后经 Harbor API 回读确认 |
| Docker 构建与运行 | 未执行 | 本轮升级了 builder 镜像（Go 1.27.2）；本机 Docker 守护进程未运行，需在部署前重新构建并 smoke test |

本机 Web 验证使用 Node 26.12.0 / npm 11.20.0、Playwright 1.62.1。真实 Harbor 为用户专门提供的测试实例 `hba.jzxk.cc`（Harbor v2.15.4）。凭据只经脚本调用 `/api/connect`，未写入仓库或浏览器表单。

## 真实 Harbor 验证

通过控制台（生产构建的单二进制）执行，并用 Harbor API 回读：

- **用户、项目与成员：** 创建本地用户、带配额的项目；添加成员、修改角色、移除成员。
- **项目治理：** 机器人账号、Webhook、不可变 Tag 规则、项目标签、Tag 保留策略与演练执行。
- **制品：** 仓库与制品列表、添加/删除 Tag、绑定标签、跨项目复制、不可变 Tag 保护、批量操作。
- **复制与远端仓库：** 创建远端仓库、复制策略、手动执行与执行详情、镜像代理项目。
- **系统管理：** 全局标签、项目配额、系统机器人、垃圾清理与审计清理演练、配置修改后还原、Job Service。
- **安全与分发：** 扫描器注册失败提示、系统 CVE 白名单增删、无扫描器时的 CVE 导出提示、P2P 预热实例。
- **最终回归（中英文各一轮）：** 镜像仓库搜索与卡片/列表切换、制品筛选/选择/批量扫描、制品详情页签、系统/认证/安全/项目设置原样保存后 Harbor 状态不变、非法 CVE 校验、Webhook / 预热 / Tag 保留 / 复制执行详情、顶栏偏好与实例面板的焦点恢复。英文界面下动态提示（如 “Vulnerability scanning finished; 1 failed”）均已翻译，浏览器无未处理异常。

环境限制如实记录：该 Harbor 实例没有可用扫描器（扫描返回 412 “no available scanner”），且无法访问外部网络——复制拉取外部仓库返回 401、外部扫描器注册返回 500、Dragonfly 预热无法启动执行。因此真实的扫描结果、复制传输与预热执行链路未验证；控制台对这些失败的提示已验证正确。

## 修复与优化

改动明细见 [变更记录](CHANGELOG.md)。本轮在真实环境或测试中发现并修复的缺陷：

- 英文界面约 140 条提示、弹窗标题、校验信息和带名称/数量的动态提示仍显示中文；错误视图与弹窗错误未经翻译。现以统一翻译器（含 `%s`/`%d` 模板）处理，并由合同测试扫描全部源码防止回退。
- 筛选表单与搜索框在挂载后立即输入时，可能被延迟执行的同步 effect 清空（审计页测试偶发失败即此原因）；审计、安全、系统管理及项目成员/审计/预热共 7 个组件改用渲染期重置的 `useResettableState`，新拆分的 3 个筛选表单使用同一 Hook。
- 仓库制品页离开时，提前发起的请求在取消后产生未处理的 Promise 拒绝；改为所有请求进入同一个 `Promise.all`。
- P2P 预热任务类型列在英文界面未翻译；预热执行详情缺少返回执行列表的入口，现与 Webhook 一致。

## 发布剩余条件

1. 部署前用当前 Dockerfile（Go 1.27.2 builder）重新构建镜像，执行 health、静态资源、Cookie/Origin 与 SIGTERM smoke test。
2. 在能访问扫描器与外部仓库的目标环境，验证扫描、复制传输与 P2P 预热执行的真实链路，以及 HTTPS 反向代理与出站策略。
3. Node 22 最低版本运行、生产负载压测和浏览器原生缩放本轮未执行；原生 OIDC 登录与多副本共享会话不在实现范围。

测试过程在 Harbor 上留下以 `e2e-` 为前缀的项目、用户、机器人、标签、Webhook、远端仓库、复制策略与预热实例，以及 `public-tools/alpine-copy`。该实例为测试专用，可整体保留或按名称清理。

运行日志与截图位于会话临时目录，测试输出位于 `web/test-results/`，覆盖率位于 `coverage/go.out`。[历史归档](archive/README.md)仅供追溯。
