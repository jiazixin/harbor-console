# Harbor Console 设计文档

> 文档状态：当前设计基线
> 最后整理：2026-08-04
> 适用范围：当前仓库工作区及后续 Harbor v2.15.2 开发

## 1. 文档目的

本文档是 Harbor Console 的设计事实来源。后续开发者或 AI 在修改架构、接口、前端布局、组件行为或交互前，必须先阅读本文档。历史方案只用于解释演进，不得覆盖当前代码已经形成的运行契约。

项目的核心目标是提供一个面向 Harbor v2.15.2 的一体化管理控制台，在保留单二进制、纯内网部署和多实例连接能力的同时，覆盖项目、仓库、制品、安全、复制、保留、预热、身份、审计和系统运维工作流。

## 2. 产品边界

### 2.1 当前范围

- Harbor 基线固定为 v2.15.2。
- API 合同固定为 198 个非废弃 method/path operation。
- 浏览器通过 Harbor Console 的类型化接口访问 Harbor，不接触任意上游 URL、方法或路径。
- 支持 Basic Auth 和 Harbor CLI Secret。
- 一个控制台会话最多保存 20 个相互隔离的 Harbor 连接。
- 支持简体中文和英文。
- React 生产构建产物、翻译和图标全部嵌入 Go 二进制，不依赖 CDN、远程字体或运行时 npm 包。
- 内置 demo 数据用于页面、交互和生命周期验证，但 demo 通过不等于真实 Harbor 通过。

### 2.2 明确不在范围内

- 浏览器原生 Harbor OIDC 跳转登录。
- OIDC onboarding。
- 数据库账号自助注册。
- 旧 Harbor API 的 deprecated 兼容层。
- 多副本共享会话、共享限速或无状态横向扩容。
- 浏览器直连 Harbor、保存 Harbor Cookie、Token、密码或 CLI Secret。

如果未来要实现 OIDC、旧版本兼容、多副本部署或新的 Harbor 基线，必须先更新本文档，再开始编码和验收。

## 3. 总体架构

```text
浏览器
   |
   | HttpOnly + SameSite=Strict 控制台会话 Cookie
   v
Harbor Console 单个 Go 进程
   |-- HTTP 路由、请求限制和安全响应头
   |-- 内存会话与多 Harbor 连接
   |-- 类型化 Harbor v2.15.2 网关
   |-- Demo 状态与操作编排
   |-- 嵌入式中英文 Web 客户端
   |-- 结构化日志、健康检查和优雅退出
   |
   | 服务端 Basic Auth / CLI Secret
   v
一个或多个 Harbor 实例
```

### 3.1 后端职责

| 目录                     | 职责                                           | 约束                                                 |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| `cmd/harbor-console`     | 进程入口                                       | 只负责启动，不承载业务规则                           |
| `internal/app`           | 路由、会话、网关、校验、demo 和业务编排        | 所有 Harbor 操作必须显式注册                         |
| `internal/config`        | YAML 和环境变量配置                            | 默认监听 loopback，配置必须可验证                    |
| `internal/observability` | 应用日志和访问日志                             | 不记录查询字符串与凭据                               |
| `internal/buildinfo`     | 版本、Commit、构建时间                         | 由构建参数注入                                       |
| `frontend`               | React 源码、共享组件、领域页面、样式与前端测试 | 只调用固定类型化 Console API，不直接接触 Harbor      |
| `internal/webui`         | Vite 生产构建产物与 Go 嵌入边界                | 禁止手写；只允许由 `npm run build` 生成 hashed asset |

当前采用模块化单体。网关、会话和 demo 仍共享内部传输类型，暂不为了目录美观强行拆成多个公共包。

### 3.2 类型化 Harbor 网关

`internal/app/harbor_operations.go` 中的每个 operation 固定声明：

- Harbor 官方路径。
- 允许的 HTTP 方法。
- 路径参数及其编码规则。
- 允许的查询参数。
- 请求体是否必需。
- 请求体校验函数。
- 列表、原始响应和 HEAD 的响应语义。

禁止实现 `/proxy?url=...`、由浏览器提供 method/path、拼接未校验路径，或为了快速接通接口而绕过 `controlSpecs`。

