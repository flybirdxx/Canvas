---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: 'complete'
completedAt: '2026-05-05'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
---

# Canvas - Epic Breakdown

## Overview

Decomposing V1 requirements from PRD and Architecture into implementable epics and stories. MVP is delivered. V1 focuses on 8 F-IDs: chain execution engine, run panel, storyboard dual-view, script node, alignment/grouping, multi-format export, template save, Tauri desktop.

## Requirements Inventory

### Functional Requirements (V1 — to implement)

- FR1: [V1] 移动/缩放节点时，边缘和中心与邻近节点在 4px 内自动吸附，显示参考线
- FR2: [V1] 框选多节点，Ctrl+G 成组，Ctrl+Shift+G 解组。组可整体拖拽
- FR12: [V1] image 节点开启局部重绘模式，框选区域生成蒙版
- FR16: [V1] 选中含连线子图点"运行"，按拓扑序依次执行。有环拒绝运行
- FR17: [V1] 节点五状态：idle / queued / running / success / failed
- FR18: [V1] 运行失败不阻断其他分支。可局部重跑失败节点
- FR24: [V1] 运行面板：实时日志、节点进度条、耗时、取消按钮
- FR25: [V1] 一键取消所有进行中任务
- FR26: [V1] 剧本节点，Markdown 格式，`### 场 N` 自动识别为分镜锚点
- FR27: [V1] 画布/分镜双视图切换，卡片网格展示 scene 节点
- FR28: [V1] 双视图数据互通
- FR33: [V1] 当前画布布局保存为自定义模板
- FR35: [V1] 导出 SVG / PDF / HTML 独立网页
- FR36: [V1] 分镜模式按 scene 顺序导出拼接 MP4
- FR37: [V1] 导出含画布 JSON + 素材的 ZIP
- FR44: [V1] Windows/Mac 桌面独立窗口运行，支持本地文件关联打开
- FR45: [V1] `.canvas` 文件与桌面应用关联

### Non-Functional Requirements

- NFR1-NFR5: 性能预算（55fps, 2.5s cold, P95 25s/90s, 100ms write）
- NFR6-NFR9: 安全（Key 加密存储, 导出剔除 Key, 直连 Provider, 遥测本地）
- NFR10-NFR12: 存储（500 节点/500MB, 大对象独立存储, 异步持久化）
- NFR13-NFR14: 可访问性（WCAG AA DOM 层）
- NFR15: i18n（当前 zh-CN）

### Additional Requirements (Architecture)

- AD1: 链式执行引擎 → 独立 `useExecutionStore`（不 persist）
- AD2: 分镜双视图 → `StoryboardView` 平级组件
- AD3: 运行面板 → Zustand subscribe 事件驱动
- AD4: 多格式导出 → 各自独立 util
- 所有 V1 新增组件遵循 `project-context.md` 的 58 条实现规则

### UX Design Requirements

未找到 UX Design 文档。

### FR Coverage Map

| FR | Epic | 说明 |
|----|------|------|
| FR1 | Epic 3 | 对齐吸附 |
| FR2 | Epic 3 | 多选成组 |
| FR12 | Epic 5 | 局部重绘 |
| FR16-18 | Epic 1 | 链式运行引擎 |
| FR24-25 | Epic 1 | 运行面板 |
| FR26-28 | Epic 2 | 叙事分镜 |
| FR33 | Epic 4 | 模板保存 |
| FR35-37 | Epic 4 | 多格式导出 |
| FR44-45 | Epic 6 | 桌面壳 |

## Epic List

### Epic 1: 链式运行引擎
用户选中含连线子图点"运行"，系统按拓扑序依次执行每个节点。运行面板实时显示进度和日志。失败节点不阻断其他分支。这是"可视化工作流引擎"的核心兑现。
**FRs covered:** FR16, FR17, FR18, FR24, FR25

### Epic 2: 叙事分镜
用户粘贴剧本文字，系统自动识别 `### 场 N` 为分镜锚点。一键切换画布/分镜网格双视图。双视图数据互通——任一处修改反映到另一处。
**FRs covered:** FR26, FR27, FR28

### Epic 3: 画布交互增强
节点移动/缩放时边缘中心自动吸附邻近节点，显示紫色参考线。多选节点可 Ctrl+G 成组、整体拖拽。
**FRs covered:** FR1, FR2

### Epic 4: 多格式导出 + 模板
画布内容导出为 SVG/PDF/HTML 独立网页，分镜模式导出拼接 MP4，导出含全部素材的 ZIP。当前画布布局可保存为自定义模板。
**FRs covered:** FR33, FR35, FR36, FR37

### Epic 5: 局部重绘
在 image 节点上框选区域生成 PNG 蒙版，支持 inpainting——AI 仅重绘蒙版覆盖区域。
**FRs covered:** FR12

### Epic 6: 桌面壳
Windows/Mac 独立窗口运行（Tauri），`.canvas` 文件与桌面应用关联。
**FRs covered:** FR44, FR45

## Epic 1: 链式运行引擎

用户选中含连线子图点"运行"，系统按拓扑序依次执行每个节点。运行面板实时显示进度和日志。失败节点不阻断其他分支。这是"可视化工作流引擎"的核心兑现。

**FRs covered:** FR16, FR17, FR18, FR24, FR25

### Story 1.1: executionEngine — 拓扑排序 + 环检测

As a 用户,
I want 选中含连线子图后系统自动按拓扑序排列执行顺序并拒绝有环图,
So that 我的工作流按正确的依赖顺序执行，不会因环形依赖导致死锁。

