# Directory Layout Implementation Plan

**Goal:** 按根目录《目录规范.md》整理前后端工具、生成资源和执行入口，保证干净检出可重建。

**Architecture:** 保持 Go cmd/internal 和前端领域模块边界。前端独立拥有 npm 清单、锁文件、ESLint、dist 和 Go 嵌入入口；CI/CD 直接协调执行。统一配置路径，不保留旧路径兼容逻辑。

**Tech Stack:** Go、React、TypeScript、Vite、Vitest、Playwright、Docker。

## 实施步骤

1. 将 package.json、package-lock.json、eslint.config.mjs 移入 web；修正 npm 脚本和工具工作目录。
2. 将 internal/webui/embed.go 移入 web/embed.go，生成物唯一输出 web/dist；删除原已跟踪生成物并添加忽略规则；更新 Go import 和架构合同。
3. 更新构建依赖、报告路径、清理范围；修正 Docker、CI 和 Dependabot 路径；仓库脚本显式定位根目录。
4. 完善配置路径、首次启动、目录树、生成流程和升级说明；历史归档保持原始记录。
5. 执行前端安装、完整质量检查、浏览器测试、干净副本构建与最小启动验证；记录不能执行的检查及原因。

## 边界说明

- internal/app 的网关、会话与演示逻辑共享内部类型，保留现有包，不为目录外观扩大公开 API。
- 就近单元测试、web/e2e、web/tests 与 Go testdata 均有明确职责，无需重命名。
- 默认配置路径统一为 configs/config.local.yaml；CONFIG_FILE 可显式指定其他位置，不回退到旧路径。
- 不修改用户的目录规范、个人配置或运行数据；不自动提交。

## 按新版内部规范补齐

1. 增加 依赖安装（Go 模块及锁定的 npm 依赖）和 Vite 开发服务（Vite 开发入口，另一个终端 后端启动 启动后端）；默认测试 同时执行 Go 和 Web 默认测试。CI 和 Docker 直接执行依赖安装与构建命令。
2. 审核 CSS 选择器实际使用域，将单业务域规则归入对应 features，跨域及全局规则留 styles；保留每个原样式阶段的顺序和同一选择器的覆盖顺序，不改选择器和声明。迁移仅项目域使用的 DialogPagination。
3. 更新 CSS 合同的读取路径和完整扫描范围；同步有效开发/设计文档。补全忽略规则，不建立旧路径别名。
4. 在无依赖、产物、本地配置的隔离副本运行 依赖安装、完整质量检查、默认测试、启动验证和清理验证；执行三浏览器矩阵，尝试可用 Docker 上下文并如实记录限制。

## 完成记录

以上步骤已落地。完整检查、干净副本验证、三浏览器回归与清理验证通过；Docker 三个上下文均无守护进程，容器执行验证仍需 CI 或可用 Docker 环境。详细证据见 ../ACCEPTANCE.md。