项目名、仓库名、digest、reference、metadata name 等参数必须按各自语义独立校验和转义。仓库路径的双重编码是 Harbor API 合同的一部分，不能统一简化为一次字符串替换。

列表响应统一为 `items + pagination`，总数来自 Harbor 的 `X-Total-Count`。HEAD 与 GET 是不同 operation。稳定合同由 `internal/app/testdata/harbor-v2.15.2-stable-operations.txt` 和 `internal/app/api_contract_test.go` 锁定。

### 3.3 会话与多实例模型

- 浏览器只保存随机控制台会话 ID。
- Harbor 用户名、密码或 CLI Secret 只保存在 Go 进程内存。
- 会话有效期为 12 小时。
- 单进程最多保留 1000 个会话，每个会话最多 20 个连接。
- 切换实例时必须同时切换 URL、身份、HTTP Client、Skip TLS 和 demo 状态。
- 项目、权限、缓存、统计、搜索结果和未完成请求不得跨实例泄漏。
- 进程重启会使所有连接失效，这是当前设计的预期行为。

## 4. 安全设计

### 4.1 信任边界

1. 浏览器到控制台：依赖控制台会话、同源写入校验、请求大小限制和安全响应头。
2. 控制台到 Harbor：使用服务器端 Basic Auth、固定 API 映射、同源重定向和响应大小限制。
3. 未登录公开目录：允许用户提供 Harbor 根地址，由服务端调用三个固定匿名 GET 接口。这仍是 SSRF/egress 信任边界，部署环境必须用 DNS、IP 白名单、网络策略或防火墙限制目标。

### 4.2 固定安全约束

- 请求体最大 1 MiB，Harbor 响应最大 8 MiB，查询字符串最大 8 KiB。
- 连接 URL 只能是 `http://` 或 `https://` 根地址，不得包含用户信息、路径前缀、查询或片段。
- 上游重定向最多三次，并且只能保持相同协议和主机。
- TLS 最低版本为 1.2。
- Skip TLS 只对选中的连接生效，并必须明确展示风险。
- 写操作需要有效会话和同源 Origin。
- Cookie 必须是 `HttpOnly`、`SameSite=Strict`，HTTPS 下设置 `Secure`。
- 密码、Authorization、Cookie、Token、CLI Secret 不得进入 URL、浏览器存储、日志、截图或文档。
- 删除和其他破坏性操作必须显示目标资源名并二次确认；可用时先执行 Harbor 官方预检。

## 5. 前端架构

### 5.1 运行模型

前端使用 React 19、TypeScript 和 Vite 生产构建。源码位于 `frontend/`，构建时生成 `internal/webui/assets/`，由 Go `embed` 打包；`assets` 是可删除重建的产物目录，禁止手写。运行时不加载 CDN、远程字体或 npm 模块。

当前迁移实现已经完成全量 React 重写：`main.tsx` 直接挂载 `LocaleProvider` 与 `ReactApplication`，会话、hash 路由、应用外壳、领域页面、Dialog 和全局 overlay 均由 typed React 组件管理。`frontend/public/runtime/`、classic script renderer、HTML parser 和 preview 入口均已删除，生产入口只加载 Vite 生成的 hashed bundle。`internal/webui/` 只包含 `embed.go` 和可删除重建的 `assets/`，不得保存历史测试、手写脚本或其他运行时源码。

当前 React 运行模型：

1. `main.tsx` 只挂载 locale provider、根组件和全局样式。
2. `frontend/src/app/react-application.tsx` 管理会话、路由和应用装配；领域页面与写操作按 `frontend/src/features/<domain>/` 拆分。
3. `frontend/src/components/` 提供共享 icon、select、dialog、table、pagination、loading/error、status badge 与页面元素；`frontend/src/layouts/` 管理应用 shell 和全局 overlay。领域页面只能复用这些 primitive，不能复制基础控件。
4. 所有请求经类型化 API helper 发出，使用 `AbortController` 取消过期请求；请求参数和写入 body 必须与 `controlSpecs` / `resourceSpecs` 的稳定 v2.15.2 合同逐项对应。
5. Vite 仅打包开发依赖；Go 二进制只嵌入静态产物。
6. TypeScript 强制报告未使用的局部声明和参数；生产代码不得保留迁移占位字段、废弃函数或兼容分支。