**Acceptance Criteria:**

**Given** 画布上存在 3 个节点 A→B→C（A 输出连线到 B 输入，B 输出连线到 C 输入）
**When** 用户选中 A、B、C 三个节点并点击"运行"
**Then** executionEngine 返回拓扑排序结果 [A, B, C]，执行顺序为 A→B→C
**And** 每个节点在开始执行前状态自动设为 queued

**Given** 画布上存在 3 个节点形成环 A→B→C→A
**When** 用户选中这三个节点并点击"运行"
**Then** executionEngine 检测到环，拒绝运行
**And** 用户看到错误提示"检测到循环依赖，无法执行"

**Given** 画布上存在 5 个节点的复杂 DAG（含分支和汇合）
**When** 用户选中全部节点并点运行
**Then** 拓扑排序结果满足所有依赖关系（上游先于下游）
**And** 无依赖关系的并行分支节点获得相同的拓扑层级

**Given** 用户选中了 1 个孤立节点（无线连）
**When** 点击"运行"
**Then** 该节点单独作为一个执行单元，无拓扑排序需求
**And** 正常进入执行队列

**Given** 用户选中了空选区（0 个可执行节点）
**When** 点击"运行"
**Then** 系统提示"未选中可执行节点"
**And** 不创建任何执行任务

### Story 1.2: useExecutionStore — 节点五状态机

As a 用户,
I want 每个参与运行的节点在 idle / queued / running / success / failed 五状态间正确流转,
So that 我能清楚看到每个节点的执行进度，出问题时快速定位。

**Acceptance Criteria:**

**Given** 一个执行计划包含 3 个节点
**When** executionEngine 提交执行计划到 useExecutionStore
**Then** 所有节点初始状态为 idle
**And** executionStore 创建一条 execution 记录，包含唯一 execId、节点列表、拓扑顺序、创建时间

**Given** 节点 A 拓扑排序第一位
**When** 执行引擎开始处理节点 A
**Then** 节点 A 状态流转为 idle → queued → running
**And** 状态变更通过 Zustand subscribe 通知订阅者

**Given** 节点 A 执行中
**When** AI 生成成功返回结果
**Then** 节点 A 状态流转为 running → success
**And** executionStore 记录该节点的耗时（开始到结束的毫秒数）

**Given** 节点 B 执行中
**When** AI 生成返回错误（如 API 限流、网络超时）
**Then** 节点 B 状态流转为 running → failed
**And** executionStore 记录错误信息（错误类型、消息、时间戳）
**And** 不影响同层其他无依赖节点的执行

**Given** 一个节点当前状态为 running
**When** 外部尝试将其直接设为 success（跳过 running）
**Then** 状态机拒绝非法转换
**And** 记录警告日志（实际状态 vs 预期状态）

**Given** 所有节点执行完毕（全部 success 或 success + failed 混合）
**When** 最后一个节点状态变更
**Then** executionStore 标记该 execution 为 completed
**And** 计算总耗时

**Given** 用户刷新页面
**When** 页面重新加载
**Then** useExecutionStore 为空（transient store，不 persist）
**And** 之前的执行状态不恢复

### Story 1.3: RunPanel — 实时运行面板

As a 用户,
I want 一个实时运行面板显示所有执行中节点的进度、日志和耗时,
So that 我不需要猜测后台发生了什么，能随时掌握运行状态。

**Acceptance Criteria:**

**Given** 有一个正在进行的执行任务
**When** 用户打开运行面板
**Then** 面板显示执行概览：总节点数、已完成数、运行中数、失败数、总耗时（秒级实时更新）
**And** 每个节点一行：节点名称、当前状态图标（⏳queued / 🔄running / ✅success / ❌failed）、该节点耗时

**Given** 节点 A 正在执行
**When** AI 生成过程中产生日志
**Then** 运行面板的日志区域实时追加日志条目
**And** 每条日志包含时间戳、日志级别（info/warn/error）、节点标识、消息内容
**And** 日志区域自动滚动到最新条目

**Given** 运行面板已显示 500+ 条日志
**When** 新日志继续产生
**Then** 面板渲染不卡顿（虚拟滚动或上限截断旧日志）
**And** 用户可手动清空日志

**Given** 没有正在进行的执行任务
**When** 运行面板打开
**Then** 显示空状态："暂无运行任务"
**And** 提示"选中节点后点击运行开始"

**Given** 运行面板当前折叠/关闭
**When** 用户触发一次新的执行
**Then** 运行面板自动展开/打开
**And** 用户焦点不强制转移到面板

**Given** 同时存在 2 个独立的执行（execId-1 和 execId-2）
**When** 用户查看运行面板
**Then** 面板以标签页或折叠组形式展示两个执行
**And** 各自独立显示进度和日志

### Story 1.4: 一键取消 + 局部重试

As a 用户,
I want 一键取消所有进行中任务，并且能单独重跑失败的节点,
So that 发现 prompt 写错或模型选错时能立刻止损，而不是等待所有任务跑完。

**Acceptance Criteria:**

**Given** 当前有 3 个节点正在 running
**When** 用户点击运行面板中的"全部取消"按钮
**Then** 所有 running 节点收到 AbortSignal
**And** 节点状态从 running 变为 idle（恢复到可重新执行状态）
**And** queued 状态的节点也全部取消回到 idle
**And** 已完成的 success/failed 节点不受影响
**And** "全部取消"按钮在无 running/queued 节点时 disabled

