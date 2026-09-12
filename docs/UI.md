# UI 与交互规范

2026-09-12 更新。风格：清晰、紧凑的运维控制台；浅冷灰背景、白色信息面板、橙色主操作，暗色主题保持同样层级。

## 基础样式

设计 token 位于 `frontend/src/styles/styles.css`；暗色 token 位于 `workspace.css`。修改已有样式源，不追加整页覆盖层。

| 语义 | 基线 |
| --- | --- |
| 正文 | `--font-body`；Avenir Next、PingFang SC 及系统回退，不加载远程字体 |
| 代码、ID、数值 | `--font-mono`；数字使用 tabular-nums |
| 字号 | 页面标题 24px，正文 12–14px，次要信息通常 11px；不通过缩小到 9px 挤压内容 |
| 圆角 | 控件 `--radius-control` 6px，面板 `--radius-panel` 10px，弹窗 `--radius-dialog` 12px |
| 控件高度 | 表单 `--control-height` 42px，紧凑按钮 `--control-height-compact` 34px |
| 间距 | 紧凑图标组 4px，同组操作 8px，组间 16px，主要区块通常 24px |
| 表格 | 表头约 38px，数据行最小 49px，文字允许按语义省略或换行 |
| 阴影 | 面板轻阴影 `--shadow-panel`；弹层 `--shadow-dialog` / `--shadow` |

白底和暗色表面分别使用主题文字 token，不用降低整个内容容器 opacity 来表示次要信息。颜色表达状态时同时提供文字。危险按钮使用红色及明确动词；禁用控件无 hover/按压效果，忙碌按钮明确暴露 `aria-busy`。

导航中的“镜像仓库”指当前实例的制品仓库，“远程仓库”指复制使用的外部 registry 连接，两个入口不能同名。

## 共享组件

- 标题与操作：`PageHeader`、`Breadcrumb`、`RefreshButton`、`SectionHeading`。
- 数据：`SortableHeader`、`StableTableColumns`、`Pagination`、`DialogPagination`、`ViewModeToggle`。
- 表单：`UnifiedSelect`、`ControlDialog`、`ToggleSetting`、`ToolbarSearchForm`。
- 状态：`EmptyState`、`LoadingView`、`ErrorView`、`StatusBadge`。
- 结构切换：`ContentTransition`；模态生命周期：`useModal`。

`UnifiedSelect` 使用受控 button/listbox，表单需要值时输出 hidden input。菜单 portal 到 body，以 visual viewport 计算上下翻转和边缘空间。普通单选不另造原生 select 或页面专用 dropdown。

搜索输入的草稿不应被无关父组件 rerender 覆盖；只有真实路由值变化才同步输入。空状态给出含义明确的标题与解释；请求失败给出可重试入口，不能显示伪造的零值或成功状态。

## 动效职责

| 动作 | 唯一 owner | 行为 |
| --- | --- | --- |
| 一级路由进入 | `ApplicationShell .motion-route-enter` | 220ms 缓出，4px 向上就位 |
| 项目/制品/安全/管理/复制页签、配置子页签 | `ContentTransition` | mode 改变时内容淡入；首帧不重复路由动画 |
| 仓库与远程仓库列表/卡片切换 | `ContentTransition` | 内容淡入，保留父容器、筛选和滚动结构 |
| 排序、筛选、分页、刷新 | 稳定数据容器 | 不重播进入动画，不更改 key |
| 弹窗与 toast | `motion-system.css` | 220ms 淡入及轻位移 |
| 菜单与遮罩 | `motion-system.css` | 160ms 淡入；fixed 菜单不使用 transform，以免影响定位测量 |
| Hover / 按压 | 共享控件 | 160ms 颜色反馈，按钮按压 1px |
| 加载/刷新 | `.spinner` / `RefreshButton[aria-busy]` | 900ms 匀速旋转，完成即停止 |

所有非循环动效使用 `--motion-ease`；`--motion-linear` 只用于加载旋转。健康状态点静态展示。Banner、统计单元格和列表行不叠加入场动画。页面动画完成后不保留 transform 或 will-change。

`ContentTransition` 用 Web Animations API 对既有 DOM 进行一次淡入，时长和曲线读取 CSS token，不通过 key 强制卸载组件；仅 mode 变化触发，不以完整 query、页码、排序或请求版本驱动。快速连续切换取消旧动画。

`prefers-reduced-motion: reduce` 禁用 CSS 动画与过渡，并取消或跳过内容动画；加载仍有 busy 语义和静态图标。现有弹窗关闭是即时卸载，不承诺尚未实现的退出动画。

## 焦点与弹窗

`ControlDialog` 和全局搜索共用 `useModal`：

- 打开后聚焦指定输入，缺少输入时聚焦 dialog；隐藏和 disabled 控件不进入 Tab 顺序。
- Tab / Shift+Tab 在弹窗内循环，背景不能抢焦点。Portal listbox 视为父弹窗的一部分。
- Escape 优先关闭下拉菜单；再次 Escape 才关闭弹窗。提交期间禁用关闭与重复提交。
- 关闭后恢复仍存在的触发控件；滚动锁随模态生命周期清理。
- 错误使用 `role="alert"`；标题、说明和 busy 状态通过 ARIA 关联。
- 弹窗内容区独立滚动，头部和底部按钮保持可达；高度使用动态视口。

共享 `:focus-visible` 必须可见，包括页码跳转和排序按钮。不要因追求干净外观移除键盘焦点。

## 表格与响应式

1. 可收缩 flex/grid 子项显式 `min-width: 0`；内部滚动区设置 `min-height: 0`；等分列使用 `minmax(0, 1fr)`。
2. 表格在 `.table-scroll` 内横向滚动；稳定表格至少 760px，复制策略/执行表保留各自稳定列宽。禁止用页面横向裁切掩盖文本溢出。
3. 居中、数字、时间列的 th/td 成对使用 `table-cell-center`、`table-cell-number`、`table-cell-time`。排序文字中轴用指示器的等宽空间平衡，允许最多 1px 偏差。
4. 状态列按最长英文 badge 预留宽度；不得通过降低字号修复列宽问题。
5. 分页左侧依次是条目范围、每页条数，右侧是页码与前后页。窄屏按逻辑组换行；页码可点击输入，Enter 跳转、Escape 取消。
6. 顶栏在小屏收拢为图标，侧栏独立滚动；工具栏和操作组允许换行，资源名与 digest 省略时保留完整查看入口。
7. 验证中文/英文、1440/1280/390/360px、暗色和减少动态效果模式；修改字体或密集布局时另查浏览器缩放。