### 5.1.1 React 迁移的视觉不变条件

React 是实现方式变更，不是产品重设计。迁移以 `e75001f` 中的 Harbor Console Web UI 为视觉与交互基线；目标实现不保留旧原生 HTML/JS 运行时，但必须在 React 中保留以下可观察行为：

- 登录页、侧栏、顶栏、页面信息层级、导航分组、文本层级、颜色、间距、响应式断点和暗色主题。
- 搜索、实例切换、通知/操作中心、账号面板、移动导航、toast、dialog 与焦点恢复。
- 原有的 loading、empty、error、权限、hover、focus、reduced-motion 和进入/退出动画。
- 所有列表的筛选、排序、分页、表格局部滚动、视图切换、批量选择和写操作确认。
- 简体中文与英文的同等覆盖范围；翻译不能只覆盖登录页或导航。

默认不得改变已有字体、排版、按钮、图标、文案、动效或交互路径。唯一允许的视觉例外是同类型组件在旧界面中存在可证明的不一致时，可以复用同一个共享 primitive 做小范围统一；该例外必须保持信息层级和工作流不变，并同时记录迁移前差异、修改原因和双语/多视口浏览器证据，不能借此重新设计页面。

`frontend/src/styles/` 是迁移后的视觉契约来源，只包含设计 token、布局、控件与动效规则。React feature 不依赖 `innerHTML`、全局事件分发或兼容运行时；组件必须输出与该契约对应的语义结构，不能为了“更现代”而改写界面。

浏览器视觉 Gate 分为两层：迁移前基线与 React 在同一路由/语言/视口下做视觉和结构对照；当前 React 生产入口再在 Chromium、Firefox 和 WebKit 中执行全页面矩阵，防止浏览器特有的换行、焦点和原生行为差异。

### 5.2 字体系统

过去出现过同一页面字体不同、原生表单使用系统默认字体、中文与英文切换后字重和行高变化导致重叠的问题。当前设计要求：