**Given** 某次执行中有 2 个节点 failed
**When** 用户对其中一个 failed 节点点击"重试"
**Then** 该节点状态从 failed 变为 queued → running
**And** 仅重新执行该节点及其下游依赖节点（拓扑排序自该节点起）
**And** 已成功的上游节点不重新执行

**Given** 3 个节点正在 running，用户点击"全部取消"
**When** 某个节点的 AI 请求已发出但尚未收到响应
**Then** AbortSignal 触发 fetch 中断
**And** 该节点状态显示为 cancelled（短暂）后回到 idle
**And** 已发出的请求被 abort（不浪费带宽等待响应）

**Given** 用户重试一个 failed 节点
**When** 该节点重试后仍然 failed
**Then** 再次显示为 failed，用户可继续重试
**And** 失败计数显示（如"已重试 2 次"）

**Given** 全部节点执行完毕后
**When** 用户查看运行面板
**Then** 面板底部显示"重新运行全部"按钮
**And** 点击后清空当前 execution，重新提交拓扑执行

### Story 1.5: 与生成管线集成

As a 用户,
I want 运行引擎调用现有的 AI 生成能力,
So that 我的连线工作流不只是静态图示，而是真正驱动 AI 生成的执行引擎。

**Acceptance Criteria:**

**Given** 用户选中 text 节点→image 节点→image 节点的子图
**When** 点"运行"提交执行
**Then** executionEngine 拓扑排序后，按序对每个可生成节点调用现有的 `runOneSlot`
**And** text 节点是纯输入（无生成），被跳过但内容通过 flowResolver 传给下游

**Given** image 节点执行中
**When** `runOneSlot` 返回成功
**Then** replacePlaceholderWithImage 正常替换节点
**And** executionStore 更新节点状态为 success

**Given** image 节点执行中
**When** `runOneSlot` 返回错误
**Then** 节点状态更新为 failed
**And** 错误信息写入该节点的日志
**And** 其他无依赖关系的分支节点继续执行

**Given** 一个子图中包含不支持运行的节点类型（如 sticky、rectangle）
**When** 用户点"运行"
**Then** 不支持运行的节点被跳过（不报错）
**And** 仅对 text（prompt 输入）和 image/video/audio（可生成）节点触发生成

**Given** 用户已在运行面板中监控执行
**When** 生成过程中 user 手动取消
**Then** 运行引擎通过 AbortSignal 通知 `runOneSlot`
**And** 生成管线清理中间状态（移除 aigenerating 占位节点）

**Given** 当前 generationQueue 中有未完成的生成任务
**When** 用户通过运行引擎提交新的执行
**Then** 新执行任务排队等候，不干扰正在进行的生成
**And** 运行面板区分显示"队列中的生成"和"运行引擎的执行"

## Epic 2: 叙事分镜

用户粘贴剧本文字，系统自动识别 `### 场 N` 为分镜锚点。一键切换画布/分镜网格双视图。双视图数据互通——任一处修改反映到另一处。

**FRs covered:** FR26, FR27, FR28

### Story 2.1: 剧本节点 — Markdown 解析 + 锚点识别

As a 视频创作者,
I want 粘贴 Markdown 格式剧本后系统自动识别 `### 场 N` 为分镜锚点,
So that 我不需要手动创建每个 scene 节点，剧本结构直接变成可操作的分镜列表。

**Acceptance Criteria:**

**Given** 用户创建一个新的剧本节点
**When** 节点以编辑模式打开
**Then** 显示 Markdown 编辑区（textarea 或简易编辑器）
**And** 支持粘贴纯文本和 Markdown 格式内容
**And** 节点类型注册到 `CanvasElement` 类型系统中

**Given** 用户粘贴包含 3 个场次的剧本：
```
### 场 1：咖啡厅相遇
主角进入咖啡厅...
### 场 2：雨中追逐
雨夜的街道上...
### 场 3：天台对话
城市天台上...
```
**When** 解析器分析内容
**Then** 识别出 3 个分镜锚点：场 1、场 2、场 3
**And** 每个锚点包含：场次编号、标题、对应段落文本
**And** 锚点数据存储在该剧本节点的 `scenes` 属性中

**Given** 剧本不含 `### 场 N` 格式标题
**When** 解析器分析内容
**Then** 返回空锚点列表
**And** 节点仍可保存纯文本，作为普通 Markdown 笔记使用

**Given** 剧本包含嵌套标题（`## 幕` 下含 `### 场 N`）
**When** 解析器分析内容
**Then** `### 场 N` 仍然被正确识别为分镜锚点
**And** `## 幕` 层级信息保留作为分组标签

**Given** `### 场 N` 标题后的段落为空（只有标题）
**When** 解析器分析内容
**Then** 该锚点仍被创建，内容标记为空
**And** 后续用户可手动补充内容

**Given** 用户在剧本节点编辑器中修改文本
**When** 用户保存（失焦或 Ctrl+S）
**Then** 解析器重新分析，更新锚点列表
**And** 新增/删除的场次同步反映到分镜视图（如果已创建对应 scene 节点）

### Story 2.2: 画布/分镜视图切换

As a 用户,
I want 在 TopBar 一键切换画布视图和分镜视图,
So that 两种工作模式之间无缝切换，不被工具打断创作流。

**Acceptance Criteria:**

**Given** 用户当前在画布视图
**When** 点击 TopBar 中的"分镜模式"按钮（或使用快捷键）
**Then** 画布淡出，分镜网格淡入（过渡动画 ≤ 300ms）
**And** `useCanvasStore.viewMode` 从 `'canvas'` 切换为 `'storyboard'`
**And** URL hash 或 state 记录当前视图

