# Harbor Console 实施文档

> 文档状态：当前实施规范
> 最后整理：2026-08-04
> 前置阅读：`DESIGN.md`

## 1. 使用方式

本文档规定修改 Harbor Console 时的实施顺序和工程约束。开发者或 AI 不得只根据单个需求直接修改页面；必须先确认职责模块、数据合同、布局影响、双语影响和验收方法。

每次变更至少完成以下闭环：

1. 明确需求和不变条件。
2. 找到现有职责模块和共享组件。
3. 先补失败测试或明确可复现证据。
4. 实现最小且完整的改动。
5. 运行 focused test。
6. 运行完整质量门。
7. 对 UI 改动执行真实浏览器桌面与移动验收。
8. 更新 `CHANGELOG.md`，必要时同步设计和验收文档。

## 2. 仓库结构与修改边界

```text
cmd/harbor-console/       进程入口
internal/app/             HTTP、会话、Harbor 网关、校验、demo
internal/config/          配置加载与校验
internal/observability/   日志与访问日志
frontend/                 React 源码、共享组件、领域页面、样式与前端测试
internal/webui/assets/    Vite 生产构建产物，禁止手写业务逻辑
configs/                  可部署配置示例
scripts/                  仓库质量检查
docs/                     设计、实施、验收和变更记录
```

实施时优先修改已有 owner 文件，不把无关逻辑重新塞回仓库根目录，不因为一个需求顺手重命名或重排无关模块。

## 3. 后端功能实施流程

### 3.1 新增或修改 Harbor operation

1. 以 Harbor v2.15.2 官方 Swagger 的 method/path/schema 为准。
2. 在 `internal/app/harbor_operations.go` 增加或修改固定 `controlSpec`。
3. 为每个 path parameter 定义独立校验和转义，不直接拼接用户输入。
4. 白名单列出 query 参数；未知 query 必须拒绝。
5. 写操作在对应 `harbor_validation_*.go` 中进行字段、类型、范围、长度和组合语义校验。
6. 在 `gateway_*_test.go` 中验证 method、path、query、body、header 和错误状态。
7. 在 demo gateway 中补齐可重复的生命周期。
8. 若稳定 operation 集合发生变化，必须先更新设计基线，再更新 fixture；禁止为了让测试通过而直接改 fixture。

### 3.2 写操作规则

- 只发送 Harbor schema 允许的字段。
- 更新对象时以权威返回对象为基础，保留未编辑和未知的兼容字段；不能从表单重新构造一个不完整对象。
- Harbor 使用字符串 boolean 的 metadata 必须保持字符串语义。
- Harbor v2.15.2 的 Label 名称上限按真实实例确认为 128 字符；前端 `maxLength`、Go validator 和边界测试必须使用同一常量，不能沿用通用 255 字符资源名限制。
- Retention `rules[].params.*.extras` 在 Harbor 请求中是包含 JSON 的字符串。前端使用结构化对象构造内容后只在请求边界序列化一次，禁止直接发送对象或手写转义 JSON。
- Robot 创建与更新是两个不同合同。POST 后如需设置 `disable`，必须使用创建响应返回的官方 Robot 名称和当前 `level` 再执行 PUT；不得用未加官方前缀的输入名更新，也不得假设 POST 会持久化 `disable`。
- 成功 toast 不是持久化证据。验收必须重新 GET 权威资源并比较值。
- `409`、`412`、`422`、`429` 和上游 `5xx` 需要保留可诊断含义。
- 删除前如有 `_deletable` 或等价预检，必须先执行并阻止错误删除。

### 3.3 会话和连接修改

修改实例连接、认证或缓存时必须验证：

- 无效凭据不能创建会话或保存连接。
- 切换实例后身份、权限、数据、缓存、请求和 demo 状态全部切换。
- 删除非当前实例后当前连接仍可用。
- 删除当前实例后选择最早保留的连接并完整应用其状态。
- 最后一个实例不能被删除。
- 浏览器响应不包含 password、CLI Secret、Harbor Cookie 或 Token。
- 日志不包含 query string 或认证值。

## 4. 前端功能实施流程

### 4.1 先确认复用点

新增页面或控件前先搜索：

