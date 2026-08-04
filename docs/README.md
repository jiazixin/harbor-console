# Harbor Console 文档索引

> 最后核对：2026-08-04

- [`DESIGN.md`](DESIGN.md)：当前架构事实、目标架构和不可变设计合同。
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md)：代码组织、实现约束、质量门和前端迁移规则。
- [`ACCEPTANCE.md`](ACCEPTANCE.md)：发布 Gate、浏览器验收、真实 Harbor 验收和历史缺陷回归。
- [`CHANGELOG.md`](CHANGELOG.md)：已提交历史、当前迁移提交、问题根因和验证证据。
- [`plans/2026-08-03-react-frontend-migration.md`](plans/2026-08-03-react-frontend-migration.md)：React 迁移执行计划与完成条件。

## 文档状态规则

- “当前事实”必须能在工作区代码、测试或运行证据中直接验证。
- “目标”不得写成已经实现；未达到发布条件时明确标记 `IN PROGRESS`、`FAIL` 或 `BLOCKED`。
- demo、静态合同、组件测试、浏览器截图和真实 Harbor 验收分别记录，不能互相替代。
- 架构、实现、验收或 API 基线变化时，至少同步更新上述四份长期文档。