**Given** 用户当前在分镜视图
**When** 点击 TopBar 中的"画布模式"按钮
**Then** 分镜网格淡出，画布淡入
**And** viewMode 切换回 `'canvas'`
**And** 画布恢复切换前的视口位置（scale/x/y 不变）

**Given** 用户上次关闭页面时在分镜视图
**When** 重新打开页面
**Then** viewMode 从 persist 恢复，直接显示分镜视图
**And** 运行引擎和生成队列状态不因视图切换而丢失

**Given** 当前没有剧本节点和 scene 节点
**When** 用户切换到分镜视图
**Then** 显示引导提示："画布上没有剧本节点。创建剧本节点并粘贴 Markdown 剧本开始。"
**And** 提供"创建剧本节点"快捷按钮

**Given** 视图切换按钮在 TopBar 中
**When** 渲染
**Then** 按钮显示当前选中模式（高亮/下划线指示）
**And** 键盘快捷键提示显示在 tooltip 中

### Story 2.3: StoryboardView — 分镜卡片网格

As a 视频创作者,
I want 在分镜视图中看到所有 scene 节点以卡片网格形式排列,
So that 我能像看故事板一样一目了然地审阅全部场次。

**Acceptance Criteria:**

**Given** 画布上有 6 个 scene 节点（由剧本节点解析创建）
**When** 用户切换到分镜视图
**Then** 显示 6 张卡片，按场次编号顺序排列在响应式 CSS Grid 中
**And** 每张卡片显示：场次编号（场 1、场 2...）、场次标题、内容预览（前 80 字符）
**And** 卡片使用 `chip-paper` CSS 类，与画布主题一致

**Given** scene 节点关联了 image 子节点（已生成结果图）
**When** 分镜视图渲染该 scene 的卡片
**Then** 卡片显示关联图片的缩略图（如有）
**And** 缩略图使用 object-fit cover，不拉伸变形

**Given** 卡片网格中 scene 数量 > 12
**When** 渲染
**Then** 使用 CSS Grid `auto-fill` + `minmax` 自适应列数
**And** 滚动流畅，不因卡片数量而卡顿

**Given** 用户在分镜视图中点击一张卡片
**When** 卡片被点击
**Then** 该卡片高亮选中（边框 accent 色）
**And** 右侧或底部展开详情面板：完整内容、关联节点列表、可编辑属性
**And** 再次点击或点击其他卡片切换选中

**Given** 分镜视图中 scene 节点为 0
**When** 渲染
**Then** 显示空状态插画 + 文案："尚无分镜卡片。在画布上创建剧本节点并解析场次。"
**And** 提供"切换到画布"链接

**Given** 用户在分镜视图中拖拽一张卡片到新位置
**When** 拖拽完成
**Then** 卡片在网格中重新排序
**And** scene 节点的场次编号同步更新

### Story 2.4: 双视图数据互通

As a 用户,
I want 在画布上对 scene 节点的任何修改自动反映到分镜视图，反之亦然,
So that 两个视图始终展示同一份数据，我不需要手动同步。

**Acceptance Criteria:**

**Given** 用户在分镜视图中修改了 scene 3 的标题
**When** 编辑保存
**Then** `useCanvasStore` 中对应 scene 节点数据更新
**And** 如果用户此时切换到画布视图，scene 3 节点显示新标题

**Given** 用户在画布视图删除了 scene 2 节点
**When** 切换到分镜视图
**Then** 分镜网格中 scene 2 卡片消失
**And** 其余卡片重新排列（场次编号连续）

**Given** 用户在画布视图为 scene 4 连线了一个新的 image 节点并生成
**When** 生成完成后切换到分镜视图
**Then** scene 4 卡片自动显示新生成图片的缩略图

**Given** 用户在分镜视图删除了 scene 1 卡片
**When** 删除确认
**Then** 画布上对应的 scene 1 节点及其关联子节点一同删除
**And** undo 栈记录此操作，支持撤销

**Given** 视图切换过程中有未保存的编辑
**When** 用户切换视图
**Then** 编辑内容先自动保存到 store（失焦触发）
**And** 切换不丢失数据

**Given** 用户在画布视图框选了 3 个 scene 节点并 Ctrl+G 成组
**When** 切换到分镜视图
**Then** 分镜网格中对应的 3 张卡片显示分组标记（如边框颜色或角标）
**And** 分组信息不影响卡片网格的正常排序

## Epic 3: 画布交互增强

节点移动/缩放时边缘中心自动吸附邻近节点，显示紫色参考线。多选节点可 Ctrl+G 成组、整体拖拽。

**FRs covered:** FR1, FR2

### Story 3.1: 对齐吸附 — 边缘/中心检测 + 参考线

As a 设计师,
I want 拖拽节点时边缘和中心在 4px 内自动吸附到邻近节点并显示紫色参考线,
So that 我能快速对齐节点，不用放大后手动微调像素。

**Acceptance Criteria:**

**Given** 画布上有节点 A（位置 100, 100，尺寸 200×200）和节点 B（位置 350, 100，尺寸 200×200）
**When** 用户拖拽节点 B 向左移动，其左边缘进入节点 A 右边缘 4px 范围内
**Then** 节点 B 自动吸附——左边缘对齐节点 A 的右边缘（B.x 变为 300）
**And** 显示一条紫色纵向参考线（`#8B5CF6`，1px 虚线）连接两节点边缘
**And** 释放鼠标后参考线消失

