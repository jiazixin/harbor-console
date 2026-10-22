# 验收记录

本轮日期：2026-10-22。验证对象为 `0f5d191`（v1.0.0 之后）之上的代码质量清理与工具链升级，改动见 [变更记录](CHANGELOG.md)。上一轮 1.0 发布前的真实 Harbor 全域检查见 [2026-10-19 验收](archive/2026-10/ACCEPTANCE-2026-10-19.md)。

**结论：可发布 v1.0.1。** 本轮只删除死代码、调整命名与函数拆分、升级 Go / Node / govulncheck，不改变接口与界面行为；本地全部检查、三引擎浏览器矩阵与容器 smoke test 通过。

## 本轮结果

| 检查 | 结果 | 命令与证据范围 |
| --- | --- | --- |
| 死代码与未使用项 | PASS | `deadcode` 与 `deadcode -test`、`staticcheck -checks all`（除 ST1000/ST1003/ST1005）、`unparam` 均无输出；TypeScript 未使用导出扫描仅余供单元测试使用的纯函数；CSS 类扫描仅余动态拼接的 `log-level-*`、`harbor-banner-*` |
| Web 格式、lint、类型 | PASS | `npm --prefix web run check` |
| Web 合同与组件 | PASS | `npm --prefix web test`；33 项合同，58 个文件 / 226 项组件测试 |
| Web 生产构建 | PASS | `npm --prefix web run build` |
| Go 格式、模块、vet | PASS | Go 1.27.3 下 gofmt、`go mod verify`、`go mod tidy -diff`；`go vet` 覆盖本机及 linux/amd64、darwin/arm64、windows/amd64 |
| Go 竞态测试 | PASS | `go test -race ./cmd/... ./internal/... ./web -count=1` |
| Go 覆盖率 | 记录 | 语句覆盖率 65.4%（上轮 64.7%，差值来自删除的死代码） |
| npm 漏洞审计 | PASS | `npm --prefix web run audit`，0 漏洞 |
| Go 漏洞扫描 | PASS | `GOTOOLCHAIN=go1.27.3 go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./cmd/... ./internal/... ./web`，未发现漏洞 |
| 部署固定版本 | PASS | `node scripts/check-deployment-pins.mjs`；`golang:1.27.3-alpine3.23` 的 digest 取自 Docker Registry 返回的 OCI index；各 Action 与 distroless 镜像经查询已是最新版本 |
| 空白检查 | PASS | `node scripts/check-whitespace.mjs` |
| Chromium / Firefox / WebKit | PASS | `npm --prefix web run test:browser`，48/48；演示模式下逐路由访问，经过拆分后的演示网关 |
| Docker 构建与运行 | PASS | 本机 Colima 构建镜像，二进制为 go1.27.3；用户为 `nonroot:nonroot`，`/health` 与首页正常，`docker stop` 后退出码 0 |
| 构建版本核对 | PASS | `scripts/check-build-version.sh` 核对 `-ldflags` 注入的版本与提交 |

本机使用 Go 1.27.3、Node 26.12.0 / npm 11.20.0。CI 改用的 Node 24.22.1 由推送后的 GitHub Actions 运行验证。

## 未覆盖

1. 本轮未连接真实 Harbor：真实模式的改动仅为 `harborJSON` → `harborGetJSON` 改名（请求方法仍为 GET）和删除未调用的函数，由单元测试与 vet 覆盖。
2. GoReleaser 多目标快照构建由 CI 的 `release-snapshot` 任务与 tag 触发的 Release 工作流执行，本机未安装 GoReleaser。
3. 上轮记录的环境限制仍然有效：扫描、外部复制传输与 P2P 预热执行的真实链路需在可访问外网和扫描器的环境验证。