- 是否已有相同 table、pagination、status badge、toolbar、dialog、toast、empty state 或 select。
- 是否已有相同领域模块，例如 project、repository、replication、security、administration。
- 是否已有翻译 key、日期工具和错误归一化函数。
- 是否已有对应 CSS token 和响应式规则。

禁止为单个页面复制一套近似组件。重复实现会重新引入字体、尺寸、焦点和浏览器差异。

### 4.2 React 与代码组织规则

当前状态说明：全量 React 迁移已经完成，`frontend/public/runtime/`、classic renderer、HTML parser 和 preview 入口均已删除。后续业务修改只能进入 typed React 源码，并必须继续通过浏览器视觉与交互 Gate。

- React 源码必须位于 `frontend/`。`internal/webui/assets/` 只允许由 `npm run build` 生成，不得手工修改、不得存放旧渲染器或兼容适配层。
- 文件名使用小写 kebab-case；React 组件导出使用 PascalCase，hook 以 `use` 开头，普通函数与变量使用明确的 camelCase；禁止缩写命名和无业务语义的 `utils`、`common`、`misc` 文件。
- `ReactApplication` 只负责会话、路由和应用装配。共享 UI 位于 `frontend/src/components/`，应用 shell 与 overlay 位于 `frontend/src/layouts/`，数据访问与模型位于 `frontend/src/app/`，领域页面与数据映射位于 `frontend/src/features/<domain>/`。一个文件只承担一个清晰职责；组件、数据访问、路由和领域映射不得持续堆入同一文件。
- 页面必须通过共享 `PageHeader`、`Toolbar`、`DataTable`、`Pagination`、`Dialog`、`Toast`、`StatusBadge` 和 form primitive 构成。领域页面只定义稳定 endpoint、列配置和领域行为，不能复制 DOM/CSS 实现。
- 所有 API 调用必须以当前 `controlSpecs` 或 `resourceSpecs` 为唯一合同来源。请求参数只传该 operation 明确允许的字段；写入 body 只传 validator 明确允许的字段。禁止调用 deprecated operation、猜测字段、透传未知字段或用浏览器兼容层重写请求。
- 异步 effect 必须取消过期请求或忽略过期结果；禁止利用全局变量、全局事件分发或 `innerHTML` 作为 React 状态管理替代方案。
- React 迁移不得改变既有 UI 的视觉或行为契约。先从原有页面抽取可验证的 shell、toolbar、table、dialog、pagination、select、animation 和 responsive contract，再迁移领域状态；禁止以新的 dashboard、卡片布局、导航标签或交互流程替代原功能。
- 只有当迁移前同类型组件存在可证明的不一致时，才允许通过共享 primitive 做小范围视觉统一；必须保留原信息层级、字段和工作流，并在 `ACCEPTANCE.md` 或 `CHANGELOG.md` 记录差异与浏览器对照证据。
- 每个迁移批次必须同时覆盖中文和英文，并在桌面与移动视口检查：截图、键盘焦点、动效/reduced-motion、筛选、排序、分页、select 与 dialog。只通过构建、unit test 或静态 DOM 断言不构成 UI 验收。

### 4.3 TypeScript 与交互规则

- 所有用户输入通过结构化对象和 `JSON.stringify` 发送，不使用字符串拼 JSON。
- 用户可见内容通过 JSX 文本节点和 typed props 渲染；禁止重新引入字符串 HTML、`innerHTML`、`escapeHTML`/`escapeAttr` 兼容渲染链。
- 路径、query、状态和排序使用结构化 helper，不以正则批量重写 URL。
- 异步搜索、路由切换和实例切换必须使用 AbortController、route token 或等价方式忽略过期响应。
- 页内筛选和 tab 更新使用 React state 与稳定组件树，不直接操作 DOM 或替换 `main` 内容。
- 单选下拉只通过共享的 React `UnifiedSelect` 渲染。它使用受控 ARIA button/listbox，并在需要参与表单提交时输出 hidden input；统一 class、字体、高度、边框、focus、disabled 和空选项行为，不得再引入原生 `<select>` 或 DOM 增强器。
- 新增 icon 优先复用 `frontend/src/components/icons.tsx` 中的 symbol；按钮必须有文字或 `aria-label`/`title`。
- 关闭 overlay 前保存 opener，关闭后只在 opener 仍连接到 DOM 时恢复焦点。

### 4.4 国际化规则