**Given** 画布上有节点 A 和节点 B
**When** 用户拖拽节点 B，其水平中心进入节点 A 水平中心 4px 内
**Then** 节点 B 自动吸附对齐节点 A 的中心 Y 坐标
**And** 显示一条紫色横向参考线穿过两节点中心

**Given** 画布上有 3 个垂直排列的等间距节点
**When** 用户拖拽第 4 个节点进入与前 3 个节点等间距位置（间距误差 ≤ 4px）
**Then** 节点自动吸附到等间距位置
**And** 参考线显示间距数值（px）

**Given** 用户拖拽节点 A
**When** 同时有多个候选吸附位置（边缘、中心、等间距）
**Then** 优先吸附到最近的目标（最小距离）
**And** 距离相等时优先边缘对齐 > 中心对齐 > 等间距

**Given** 用户缩放节点（8 点拖拽）
**When** 缩放后边缘/中心进入邻近节点 4px 范围
**Then** 同样触发吸附 + 参考线

**Given** 用户按住 Alt 键拖拽节点
**When** 节点边缘进入 4px 吸附范围
**Then** 吸附行为被暂时禁用，节点保持自由位置
**And** 参考线不显示
**And** 释放 Alt 恢复吸附

### Story 3.2: 框选多节点

As a 用户,
I want 在画布空白区域拖拽出矩形选框来批量选中节点,
So that 我能一次操作选中 50 个节点，而不是逐个 Shift+点击。

**Acceptance Criteria:**

**Given** 画布上有 10 个节点
**When** 用户在空白区域按鼠标左键并拖拽
**Then** 显示一个半透明蓝色矩形选框（fill `rgba(59,130,246,0.08)`，stroke `#3B82F6`）
**And** 选框随鼠标实时扩大/缩小
**And** 选框不触发画布平移

**Given** 用户拖拽选框覆盖了 3 个节点
**When** 释放鼠标
**Then** 选框覆盖的 3 个节点被选中（显示选择边框）
**And** 未被选框覆盖的节点取消选中
**And** 选框消失

**Given** 用户按住 Shift 键拖拽选框
**When** 新选框覆盖了 2 个节点
**Then** 这 2 个节点添加到现有选择集
**And** 已选中的节点保持选中

**Given** 用户拖拽了一个很小的选框（< 5px × 5px）
**When** 释放鼠标
**Then** 视为单击空白区域——取消所有选中
**And** 不创建选区

**Given** 选框中包含已锁定的节点
**When** 释放鼠标
**Then** 锁定节点不被选中
**And** 选框内其他节点正常选中

**Given** 画布正在运行中（有节点处于 running 状态）
**When** 用户框选
**Then** 运行中的节点显示运行状态指示器（绿色脉冲）
**And** 不影响框选行为本身

### Story 3.3: Ctrl+G 成组 / Ctrl+Shift+G 解组

As a 用户,
I want 选中多个节点后按 Ctrl+G 编组、Ctrl+Shift+G 解组，组可整体拖拽,
So that 我能把 10 个 moodboard 图当成一个整体移动，保持相对布局。

**Acceptance Criteria:**

**Given** 用户选中了 4 个节点
**When** 按下 Ctrl+G
**Then** 4 个节点被编为一个组
**And** `useCanvasStore` 中创建一条 group 记录：`{ id, childIds: [...], label? }`
**And** 组显示统一的选择边框（区别于单独选中的样式，如虚线边框）
**And** 组的 undo 记录为"成组 4 个元素"

**Given** 一个组包含 3 个节点
**When** 用户拖拽组中任一节点
**Then** 组内 3 个节点保持相对位置整体移动
**And** 单个节点的拖拽偏移同步应用到所有组员

**Given** 一个组存在
**When** 用户选中该组并按下 Ctrl+Shift+G
**Then** 组被解散
**And** 组内节点恢复为独立节点，位置不变
**And** group 记录从 store 删除
**And** undo 记录为"解组"

**Given** 用户选中了 1 个节点
**When** 按下 Ctrl+G
**Then** 操作无效——至少需要 2 个节点才能成组
**And** 无提示（静默忽略）

**Given** 一个节点 A 属于 Group 1
**When** 用户选中 A 后再次框选 A + 新节点 B，Ctrl+G
**Then** A 从 Group 1 移除，A 和 B 编入新 Group 2
**And** 如果 Group 1 只剩 1 个节点，Group 1 自动解散

**Given** 用户选中了一个组
**When** 按 Delete 键
**Then** 组内所有节点被删除
**And** group 记录清除
**And** undo 记录为"删除组"

**Given** 组内节点之间有连线
**When** 组整体拖拽
**Then** 连线端点随节点位置更新
**And** 贝塞尔曲线平滑重绘

**Given** 用户在分镜视图中有分组卡片
**When** 组整体拖拽
**Then** 与画布行为一致——分组信息在 store 层面统一处理
**And** 不依赖当前视图模式

## Epic 4: 多格式导出 + 模板

画布内容导出为 SVG/PDF/HTML 独立网页，分镜模式导出拼接 MP4，导出含全部素材的 ZIP。当前画布布局可保存为自定义模板。

**FRs covered:** FR33, FR35, FR36, FR37

### Story 4.1: SVG / PDF / HTML 三格式导出

As a 设计师,
I want 将画布内容导出为 SVG、PDF、HTML 独立网页三种格式,
So that 无论客户要矢量源文件、排版 PDF 还是可交互网页，我都能一键交付。

**Acceptance Criteria:**

