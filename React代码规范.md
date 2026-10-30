# React 代码规范

基线版本：1.0.0。适用范围：React 19 + TypeScript 的单页 Web 应用（不含 SSR 框架）。先读 [代码规范.md](代码规范.md) 与 [Web代码规范.md](Web代码规范.md)，本文只写 React 特有的规则。

## 1. 工具

- ESLint 在 Web 通用配置之上加 `eslint-plugin-react-hooks` 的 `reactHooks.configs.flat.recommended`，并覆盖 `'react-hooks/exhaustive-deps': 'error'`。
- 默认不启用 React Compiler；启用时记录为技术决策，并同步调整第 2 节关于手写记忆化的规则。
- 入口用 `<StrictMode>` 包裹整个应用。

## 2. 组件

- 只写函数组件，使用具名导出（`export function ProjectTable()`）；不使用 `React.FC`，不使用默认导出。懒加载写成 `lazy(() => import('./LibraryPage').then((m) => ({ default: m.LibraryPage })))`。唯一允许的 class 组件是 Error Boundary。
- 一个文件导出一个主组件，只服务于它的小组件可以写在同一文件中。
- Props 用 `type` 声明，命名 `<组件名>Props`；回调属性以 `on` 开头（`onSelect`），处理函数以 `handle` 开头（`handleSelect`）。
- 列表渲染使用稳定 `key`，不用数组下标（内容不变的静态列表除外）。
- 禁止 `dangerouslySetInnerHTML`；确需渲染富文本时先用净化库处理并注释来源。
- 不把 `useMemo` / `useCallback` / `memo` 当作默认习惯；只在测量到渲染开销，或需要稳定引用放入依赖数组时使用。

## 3. 状态与副作用

- 能由 props 或其他状态计算出的值在渲染时直接计算，不存入 state。
- 禁止用 `useEffect` 把 props 同步到 state（`useEffect(() => setX(prop), [prop])`）。需要“随某个值重置”的草稿状态时，用 `key` 重建组件，或使用 `src/lib/state/use-resettable-state.ts`。
- `useEffect` 只用于与外部系统同步（订阅、DOM、定时器），必须返回清理函数；不在 `useEffect` 中处理用户事件的结果。
- 应用级共享状态（会话、主题、语言、全局提示）用 Context，Provider 放 `src/app/`；值变化频繁时拆分为多个 Context。默认不引入 Redux、Zustand 等全局状态库，需要时记录为技术决策。
- 受控表单为默认写法；只提交一次、不需要逐字段即时校验的简单表单（如登录）可以用 `FormData` 读取。

## 4. 服务端数据

- 读取服务端数据统一使用 TanStack Query。`QueryClient` 在 `src/app/` 创建，默认选项：

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
      retryDelay: (failureCount, error) => retryDelayMs(failureCount, error),
    },
  },
})
```

  `isRetryable` 与 `retryDelayMs` 放在 `src/app/`，按 [代码规范.md](代码规范.md) 第 5.3 节的重试规则实现（含 `Retry-After` 与退避）；请求包装本身不重试。`staleTime` 由项目按数据特性设定。查询函数调用应用唯一的请求包装，并把 Query 提供的 `signal` 传给它。
- 每个业务域把查询封装成 `use<名称>Data` hook，放在该业务域内；query key 为数组，按“业务域 → 资源 → 参数”排列，集中定义在该域的 key 工厂中。
- 写操作使用 `useMutation`；成功后按 key 前缀失效受影响的查询（`queryClient.invalidateQueries({ queryKey: libraryKeys.items(libraryId) })`），不在组件中手写重新加载计数器。
- 不在组件里手写 `useEffect + fetch + useState(loading / error / data)`。

## 5. 路由

- 只有一个页面的应用不引入路由。两个及以上页面的应用使用 React Router，路由表集中在 `src/app/`，页面组件懒加载。
- 部署方为前端路由提供 SPA 回退时使用 History 路由，否则使用 Hash 路由。
- 筛选、分页、选中项等可分享状态放在 URL 中，刷新后保持。

## 6. 样式

- 组件私有样式使用 CSS Modules：`ProjectTable.module.css` 与组件同目录，类名 camelCase，通过 `styles.xxx` 引用。
- 全局样式只放 `src/styles/`（变量、基础样式），在入口导入一次；不依赖多个全局样式文件的导入顺序决定优先级。
- 条件类名用模板字符串或一个小的拼接函数，不引入多个类名工具库。

## 7. 测试

- 组件测试使用 `@testing-library/react`。
- 依赖 TanStack Query 的组件在测试中使用独立的 `QueryClient`，并设置 `retry: false`。
