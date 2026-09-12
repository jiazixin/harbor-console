# 验收记录

本轮：2026-09-12，整体检查与 UI 改进。范围为当前工作区；原有未提交修改保留。

## 检查与结果

下表为本轮最终工作区的验证结果，历史证据未沿用为本轮通过。测试服务使用本轮构建的生产二进制与嵌入资源。

| 检查 | 本轮结果 | 范围 |
| --- | --- | --- |
| `make check` | PASS | Go 格式、空白、部署 pin、模块、vet、race、前端格式/lint/类型/测试、生产构建 |
| `npm test` | PASS | 29 项合同；48 个组件测试文件 / 181 项测试 |
| Playwright | PASS，42/42 | 24 个全路由场景 + 18 个交互场景，46 秒 |
| `make security-check` | PASS | npm audit 0 告警；Go 1.26.6 govulncheck 无漏洞 |
| 视觉复查 | PASS | 已查看中文亮色概览/项目/弹窗，英文暗色复制桌面/移动页及移动弹窗截图 |
| Docker 运行 | 未运行 | 当前 Docker daemon 未启动，不能据此声明容器构建或运行已通过 |
| 真实 Harbor | 未运行 | 本轮没有连接真实 Harbor 或执行其写操作 |

补充：最终测试基础设施调整后 `npm run check` 再次通过；文档收尾后 `git diff --check` 与空白检查通过。当前 Docker daemon 不可用，Docker builder 的新 tag/digest 已通过官方 Registry 核对，未运行镜像构建。

## 浏览器覆盖

`frontend/e2e/route-matrix.spec.ts` 在 Chromium、Firefox、WebKit 分别检查中文/英文与 1440×900、1280×800、390×844、360×800：

- 一级页面、项目详情各节、制品详情各页签、安全页签、系统管理与配置子页。
- 页面加载完成、无错误态，无 document/main 横向溢出和认证后的 console warning/error。
- 分页下拉自动向上展开且位于可视范围；表头/表体语义配对，项目和复制表文字中轴偏差不超过 1px。
- 搜索、Escape、焦点恢复。

`frontend/e2e/interaction-quality.spec.ts` 对三个引擎分别增加：

- 弹窗 Tab/Shift+Tab 循环、portal 菜单键盘打开、Escape 分层关闭、Tab 返回弹窗、关闭恢复触发器。
- 搜索动态结果的焦点循环。
- 页签切换保持 header 和内容容器 identity；减少动态效果时取消/禁用动画。
- 延迟响应期间刷新按钮为 busy，完成即停止旋转，路由节点不被替换。
- 中文/英文暗色 390px 下多个代表页面无横向溢出，弹窗 footer 在可视区域。

## 本轮发现与处理

- 英文复制状态 badge 在提高字号后略超列宽：修正状态列宽，没有放宽溢出容差。
- Portal 下拉 Tab 处理受 React 卸载顺序影响：在捕获阶段取得逻辑 owner，再完成焦点迁移。
- WebKit 鼠标点击不自动聚焦按钮：页面动作捕获阶段明确聚焦触发器，保证弹窗关闭后可恢复。
- 扩展浏览器测试的重复 demo 登录触发每分钟 30 次生产限流：浏览器测试改为每 worker 一个只读会话，没有降低生产限流。
- npm 审计发现 1 高危、2 中危条目：更新锁文件内兼容补丁版本。
- Go 1.26.5 扫描发现 5 个可达标准库漏洞：最低构建版本与 Docker builder 同步升级到 1.26.6。

## 发布边界

本轮本地与 demo 验收不能替代真实 Harbor 和容器运行验收。正式发布前仍需：

1. 在目标 Harbor v2.15.2 下验证权限受限/空资源/部分失败场景、写入、权威回读和清理。
2. 验证真实复制、预热、Webhook 等外部服务链路，不能以 demo 成功提示替代。
3. 构建并运行非 root 容器，检查健康接口、嵌入资源、TLS/Origin/Cookie、日志和 SIGTERM。

原生 OIDC 登录与多副本共享会话不在实现范围。整体发布结论保持 **PROVISIONAL**，不标记“全面发布验收通过”。

[历史验收及详细缺陷列表](archive/2026-08/ACCEPTANCE.md)仅用于追溯。