**Given** 画布上有 5 个可见节点（image、text、rectangle 等）
**When** 用户选择"导出 SVG"（菜单或快捷键）
**Then** 生成画布可见区域（或框选区域）的 SVG 文件并触发下载
**And** SVG 包含矢量图形节点（rectangle/circle 等）的精确路径
**And** 文件名格式为 `canvas-export-{date}.svg`

**Given** 画布上有 text 节点（Html 覆盖层）
**When** 导出 SVG / PDF
**Then** text 节点内容通过 canvasStore 数据层获取，手动绘制到导出画布
**And** 不依赖 Konva Html 层渲染
**And** **已知限制明确标注**：在导出预览中提示"文字节点位置可能与画布有 ±2px 偏差"

**Given** 用户选择"导出 PDF"
**When** 导出执行
**Then** 生成 A4 尺寸 PDF（可配置尺寸），画布内容等比缩放适配页面
**And** 中文文本正确显示——使用 jsPDF + 内嵌中文字体（Noto Sans SC 或等效 TTF）
**And** 不含空白方块（字体未嵌入导致的渲染失败）
**And** 多节点场景下 PDF 自动分页（单页放不下时）

**Given** 用户选择"导出 HTML"
**When** 导出执行
**Then** 生成独立 HTML 文件，内联所有 CSS/JS/图片（data URL 或内嵌 base64）
**And** HTML 在 Chrome/Edge/Firefox 离线打开无报错
**And** 不依赖任何外部 CDN 或网络请求
**And** 不包含用户的 API Key 配置（NFR7）
**And** text 和 sticky 节点在 HTML 中以绝对定位 DOM 渲染

**Given** 当前画布没有任何可导出内容
**When** 用户尝试导出
**Then** 显示提示"画布为空，无可导出内容"
**And** 不触发下载空白文件

**Given** 导出过程中（生成 SVG/PDF/HTML）
**When** 文件较大（画布含 50+ 节点）
**Then** 导出操作不阻塞 UI——显示进度提示"正在导出..."
**And** 导出完成后提示消失，触发浏览器下载

### Story 4.2: ZIP 导出 — 画布 JSON + 素材打包

As a 用户,
I want 将画布完整状态和所有素材打包为一个 ZIP 文件,
So that 我能把整个项目迁移到另一台电脑，或归档备份不会丢失任何文件。

**Acceptance Criteria:**

**Given** 画布上有 10 个节点，其中 3 个 file/image 节点的素材存储在 IndexedDB
**When** 用户选择"导出 ZIP"
**Then** 生成 ZIP 文件，包含：
  - `canvas.json`：完整的画布状态（elements, connections, stageConfig, groups）
  - `assets/` 目录：所有 IndexedDB 大对象 + inline data URL 提取为独立文件
  - `manifest.json`：文件清单（文件名、原始路径、MIME 类型、大小）
**And** ZIP 文件名格式：`canvas-project-{date}.zip`

**Given** 画布 JSON 序列化
**When** 写入 canvas.json
**Then** API Key 相关字段自动剔除（`settingsStore.apiKeys` 不写入）
**And** 节点 data URL 替换为 `assets/` 目录相对路径引用
**And** JSON 格式化（缩进 2 空格），人类可读

**Given** IndexedDB 中有一个 25MB 的视频文件
**When** 导出 ZIP
**Then** 该文件完整写入 `assets/` 目录
**And** 导出进度显示"正在打包素材... 1/3 (25MB)"

**Given** 画布为空（0 个节点）
**When** 用户尝试导出 ZIP
**Then** 提示"画布为空"
**And** 不生成空 ZIP

**Given** ZIP 导出中某个 IndexedDB blob 读取失败
**When** 错误发生
**Then** 该文件在 manifest.json 中标记 `"status": "missing"`
**And** 导出继续完成（不因单个文件失败而中断）
**And** 导出完成后提示"1 个素材文件未能打包，详见 manifest.json"

### Story 4.3: 分镜 MP4 拼接导出

As a 视频创作者,
I want 将分镜模式中所有 scene 节点按场次顺序导出并拼接为 MP4 文件,
So that 剧本分镜直接变成可预览的视频成片，省去进剪辑软件手动拼接的步骤。

**Acceptance Criteria:**

**Given** 分镜视图中有 6 个 scene 节点，每个 scene 关联 1 个 image 子节点（已生成）
**When** 用户选择"导出 MP4"
**Then** 每张 scene 关联的图片按场次顺序拼接为视频帧
**And** 每帧持续 3 秒（默认），可配置时长（1s / 3s / 5s）
**And** 输出 MP4 格式（H.264 编码），竖屏 1080×1920（默认），可切换为横屏 1920×1080
**And** 帧间过渡为淡入淡出（crossfade 0.3s）

**Given** scene 节点关联的是 video 节点（非 image）
**When** 导出 MP4
**Then** 该 scene 使用视频片段而非静态帧
**And** 视频片段截取时长 = 用户配置的单帧时长

**Given** scene 节点包含 text 内容（场次标题、描述）
**When** 导出 MP4
**Then** 每帧底部叠加半透明黑底白字的场次标题和描述
**And** 文字使用无衬线字体，字号适屏

**Given** 某一 scene 没有关联任何 image/video 子节点
**When** 导出 MP4
**Then** 该 scene 生成为黑屏占位帧（黑底白字场次标题）
**And** 不中断导出流程

**Given** MP4 导出过程中
**When** 处理较大的视频文件或图片
**Then** 导出面板显示进度："正在处理 scene 3/6..."
**And** 支持取消导出