- 模板内中文文本必须进入英文词典，动态拼接文本优先使用完整句子 key。
- 不允许只翻译句子外层而把状态、认证方式、排序名留为中文。
- 不允许遍历 DOM 用正则替换所有中文，这会破坏资源名、日志和用户输入。
- 英文模式需要检查较长字符串是否改变控件高度、按钮宽度或表格列。
- 缺失或非法时间调用共享日期工具，不能在页面里自行 `new Date(...).toLocaleString()`。

## 5. UI 防复发实施规范

本节针对项目中已经出现过的塌陷、字体不一致、浏览器原生组件差异和文本重叠问题。以下是强制规则，不是建议。

### 5.1 防止布局塌陷

新建 flex/grid 布局时逐项检查：

- 可伸缩内容列是否有 `min-width: 0`。
- 可滚动内容区是否有 `min-height: 0`。
- 等分 grid 是否使用 `minmax(0, 1fr)`。
- 工具栏是否允许 `flex-wrap`。
- 内容是否需要 container query，而不是只看 viewport。
- 固定列、图标、按钮、badge 是否有稳定尺寸。
- 长字符串是否由当前组件处理，而不是把整个页面撑宽。
- table、log、command、dialog 是否拥有自己的 overflow 容器。

禁止用以下方式掩盖塌陷：

- 在 `body` 上开启常驻横向滚动。
- 用极小字体把内容硬塞进去。
- 使用负 margin、绝对定位或 translate 把错位内容拉回去。
- 删除字段、截断关键信息或隐藏主操作。
- 只在一个本机分辨率上微调像素。

### 5.2 保持字体一致

- 新增 CSS 默认不写 `font-family`；正文继承 `--font-body`。
- 只有 ID、digest、命令、日志、固定宽数字等明确场景使用 `--font-mono`。
- 新的 `button`、`input`、`select`、`textarea` 或自定义 trigger 必须 `font: inherit`。
- 表头内 button、分页 button、菜单 item 不得使用浏览器默认字体。
- 不设置负 `letter-spacing`，全局保持 `0`。
- 不引入远程字体、base64 字体或依赖操作系统单一字体的设计。
- 字重使用现有层级，避免在不同平台用未支持的极端字重制造粗细差异。

验证时至少比较：正文、按钮、表头、输入、下拉、分页、badge、tooltip、代码文本和中英文切换后的字形与行高。

### 5.3 禁止重新使用不受控原生单选下拉

正确方式：

```tsx
<label className="toolbar-field">
  <span>{t("状态")}</span>
  <UnifiedSelect
    ariaLabel={t("状态")}
    className="toolbar-select"
    name="status"
    value={status}
    options={statusOptions}
    onChange={setStatus}
  />
</label>
```

共享 `UnifiedSelect` 负责 trigger、listbox、hidden form value、视觉与键盘基线。不要在页面内直接生成另一套 button/menu 组合，也不要给单个页面加不同箭头、不同高度或不同弹出层。

当前 typed React 生产源码不允许原生 `<select>`。未来如需多选、可搜索列表框或其他特殊选择器，应先建立共享可访问 primitive，补齐 component、architecture 和真实浏览器测试，再供领域页面复用。

### 5.4 防止文本重叠

- 标题、摘要和表单行需要按中英文最长文本设计。
- 固定高度只用于图标按钮、标准输入和已验证的单行控件。
- 文本型容器优先使用 `min-height` 而不是 `height`。
- `white-space: nowrap` 只能用于时间、状态、短命令和有稳定宽度的按钮；长资源内容不得全局 nowrap。
- 可省略文本必须同时设置 `min-width:0`、`overflow:hidden`、`text-overflow:ellipsis`、`white-space:nowrap` 和完整内容入口。
- 表格、选择器和资源摘要中的通用单行长值复用 `OverflowText`；制品 Label chip 使用相同的 260px 上限和 `title`，不得由领域页面各自定义不同截断宽度。
- 应换行的 URL、digest、annotation、日志和命令使用 `overflow-wrap:anywhere`。
- 图标必须 `flex:0 0 <size>`，避免被长文本压扁或与文字重叠。
- 不允许将说明文字绝对定位到输入框、按钮或 badge 上方。
- 页面主标题必须给内容列 `min-width:0`；无法合理单行展示的资源名最多显示 3 行，并通过 `title` 暴露完整值。不得让单个长标题扩大 `workspace`、`main` 或 document 宽度。
- Harbor 项目机器人名称会包含项目名前缀。创建前必须按组合后的 255 字符上限计算剩余名称长度，不能只校验用户输入的后缀；没有剩余长度时禁用输入和提交并解释原因。

