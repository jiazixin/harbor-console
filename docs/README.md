# Harbor Console 文档索引

本目录只保留当前仍有效的架构约束、Harbor v2.15.2 审计结论、补全计划和验收计划。历史实施计划已经完成或与当前审计结论冲突，已于 2026-07-31 清理，不再作为实现依据。

## 唯一有效文档

1. [ADR 0001：基于 Harbor 官方 OpenAPI 的类型化控制网关](adr/0001-official-harbor-api-gateway.md)
2. [Harbor v2.15.2 Portal/API 覆盖审计](harbor-v2.15.2-parity-audit.md)
3. [Harbor v2.15.2 等价补全实施计划](plans/2026-07-31-harbor-v2.15.2-parity-completion.md)
4. [Harbor v2.15.2 等价验收计划](acceptance/2026-07-31-harbor-v2.15.2-parity-acceptance.md)

## 执行顺序

执行模型必须先读 ADR 和审计，再严格按补全计划的 Task 顺序工作。每个 Task 都要先增加会失败的测试，再实现最小改动，通过该 Task 的检查后单独提交；不能跨 Task 顺手重构。

实现完成后停止继续改代码，由独立验收模型按验收计划重新获取官方基线、重新计算 API 覆盖并执行真实 Harbor 集成测试。实现模型自己的测试结果只能作为交付证据，不能代替独立验收。

## 完成口径

- **Portal 等价：** Harbor v2.15.2 官方 Portal 暴露的用户工作流可完成，并且没有已知的语义丢失、权限错误或类型错误。
- **稳定 API 等价：** 审计列出的非 deprecated API 都有明确的类型化映射、测试和必要的 UI 消费者。
- **完整 Swagger 等价：** 203/203 operation 均已映射，包括 deprecated 兼容接口。该口径必须单独报告，不能用 Portal 等价代替。
- **不接受：** 只有按钮或静态页面、调用错误接口、只覆盖 demo、无失败态、修改已有规则时丢字段、用任意路径反向代理凑覆盖率。

当前基线是 **181/203 operation（89.2%）**。在独立验收通过前，README 或 UI 不得宣称 100% parity。