**Given** 导出 MP4 完成
**When** 浏览器触发下载
**Then** 文件名格式：`storyboard-export-{date}.mp4`
**And** 提示"MP4 导出完成，共 6 场，30 秒"

**Given** 浏览器不支持 WebCodecs API
**When** 用户尝试导出 MP4
**Then** 显示提示"你的浏览器不支持视频编码，请使用 Chrome 120+ 或 Edge 120+"
**And** 导出按钮变为 disabled

### Story 4.4: 画布布局保存为自定义模板

As a 设计师,
I want 将当前画布节点布局保存为自定义模板,
So that 下次接到类似项目时直接实例化模板开始工作，不用重新搭建结构。

**Acceptance Criteria:**

**Given** 画布上有 8 个节点 + 4 条连线，布局精心排列
**When** 用户点击"保存为模板"
**Then** 弹出模板命名对话框，输入模板名称、描述（可选）、标签（可选）
**And** 保存后模板出现在模板市场中——与内置模板并列显示
**And** 模板存储当前画布的 elements（清除生成结果 data URL）、connections、stageConfig

**Given** 用户保存模板时
**When** 存储模板数据
**Then** 节点中的 AI 生成结果（data URL、blob 引用）被清除
**And** 保留节点类型、位置、尺寸、样式、端口定义
**And** 连线保留，但端口数据清空
**And** 不包含 API Key 或任何用户密钥

**Given** 用户打开模板市场
**When** 查看自定义模板
**Then** 自定义模板与内置模板视觉区分——如"我的模板"分区或角标标记
**And** 显示模板名称、描述、节点/连线数量、创建日期
**And** 支持右键删除自定义模板（内置模板不可删除）

**Given** 用户选中一个自定义模板
**When** 点击"实例化"
**Then** 模板节点+连线复制到当前画布视口中央
**And** 节点处于 idle 状态（非 aigenerating）
**And** undo 记录为"实例化模板"

**Given** 用户保存模板后立即在模板市场查看
**When** 模板列表刷新
**Then** 新模板立即可见（无需刷新页面）

**Given** 当前画布为空（0 个节点）
**When** 用户点击"保存为模板"
**Then** 提示"画布为空，无法保存模板"
**And** 保存按钮 disabled

## Epic 5: 局部重绘

在 image 节点上框选区域生成 PNG 蒙版，支持 inpainting——AI 仅重绘蒙版覆盖区域。

**FRs covered:** FR12

### Story 5.1: 局部重绘模式 + 蒙版框选

As a 用户,
I want 在 image 节点上进入局部重绘模式后用矩形选框定义重绘范围,
So that 我可以精确指定 AI 重绘哪个区域，而不是整张图重新生成。

**Acceptance Criteria:**

**Given** 画布上有一个已生成完成的 image 节点
**When** 用户选中该 image 节点，右键选择"局部重绘"（或点击工具栏按钮）
**Then** 该 image 节点进入局部重绘模式
**And** 节点上覆盖一层半透明深色遮罩（fill `rgba(0,0,0,0.3)`）
**And** 光标在节点上变为十字准星（crosshair）

**Given** image 节点处于局部重绘模式
**When** 用户在节点上按住鼠标拖拽
**Then** 在遮罩上方显示矩形选框（stroke `#8B5CF6`，fill `rgba(139,92,246,0.15)`）
**And** 选框限制在节点边界内（不可超出图片区域）
**And** 选框最小尺寸 ≥ 20px × 20px

**Given** 用户在 image 节点上拖拽出选框
**When** 释放鼠标
**Then** 选框固定，显示 8 个调整手柄（与节点缩放手柄一致）
**And** 选框内区域显示为原图（不覆盖遮罩）——用户可预览将被重绘的范围
**And** 右侧显示选区信息：位置（x, y）、尺寸（w × h）

**Given** 选框已存在
**When** 用户拖拽选框手柄调整大小
**Then** 触发与 Story 3.1 一致的对齐吸附（吸附到图像边缘/中心）
**And** 选框实时更新尺寸和位置信息

**Given** 用户在 image 节点上已创建选框
**When** 再次在节点空白区域拖拽
**Then** 旧选框被新选框替换（同一节点同一时间只有一个蒙版区域）
**And** 旧选框消失无残留

**Given** 当前处于局部重绘模式
**When** 用户按 Escape 或点击节点外部
**Then** 退出局部重绘模式
**And** 选框和遮罩消失
**And** 不产生任何蒙版数据

**Given** 用户在同一 image 节点上需要一个不规则的蒙版区域
**When** 按住 Shift 拖拽第二个选框
**Then** 第二个选框追加到现有选区（多选框取并集作为最终蒙版）
**And** 两个选框视觉上可区分

### Story 5.2: 蒙版生成 + AI Inpainting 调用

As a 用户,
I want 框选完成后点击"开始重绘"，系统生成蒙版 PNG 并调用 AI inpainting,
So that AI 只重绘我选定的区域，其余部分保持原样。

**Acceptance Criteria:**

**Given** image 节点上已框选一个区域（200, 150, 300×200 相对节点坐标）
**When** 用户点击"开始重绘"
**Then** 系统：
  1. 从原图裁切选框区域 → 生成蒙版 PNG（选区全白 `#FFFFFF`，其余全黑 `#000000`）
  2. 将原图 + 蒙版 + prompt 提交到 AI Provider 的 inpainting 接口
  3. 节点下方显示进度条"正在重绘..."