### 5.5 表格实施模板

```html
<div class="table-scroll">
  <table class="resource-table">
    ...
  </table>
</div>
```

表格实现必须同时考虑：

- 桌面 1440 和 1280 宽度下的列对齐。
- 390 和 360 宽度下局部横向滚动。
- 5 位以上数量、完整年份时间、长用户和项目名。
- 空状态、加载状态和错误状态不能改变页面外壳宽度。
- 行动作列的按钮数量变化不能推动其他列。
- 排序表头的按钮继承表头字体和对齐。

新增数据列时，不得只把 `<th>` 和 `<td>` 插入模板；必须定义列的压缩策略、最小宽度、对齐和移动端行为。

### 5.6 工具栏实施模板

- 搜索、筛选和动作按逻辑组组织。
- 同组控件间距使用 `--space-control`。
- 不同逻辑组使用 `--space-control-group`。
- 搜索框和 select 设置有上限的 flex-basis，不无限占满。
- 560px 左右的窄容器检查换行后动作顺序和宽度。
- 提交和重置按钮保持相邻，不能被 spacer 推到无法理解的位置。

### 5.7 Dialog 实施规则

- 打开前保存当前 `document.activeElement`。
- 打开后聚焦第一个显式 `data-focus-first` 字段；文本输入光标位于末尾。
- 表单体独立滚动，移动端最大高度不超过 viewport。
- 关闭、Escape 和成功提交后恢复 opener 焦点。
- 错误显示在 dialog 内，不能让用户丢失已填写内容。
- 危险操作在标题和确认内容中显示具体资源名。

## 6. CSS 实施规则

- 共享 token 放在 `styles.css`。
- 表单 primitive 放在 `form-controls.css`。
- 应用外壳和通用表格放在 `application-shell.css`。
- 领域样式放在对应领域 CSS，不把所有新规则追加到一个大文件。
- 跨领域响应式规则放在 `responsive.css`。
- 全局间距和动画分别由 `spacing-system.css`、`motion-system.css` 管理。
- 新样式必须确认加载顺序，不用大量 `!important` 抢优先级；当前 spacing layer 中的集中式 `!important` 是显式标准化例外。
- 同一 selector 不在多个文件中随意重复定义尺寸。
- 页面 section 不嵌套装饰性 card；数据项、modal 和真正的工具面板才使用 card。

## 7. 测试策略

### 7.1 Go 测试

| 变更类型       | 必须覆盖                                       |
| -------------- | ---------------------------------------------- |
| 网关 operation | method、path、query、body、status、pagination  |
| 校验           | 合法边界、非法类型、长度、未知字段、无上游请求 |
| 会话           | 创建、过期、切换、删除、凭据隔离               |
| demo           | 读写生命周期、分页、过滤、错误状态             |
| 配置           | 默认值、YAML、环境覆盖、非法配置               |
| 日志           | 格式、等级、敏感信息排除                       |

涉及共享状态或 HTTP Client 的修改必须运行 race detector。

### 7.2 前端合同测试

React 前端合同和组件测试固定以下行为：

- 字体、表格列、筛选栏和 spacing token。
- `UnifiedSelect` 的表单值、ARIA listbox、键盘、焦点恢复、disabled 与空选项行为，以及生产源码禁止原生 `<select>` 的架构合同。
- 双语登录页稳定高度。
- 侧栏滚动、移动端 operation center 和局部 table scroller。
- 焦点恢复、reduced motion 和请求取消。
- i18n、日期、日志、项目设置、Retention、复制、审计和 Artifact 行为。

组件和合同测试可以防止规则被删除，但不能证明浏览器真实渲染没有重叠。UI 修改必须增加或更新 React 测试，并执行浏览器验收。

### 7.3 测试命令

Focused test 示例：

```bash
go test ./internal/app -run 'TestName' -count=1
npm test
```

完整质量门：

```bash
make check
git diff --check
```

信息性覆盖率：

```bash
make coverage
```