- 正文字体只使用 `--font-body`：`Avenir Next`、`PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`sans-serif`。
- 代码、ID、摘要和数字场景只使用 `--font-mono`。
- `button`、`input`、`select`、`textarea` 和自定义控件必须显式 `font: inherit`。
- 全局 `letter-spacing` 固定为 `0`，不通过负字距挤压文本。
- 不加载远程 Web Font，不假设某个平台一定存在某个字体。
- 组件不得私自定义新的正文 `font-family`。
- 数字对齐使用 `font-variant-numeric: tabular-nums`，不能靠空格补齐。
- 双语标题、摘要、表单提示和工具栏必须为较长语言预留高度或允许换行，不能只按中文长度定高。

### 5.3 控件系统与浏览器一致性

浏览器原生单选下拉在 macOS、Windows、Chrome、Safari 和 Firefox 中存在字体、箭头、菜单高度、焦点和定位差异。当前规则是：

- 所有普通单选控件只通过共享 React `UnifiedSelect` primitive 渲染，统一高度、字体、边框、焦点、菜单和 disabled 状态。
- `UnifiedSelect` 使用受控 button/listbox 结构提供 ARIA 语义；需要参与表单提交时通过同名 hidden input 输出当前值，不依赖原生 `<select>` 或 DOM 增强器。
- typed React 源码中禁止出现原生 `<select>`；架构合同会阻止其重新进入生产代码。
- 未来如需多选或列表框，必须新增或复用独立的共享可访问 primitive，并单独完成键盘、表单和跨浏览器验收。
- 禁止在单个页面再实现第二套下拉菜单、分页选择器或筛选 picker。
- `UnifiedSelect` 必须支持方向键、Home、End、Escape、焦点恢复、disabled、空选项和选中态同步。
- `UnifiedSelect` 的菜单必须 portal 到全局浮层 owner，使用 fixed 定位脱离 table、panel、dialog 等祖先的 overflow 裁切；打开和滚动/缩放时根据 visual viewport 上下空间自动翻转，并以统一 viewport padding 和最大高度保证菜单完整可见。
- 页面不得通过分页专属 `top`/`bottom`、负 offset、提高单页 z-index 或取消容器 overflow 来修复下拉裁切。定位、碰撞处理、滚动跟随和横向边界只能由共享 select primitive 管理。

输入框、按钮、下拉、分页和搜索框必须复用共享高度、圆角、边框、焦点和间距 token。页面样式不得重新定义基础 form primitive。

### 5.4 布局稳定性与防塌陷规则

“塌陷”通常来自 flex/grid 子项默认 `min-width:auto`、滚动所有权错误、固定列没有稳定尺寸、动态文本未预留空间，或父容器高度链不完整。所有新布局必须遵守：

- 可收缩的 flex/grid 子项显式设置 `min-width: 0`。
- 内部滚动区域处于 flex/grid 高度链时显式设置 `min-height: 0`。
- 等分列使用 `minmax(0, 1fr)`，不能只写 `1fr` 后假设长文本会收缩。
- 固定格式控件使用稳定的 `width`、`height`、`min-width`、`min-height`、`aspect-ratio` 或固定 grid track。
- 长资源名、URL、digest、annotation 和日志使用 `overflow-wrap:anywhere`、可控省略或局部滚动。
- 省略文本必须保留 `title` 或等效完整查看方式。
- 页面级 `overflow-x` 不得成为常规解决方案；表格、日志、命令和详情应由自身容器承担滚动。
- 工具栏必须 `flex-wrap`，密集工具栏优先使用 container query，而不是只依赖 viewport media query。
- 侧栏固定于 viewport，侧栏导航独立滚动，主内容滚动不得带动侧栏内容消失。
- 移动端 dialog 的内容区独立滚动，头部、底部操作和关闭按钮必须可达。

### 5.5 表格与数据密度

- 数据表必须位于 `.table-scroll` 或同类局部横向滚动容器内。
- 需要保持可读性的表格设置稳定 `min-width`，移动端通过局部滚动查看，不把每列压成不可读宽度；共享稳定表格的最小宽度不得低于 `max(100%, 760px)`，可排序表头的可见区域和点击区域不得与相邻列重叠。
- ID 列、时间列、状态列、动作列采用统一对齐规则。
- 仓库数、制品数、拉取数等指标至少预留 `5ch`，使用等宽数字并居中。
- 时间列保持单行并使用 tabular numbers。
- 所有用户可操作的列表排序入口必须位于对应可排序列的表头。取消工具栏、筛选区或页面其他位置的独立排序 select/button；这表示取消重复排序入口，不是取消排序能力。
- 排序合同同时声明字段来源。Harbor 持久化模型字段可以由服务端排序；API 在查询后装配的 `Project.repo_count`、`Repository.artifact_count`、关联名称或聚合状态必须读取完整权限范围数据后在前端排序，再执行分页。
- 可排序表头使用共享按钮，并在列名旁显示上下两个小三角。未排序时两个方向均可辨认但保持弱化；升序或降序时只突出当前方向。按钮必须暴露当前排序状态和可访问名称。
- 居中列的视觉中轴以“列名文字本身”为准，不能把“列名 + 排序指示器”作为整体居中后让列名偏离列轴。共享可排序表头必须在指示器另一侧保留等宽平衡空间，表头列名、表头单元格、首行内容和表体单元格的中心偏差均不得超过 1px。
- 点击表头至少支持升序与降序切换；是否允许回到接口默认顺序由共享表格组件统一决定，领域页面不得各自实现不同循环。
- 表头排序按钮使用 `font: inherit`，不能因为 button 默认字体导致表头字体突变，也不能改变列名原有对齐和表头高度。
- 所有列表底部分页使用同一 footer 结构。左侧信息按“第 xx-xx 项，共 xx 项”后紧接“每页 50 条”选择器；页码、上一页和下一页保留在右侧。窄屏允许逻辑组换行，但语义顺序不能变化。
- 每页条数选择器只允许出现在表格左下角 footer，不得继续放在筛选工具栏、右侧分页按钮组或页面顶部。
- 分页 footer 的当前页/总页数文本必须可点击；关闭态保持既有文本样式，点击后隐藏原页码并在原位置仅显示空白输入位与短灰色底线，用户输入的数字使用橙色且不得出现选中文字背景、边框或阴影。回车跳转并将输入值钳制到 `1..totalPages`，Escape 或点击外部取消且不改变当前页。标准列表和 Dialog 内分页统一复用同一 primitive。
- 不允许把所有列强制 `white-space:nowrap`；资源名称列需要根据内容策略省略或换行。
- 表格中的图标按钮和排序按钮必须有稳定尺寸和可访问名称，不能因加载状态或 label 变化推动列宽；360/390 窄屏下点击任一排序表头必须命中其声明字段。
- 表头和表体必须复用 `table-cell-center`、`table-cell-number`、`table-cell-time` 等语义对齐类，并按列成对声明；可排序表头声明了语义类时，对应所有数据行的 `<td>` 必须声明同一语义类。禁止依赖 `nth-child`、页面专属 margin/transform 或只给 `<th>` / `<td>` 单边加 class 来制造对齐。
- 状态、可见性和其他 badge 内容的视觉中轴以实际 badge 盒模型为准；验收必须同时测量表头列名、表头单元格、首行 badge 和表体单元格中心，任一绝对偏差超过 1px 即失败。
- 项目和镜像仓库列表的名称单元格不显示仅用于装饰的灰色图标或黄色文件夹图标。只有图标承担状态、资源类型消歧或可操作语义时才允许保留，并必须有明确验收依据。
- 复制执行详情中的源/目标资源值使用独立的固定列和最多两行省略文本，单元格保留 `title` 完整查看入口；不得让长值改变操作、状态或时间列的宽度。
- 复制执行详情的操作列、状态列和日志列必须使用稳定宽度与明确中轴；短操作文案保持单行，状态 badge 以实际 badge 盒模型居中。
- 复制执行详情的开始/结束时间列复用 `table-cell-time`，保持单行并使用 tabular numbers；移动端只允许任务表自身横向滚动，不能产生页面级溢出。

### 5.6 文本重叠与双语稳定性

- 任何固定高度元素都必须验证中文、英文、长资源名、125%/150% 页面缩放和系统字体替换。
- 登录页双语标题与摘要使用固定行结构和最小高度，语言切换不得推动表单上下跳动。
- 按钮文字需要保持单行时，按钮必须拥有足够稳定宽度；否则允许换行并增加高度。
- 标签、badge 和状态项使用 `inline-flex`、固定图标尺寸和合理 `line-height`。
- 禁止用绝对定位堆叠普通正文来达到视觉对齐。
- 禁止使用负 margin 或 transform 长期掩盖文字碰撞。
- 翻译必须在渲染时完成，不允许用全局 DOM 正则替换用户输入、资源名或日志。

### 5.7 交互、焦点和动画

- Harbor 品牌标识统一复用生产 `favicon.svg`，登录页、公开目录和应用侧栏不得各自绘制不同品牌图形。实例切换只有顶栏一个可见 owner；侧栏品牌下直接进入主导航，不重复展示当前实例卡片。
- 搜索、移动导航、通知面板、账号面板、实例切换器和 dialog 关闭后必须把焦点还给仍在 DOM 中的打开控件。
- 所有键盘可操作元素必须有可见 `:focus-visible`。
- 所有一级页面路由必须使用同一套线性进入动画，不能只有概览和项目中心有动画，而镜像仓库、制品安全、复制管理、P2P 分发、审计日志、管理中心、系统状态等后续入口静态出现。
- 一级 route motion 只能由 `ApplicationShell` 的路由内容 owner 执行。领域页面不得再次添加 `motion-route-enter`，否则相同导航会出现双重动画和不一致节奏。
- 页面路由切换使用共享的轻微水平进入；页内 tab、筛选结果、列表/卡片视图和复制策略/执行记录切换使用共享内容淡入，不移动 page header、tab 导航或其他页面框架。
- 动画时长、距离、delay、stagger 和 timing function 只能来自 motion token。领域页面不得自行增加另一套 keyframes，也不得因为 React 条件渲染遗漏进入类。
- 同一次交互只允许内容 owner 执行一次进入动画，禁止父子层重复动画造成闪烁、延迟叠加或点击后空白。
- 过滤、tab 切换和局部刷新应保留稳定 page chrome，避免整页 `innerHTML` 替换造成闪烁、滚动丢失和布局重排。
- 排序、筛选、分页与后台刷新不得改变内容 owner 的 React identity，也不得重播进入动画。完整 query、排序值、页码和请求完成计数不能作为动画容器 `key`；已有数据在重新校验期间保持挂载。
- 需要进入页面后扇出请求的一级路由，必须在首帧渲染稳定的 header、统计区和内容容器；数据完成后只能更新既有结构并使用共享 content motion，禁止通过条件渲染整段插入统计区造成布局闪烁。有限并发必须采用完成即补位的 worker pool，不能按固定批次等待整批完成后才继续。
- 所有动画必须尊重 `prefers-reduced-motion`。
- 动画不得改变最终布局尺寸，也不得在动画结束后残留 pending class、`aria-busy` 或不可点击状态。

### 5.7.1 空状态

- “没有数据”“暂无实例”“没有匹配结果”等状态统一使用共享 empty-state primitive，在所属 panel、table body 或内容区的水平和垂直中部展示。
- 空状态由可选语义图标、短标题和辅助说明构成，三者整体居中对齐并保持稳定间距；不得像普通表格行一样贴左排列，也不得把图标、粗体标题和说明挤在同一行。
- 居中是相对于当前内容 owner，不是强制相对于整个 viewport。空状态区域必须有合理且统一的最小高度，同时不能制造大面积无意义留白或把后续内容推出视口。
- 过滤无结果、资源确实为空、权限不足、加载失败是不同状态，文案、角色和操作不能混用。错误状态不得伪装成空状态。
- 空状态在桌面、移动、中英文和长说明文本下不得改变 panel 宽度、产生页面级横向滚动或遮挡可用操作。

### 5.8 项目中心

- 主导航和页面标题中的“项目”统一为“项目中心”；原“镜像资产”统一为“镜像仓库”。英文词典使用对应产品语义，不允许通过 DOM 后处理替换文案。
- 项目中心列表上方恢复四个概览指标：项目总数、仓库数量、自动扫描覆盖、漏洞阻止覆盖。指标属于页面信息架构的一部分，不得放入 dialog、tooltip 或折叠区域替代。
- 项目总数和仓库数量只统计当前账号可见的权威 Harbor 数据。自动扫描覆盖和漏洞阻止覆盖以当前账号可见项目为统计范围，显示启用数量与覆盖率；总项目数为 0 时覆盖率显示 `0%`，不得显示 `NaN`、无穷或虚构数据。
- 四个指标必须复用同一概览 primitive，保持相同高度、标题层级、数字对齐、响应式行为和加载/错误状态。不得为了恢复指标引入新的卡片视觉语言。
- 项目中心筛选区的“项目所有者”控件使用有上限的紧凑宽度，不参与无界 flex 扩张；“项目所有者”和“可见性”在同一行时必须共享相同控件高度和垂直中轴。
- 控件对齐必须先检查 computed height、line-height、上下 padding、border、图标盒模型和父级 align-items，根因收敛到共享 form/control token。禁止使用页面专属 margin、top、translate 或零散像素补偿完成视觉对齐。
- 项目名称和镜像仓库名称列删除无业务语义的前置资源图标，文本、次级信息、点击区域和键盘可达性保持不变。

### 5.9 列表视图、筛选与数量摘要

- 原“镜像资产”改名后的跨项目镜像仓库页面必须同时提供列表和卡片两种展示，右侧复用项目内镜像仓库已有的共享 `ViewModeToggle`。不得为同一功能制作第二套按钮。
- 列表/卡片切换保留当前筛选、排序、分页和滚动 owner，并使用共享内容进入动画；切换按钮保持稳定尺寸、图标、active、hover、focus 和 `aria-pressed` 状态。
- 所有存在筛选条件的列表在筛选生效后显示明确的“取消筛选”操作。取消后恢复默认筛选并回到第一页，但保留视图模式、每页条数以及仍然有效的排序状态。
- 没有活动筛选时不显示无意义的取消按钮。搜索、select、复合查询和 URL query 都必须由同一 active-filter 判定覆盖，不能只检查搜索框文字。
- 有明确列表总数的 section heading 应显示权威总数摘要，例如“镜像仓库 xx 个”“审计日志 xx 条”“用户 xx 个”“用户组 xx 个”“机器人账号 xx 个”。该规则适用于全部可合理增加的列表，不限于示例页面。
- 数量摘要使用服务端 pagination total 或完整权限范围内的权威聚合，不得使用当前页长度冒充总数；加载中、权限不足或请求失败时不得显示过期数字。
- 标题、数量、量词和复数规则由共享 heading/count primitive 与 locale formatter 统一，不能在页面中手写不同字号、灰度、间距或中英文拼接方式。

### 5.10 P2P Provider 展示

- 官方 Provider 区域只显示 Dragonfly、Kraken 等产品名称或稳定标识，不在卡片中展示版本号。
- 隐藏版本号是为了避免界面暗示控制台只支持某个固定 Provider 版本；不得用硬编码版本、fixture 版本或默认版本替代上游值。
- Provider 能力、实例配置和真实兼容边界仍以 Harbor 返回及网关合同为准，删除展示版本不等于放宽 API 校验。
- “暂无 P2P 实例”使用全局共享居中空状态，不得保留截图中贴左、图标与说明挤成一行的布局。

## 6. 国际化设计

- 中文是源语言，英文词典和 locale provider 位于 `frontend/src/app/locale-context.tsx`，翻译在 React 渲染阶段完成。
- 动态 label、状态、排序项、校验、toast、空状态和错误状态必须进入字典。
- Harbor 资源名、用户输入、原始日志和上游错误详情保持原文。
- 日期格式必须始终包含年份；缺失、非法和 Go 零时间显示本地化空值，不能显示公元 1 年。
- 中英文切换后必须重新检查布局，不能只检查字符串是否存在。

## 7. Demo 设计原则

- Demo 是真实网关行为的可交互替身，不是绕开上游合同的第二套产品逻辑。
- 每个写操作应支持 create/read/update/delete 或对应生命周期。
- Demo 必须覆盖成功、空、权限、错误、长文本和多状态数据。
- Demo 响应字段、分页和状态码语义应尽量与 Harbor 一致。
- 只在 demo 可用、真实 Harbor 不可用的功能不能宣称完成。

## 8. 架构决策摘要

| 决策        | 当前结论                            | 主要原因                                                                    |
| ----------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Harbor 网关 | 固定类型化映射                      | 限制 SSRF、越权路径和版本漂移                                               |
| 认证        | Basic Auth / CLI Secret             | 兼容多实例，不暴露 Harbor Cookie 或 Token                                   |
| 部署        | 单个静态 Go 二进制                  | 便于内网部署，前后端版本一致                                                |
| 后端结构    | 模块化单体                          | 明确职责，同时避免无价值公共接口                                            |
| 前端技术    | React + TypeScript + Vite，迁移完成 | typed feature、共享组件、生产入口与视觉验收均已落地，classic runtime 已删除 |
| 下拉控件    | 统一 React select primitive         | 统一尺寸、焦点与跨页面样式，不引入重复实现                                  |
| API 范围    | 198 个非废弃 v2.15.2 operation      | 不让 deprecated 兼容负担污染当前设计                                        |

## 9. 设计变更规则

出现以下任一情况时，必须先更新本文档：

- Harbor 版本或 API operation 基线变化。
- 引入 OIDC、共享会话、数据库、消息队列或多个部署单元。
- 新增任意代理、公开出站访问或新的凭据存储方式。
- 引入前端框架、bundler、远程资源或 Web Font。
- 改变 CSS/JS 加载顺序、全局字体、共享控件或响应式策略。
- 改变验收视口、发布 Gate 或 P0/P1 判定标准。

设计变更必须同步记录到 `CHANGELOG.md`，实现步骤写入 `IMPLEMENTATION.md` 对应章节，验收项写入 `ACCEPTANCE.md`。