**Given** AI inpainting 成功返回结果
**When** 结果图片加载完成
**Then** 原 image 节点内容被替换为重绘后的整图（含重绘区域 + 保留区域）
**And** 退出局部重绘模式
**And** 原图存入节点版本历史（作为 vN），新结果作为当前版本（vN+1）
**And** undo 记录为"局部重绘"

**Given** 当前 AI Provider 不支持 inpainting 接口
**When** 用户点击"开始重绘"
**Then** 提示"当前模型不支持局部重绘，请切换支持 inpainting 的 Provider"
**And** 不发起无效请求
**And** 推荐可用的 inpainting Provider（如配置中存在）

**Given** AI inpainting 失败（超时/限流/错误）
**When** 错误返回
**Then** 显示分类错误信息："局部重绘失败：{原因}"
**And** 节点保持原图不替换
**And** 蒙版选区保留——用户可调整后重试
**And** 支持点击"重试"按钮

**Given** 用户不满意重绘结果
**When** 打开版本切换器
**Then** 可选择之前的版本（局部重绘前）回滚
**And** 回滚后节点恢复到原图

**Given** 多个 image 节点同时进入局部重绘模式
**When** 节点 A 和节点 B 各有框选蒙版
**Then** 各自独立——A 的蒙版不影响 B
**And** 两个节点的 `useCanvasStore.inpainting` 状态正确隔离（每个节点一个蒙版记录）

## Epic 6: 桌面壳

Windows/Mac 独立窗口运行（Tauri），`.canvas` 文件与桌面应用关联。

**FRs covered:** FR44, FR45

### Story 6.1: Tauri 初始化 + Web 应用嵌入

As a 用户,
I want Canvas 作为独立桌面窗口运行,
So that 不用打开浏览器，像原生应用一样使用创作工具。

**Acceptance Criteria:**

**Given** 项目根目录
**When** 执行 `cargo install create-tauri-app` 并初始化 Tauri
**Then** 创建 `src-tauri/` 目录，包含 Cargo.toml、tauri.conf.json、main.rs
**And** tauri.conf.json 配置 window：标题"温纸工作室"、默认尺寸 1400×900、最小尺寸 960×600、decorations true
**And** Vite 构建产物 `dist/` 作为 Tauri frontendDist
**And** `npm run tauri dev` 启动桌面窗口 + Vite dev server 热更新

**Given** Tauri 窗口运行中
**When** 用户进行正常操作（画布交互、AI 生成、导出）
**Then** 所有功能行为与 Web 版一致
**And** `localStorage` / `IndexedDB` 在 WebView 中正常工作
**And** AI 请求直连 Provider（与 Web 版相同，不经过 Tauri 后端）

**Given** Tauri 窗口
**When** 渲染
**Then** 窗口有自定义应用图标（`.ico` / `.icns`）
**And** 无浏览器 chrome（地址栏、书签栏等）
**And** 窗口标题栏显示"温纸工作室"

**Given** Windows 和 macOS 构建
**When** 运行 `npm run tauri build`
**Then** 在 `src-tauri/target/release/bundle/` 生成：
  - Windows：`.msi` 安装包 + `.exe` 便携版
  - macOS：`.dmg` 磁盘映像 + `.app` bundle
**And** 构建成功，产物可独立分发运行

**Given** 用户在桌面应用中
**When** 需要访问本地文件系统
**Then** Tauri 提供文件对话框（打开/保存 .canvas 文件）
**And** 文件读写通过 Tauri API（不依赖浏览器的 File System Access API）

### Story 6.2: `.canvas` 文件关联 + 双击打开

As a 用户,
I want 双击 `.canvas` 文件时自动在 Canvas 应用中打开,
So that 我能像用 Photoshop 打开 `.psd` 一样自然地打开我的项目文件。

**Acceptance Criteria:**

**Given** 用户在文件管理器中有一个 `project.canvas` 文件
**When** 双击该文件（或右键"打开方式"→ Canvas）
**Then** Canvas 桌面应用启动
**And** 应用读取 `.canvas` 文件内容导入到画布
**And** 画布显示与导出时一致的所有节点、连线、分组

**Given** `.canvas` 文件格式
**When** 保存和读取
**Then** 文件格式与 Story 4.2 的 ZIP 导出格式一致：
  - 外层为 `.canvas` 扩展名的 ZIP 文件
  - 内含 `canvas.json` + `assets/` + `manifest.json`
**And** 文件名作为画布项目名显示在窗口标题栏

**Given** Tauri 安装包
**When** 安装到系统（Windows .msi / macOS .dmg）
**Then** 注册 `.canvas` 文件类型关联：
  - Windows：注册表 `HKEY_CLASSES_ROOT\.canvas`
  - macOS：Info.plist `CFBundleDocumentTypes` 声明 `.canvas`
**And** `.canvas` 文件在文件管理器中显示 Canvas 应用图标

**Given** 用户双击打开 `.canvas` 文件
**When** 文件内容包含已过期的 API Key 配置
**Then** API Key 配置被忽略（NFR7——导出已剔除 Key）
**And** 用户需重新在设置中配置 Provider Key

**Given** 用户双击一个损坏的或不完整的 `.canvas` 文件
**When** 应用尝试读取
**Then** 提示"文件可能已损坏：{具体错误}"
**And** 不崩溃，启动到空白画布

**Given** `.canvas` 文件包含 IndexedDB 素材引用
**When** 在另一台电脑打开
**Then** assets/ 目录中的文件被读取到新环境的 IndexedDB
**And** 节点引用自动映射到新的 blob key
**And** 素材正确显示（无"文件丢失"占位符）