`make check` 包含格式检查、空白检查、部署 pin 检查、Go module 检查、vet、race test、前端格式与语法、前端测试和生产构建。

当前 React 迁移基线为 20 条合同测试和 44 个文件中的 153 条组件测试。TypeScript 正式启用 `noUnusedLocals` 与 `noUnusedParameters`；数量会随功能增加而增长，验收报告必须记录实际命令输出，不能沿用旧数字。

## 8. 浏览器验证要求

UI 变更至少验证：

- 1440 x 900。
- 1280 x 800。
- 390 x 844。
- 360 x 800。
- 简体中文和英文。
- 默认缩放与至少一次 125% 缩放。
- 键盘 Tab、Shift+Tab、Enter、Space、方向键和 Escape。
- Chromium；涉及 form/select/日期/滚动行为时还必须验证 Firefox 或 WebKit 中至少一种。

检查页面级横向溢出、文字覆盖、字体跳变、控件塌缩、dialog 超界、焦点丢失、控制台错误和网络重试。

全量迁移或共享组件变更还必须对迁移前基线和当前 React 入口运行同一份认证后路由矩阵。最近一次基线覆盖 24 条路由、两种语言和四个规定视口，共 384 项检查；后续不得以更小的 smoke 集合替代该覆盖范围。

正式跨浏览器 Gate 使用：

```bash
npm run test:browser
```

当前矩阵覆盖 47 条页面/页签状态、Chromium/Firefox/WebKit、简体中文/英文和四个规定视口，共 1,128 次认证后路由检查。CI 在独立 Browser Job 中安装三个引擎并执行同一命令；本地可以通过 `HARBOR_E2E_BASE_URL` 指向已经运行的生产二进制。

涉及长值或 Dialog 布局时，除正式矩阵外还要在真实 Harbor 数据上至少检查一个移动端和一个桌面端。最近一次边界基线使用 390x844、412x915 和 1280x720，要求 document 宽度等于视口、Dialog 的 scroll width 不超过自身内部宽度、宽表只在局部容器滚动，并检查完整值 `title` 与 console warning/error。

### 8.1 真实 Harbor 字段与状态语义

- Scanner 名称、URL、访问凭据和描述分别限制为 128、512、512 和 1024 个 Unicode 字符；首个 Scanner 和默认 Scanner 不允许停用。
- Replication policy 缺失 `enabled` 按停用处理，新建策略默认启用；Harbor `speed: 0` 映射为 UI 不限速值 `-1`。
- Replication 描述和过滤值使用 Unicode 字符计数，不使用 UTF-8 字节数；1024 个中文字符可提交，1025 个字符必须由前端和网关一致拒绝。
- 对配额、系统配置和可编辑策略执行写入时，验收必须保存原值、读取 Harbor 权威结果并在结束前恢复，不能只检查成功提示。

## 9. AI 修改协议

后续 AI 执行任务时必须遵守：

1. 先读四份 docs 和相关测试，再修改代码。
2. 不删除或放宽现有回归测试来让新实现通过。
3. 不把 demo 通过当作真实 Harbor 通过。
4. 不通过减小字体、隐藏字段或加全局 overflow 掩盖布局问题。
5. 不引入第二套 select、pagination、dialog、table 或字体系统。
6. 不调用 deprecated 或未在当前 v2.15.2 稳定合同中声明的 operation、query 或请求字段。
7. 不直接修改 API fixture 迎合实现。
8. 不在未运行浏览器验收时宣称“无重叠”或“跨浏览器一致”。
9. 不覆盖用户尚未提交的无关工作区修改。
10. 完成后说明实际运行的命令、未运行的验收和剩余风险。
11. 将用户可见变更、问题根因和防复发措施写入 `CHANGELOG.md`。

## 10. 完成定义

一项变更只有同时满足以下条件才算完成：

- 实现符合 `DESIGN.md`。
- focused tests 和 `make check` 通过。
- UI 改动完成规定视口和双语渲染检查。
- 真实 Harbor 相关写入已读取权威资源验证；无法访问时明确标记 BLOCKED，只完成部分范围时明确标记 IN PROGRESS，不能把局部流程扩大为完整 Gate 通过。
- 没有新增凭据、日志、出站访问或破坏性操作风险。
- 文档和变更记录已更新。
