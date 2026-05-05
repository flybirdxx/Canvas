---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
releaseMode: 'phased'
status: 'complete'
inputDocuments:
  - docs/PRD.md
  - docs/roadmap-RICE.md
  - docs/design-spec.md
  - docs/prd/existing-features.md
  - docs/prd/next-phase.md
  - docs/architecture/overview.md
  - docs/architecture/components.md
  - docs/architecture/data-flow.md
  - docs/architecture/ai-gateway.md
  - docs/redesign/01-spec.md
  - docs/redesign/02-aesthetic.md
  - _bmad-output/project-context.md
workflowType: 'prd'
classification:
  projectType: 'web_app'
  domain: 'creative-tool'
  complexity: 'medium'
  projectContext: 'brownfield'
  crossDomainSignals:
    - 'ai-generation-platform'
    - 'content-distribution'
  notes:
    - 'Canvas-heavy rendering — 非典型 DOM-based web app'
    - 'AI content provenance (C2PA) 为建议合规项'
    - '单机+自带Key 模式不受生成式AI服务备案约束'
    - 'Seed 可复现性应作为功能性需求'
    - '导出模块需平台感知的格式预设'
    - '云服务扩展时需重新评估合规触发条件'
---

# Product Requirements Document - Canvas

**Author:** Smile
**Date:** 2026-05-05

## Executive Summary

**AI Canvas Pro (Warm Paper Studio)** 是一款面向单人创作者的桌面级 AI 创意画布。它把 AI 多模态生成从"孤立请求"变成"可视化工作流"——用户在无限画布上放置节点、连线、点运行，AI 自动沿管线生成。

目标用户：AI 创意工作者——设计师、视频创作者、提示词工程师。他们需要一个工具，让灵感到成品的路径不被工具打断。

### What Makes This Special

现有竞品分两派：**工程师派**（ComfyUI）强在节点化但 UI 对普通创作者不友好；**白板派**（Figma/Miro/tldraw）强在画布但 AI 只是事后插件。AI Canvas Pro 站在中间：

- 节点不是技术组件（VAE Decode / CLIP Text Encode），而是**语义单元**（一段 prompt、一张参考图、一个风格预设）。用户不需要知道什么是 VAE。
- 连线不是数据管道，而是**创作依赖**——"这张图变成那段视频"。用户表达的是意图，不是管线。
- AI 网关可插拔——不绑定单家模型，用户自行配置 API Key 和 Provider。

一句话：**让创作者不用学工作流就能享受工作流编排的幂等性、可重复性和自动化。**

### Project Classification

| 维度 | 值 | 说明 |
|------|-----|------|
| 项目类型 | `web_app` (Canvas-heavy SPA) | 非典型 DOM-based web app；核心交互面是 Konva Canvas 渲染引擎 |
| 领域 | `creative-tool` | 输出保真度、内容溯源、多平台导出适配为核心需求 |
| 复杂度 | `medium` | 技术架构复杂 + AI 合规边界 + 创意工具输出保真度需求 |
| 上下文 | `brownfield` | MVP 已交付，Phase 2 补齐完成。现有代码库 ~200 文件 |
| 交叉信号 | `ai-generation-platform` `content-distribution` | Seed 可复现性、内容安全边界、多平台格式预设 |

## Success Criteria

### User Success

**"Aha!" 时刻**：用户放 text 节点 → 写 prompt → 连线到 image 节点 → 点生成 → 看到结果。从打开画布到第一次成功生成应在 2 分钟内完成。

**完成状态**：用户拿到满意的生成结果并导出。对 P1（爱好者）是导出 PNG；对 P2（设计师）是导出 PDF/排版；对 P3（视频作者）是导出视频。

**情感信号**：
- 第一张图生成成功 → "这个东西能干活"
- 第一条链跑通 → "这不是白板，这是一个引擎"
- 第一次批量生成 → "我可以探索更多可能性了"

### Business Success

| 指标 | 目标 | 口径 |
|------|------|------|
| 首次生成成功率 | ≥ 90% | 新用户建首个 AI 节点后 10 分钟内 ≥ 1 次成功 |
| 7 日留存 | ≥ 35% | 激活日起第 7 日返回 |
| 人均节点数（7 日窗口） | ≥ 20 | 去重元素 |
| AI 调用成功率 | ≥ 95% | 所有 AI 请求，5xx + 业务失败归失败 |
| 导出/分享转化 | ≥ 40% | 激活后 7 日内触发任一导出 |
| 连线使用率 | ≥ 25% | 至少创建过 1 条连线的用户占比 |

### Technical Success

- **渲染预算**：100 节点、3 条并行运行链，FPS ≥ 55
- **首屏可交互**：Web 冷启动 < 2.5s（本地 dev server）
- **AI 生成延迟**：图像 P95 ≤ 25s；视频 P95 ≤ 90s；超时自动失败重试
- **持久化可靠性**：localStorage / IndexedDB 混合存储，刷新/关闭/崩溃不丢数据。详见 NFR10-12
- **导出保真度**：PNG 2x 像素精准；PDF 中文字体内嵌；HTML 内联所有素材。详见 NFR1-5

## Product Scope

### MVP（已完成）

- 7 种节点类型（text/image/video/audio/sticky/rectangle/file）
- 多模型 AI 网关（T8Star + RunningHub）
- 连线工作流（类型端口 + 环检测 + 图生图）
- 提示词库 / 批量变体 / 模板市场 / 资源库
- 节点版本历史 + 历史记录面板（undo/redo 50步）
- 画布截图导出 PNG
- 失败重试与错误可读化

### Growth（V1 — 当前待实现）

- **F19 链式运行引擎** — 拓扑序执行选中子图，五状态，支持局部重跑
- **F20 运行面板** — 实时日志、进度条、耗时、取消
- **F16 分镜网格视图** — 画布/分镜一键切换，卡片网格展示 scene 节点
- **F14 剧本节点** — Markdown 场次自动识别为分镜锚点
- **F2 多选组合** — 框选、Ctrl+G 成组
- **F1 对齐吸附** — 智能参考线 + 边缘/中心吸附
- **F23 多格式导出** — PDF/SVG/HTML/视频拼接
- **F24 桌面壳 Tauri** — Mac/Win 独立窗口

### Vision（V2 — 远期）

- **F13 视频生成节点** — 文生视频/图生视频，6s 竖屏默认
- **F9 Inpaint/Outpaint** — 局部重绘 + 向外扩画
- **F17 角色/场景一致性** — reference + LoRA hook
- **F15 LLM 剧本拆分** — 粘贴剧本 → 自动生成 scene 节点
- **F3 图层面板** — z 排序、锁定、隐藏
- **F4 笔刷/钢笔** — 自由手绘 + 贝塞尔
- **F18 音轨/配音节点** — TTS + BGM

## User Journeys

### Journey 1: P1 — 概念图探索者（核心 happy path）

**角色**：小马，AI 产品爱好者，非技术背景。用过 Midjourney、DALL·E、Stable Diffusion，每次换工具都要学新界面。想把不同模型的产出放一起比较，但每个工具的输出是孤立的。

**开场**：打开画布，选"AI Moodboard 起手"模板。画布出现预置节点链：prompt → 4 张图 → 变体。

**递进**：替换提示词为"一只橘猫坐在窗台上，午后阳光透过百叶窗洒下条纹光影，35mm 胶片质感"。选中 image 节点，下拉模型列表，选一个点生成。

**高潮**：30 秒后结果出现。把图片输出连到一个新 image 节点，改 prompt 为"同一只猫，改为水墨画风格"——再生成。图生图的结果保留了构图。**意识到：这不是单次生成工具，是迭代管线。**

**结局**：完成 4 张变体，选最满意的一张截图导出。全程未离开画布、未切换工具。
**失败路径**：API Key 未配置 → 生成按钮显示"去设置" → SettingsModal → 粘贴 Key → 重试成功。
**揭示的能力**：模板实例化、prompt 编辑、模型选择、AI 生成、连线工作流、图生图、版本切换、截图导出、错误引导。

### Journey 2: P2 — 品牌视觉设计师（专业输出）

**角色**：Lina，自由设计师。客户要"3 个视觉方向 × 4 张 moodboard 图，排版发 PDF"。
**困境**：流程是 Midjourney 生成 → 下载 → Figma 排版 → 导出 PDF。每个步骤切换工具，文件散落桌面。

**开场**：新建画布，拖入 10 张品牌参考图。选 3 张上画布，每张下连 image 节点挂风格预设（"极简北欧"、"赛博朋克"、"日系手绘"）。

**高潮**：多选 4 个节点，点批量生成。运行面板显示进度。12 张图完成，选中、对齐、Ctrl+G 成组。导出 PDF（A4 排版）。

**结局**：客户收到 PDF 反馈"第一次改稿这么快"。她把画布存为模板，下次复用。
**失败路径**：批量生成中一个节点因 API 限流失败 → 该节点红框提示 → 其他节点继续生成。点重试成功。
**揭示的能力**：资源库、风格预设、批量生成、运行面板、对齐/成组、PDF 导出、模板保存。

### Journey 3: P3 — 短视频作者（叙事工作流）

**角色**：阿星，独立漫画/短视频创作者，要做 30 秒竖屏视频。
**困境**：剧本在 Typora，图用 Midjourney，视频用 Runway，拼接进剪映。剧本→图→视频链条靠手动管理文件名对应。

**开场**：切换"分镜模式"，粘贴剧本。右侧出现分镜网格卡片。

**递进**：每个 scene 补充参考角色图，点"拆分为节点"。6 个 scene 节点出现，各挂 image 生成节点。逐一写镜头 prompt。

**高潮**：选中所有 6 条链，点"全部运行"。运行面板显示拓扑执行——scene 依次生成图，然后 video 节点生成视频。完成后导出 MP4——完整的 30 秒竖屏视频。

**结局**：分镜模板保存。下次换剧本文字→重新生成。
**失败路径**：scene 4 生成结果不符合角色一致性 → 开版本切换器选 v2 → 微调 prompt → 重新生成。链式引擎跳过已完成的 scene 子节点。
**揭示的能力**：分镜模式、剧本节点、LLM 拆分、分镜网格、链式运行引擎、参考图绑定、视频生成、MP4 导出。

### Journey Requirements Summary

| Journey | 用户类型 | 核心能力需求 |
|---------|----------|-------------|
| J1 — 概念图探索 | P1 爱好者 | 模板、prompt编辑、AI生成、连线、版本切换、截图导出 |
| J2 — 品牌视觉 | P2 设计师 | 资源库、批量生成、对齐/成组、PDF导出、模板保存 |
| J3 — 短视频 | P3 视频作者 | 分镜模式、剧本节点、链式运行引擎、视频生成、MP4导出 |

## Domain-Specific Requirements

本产品不属于受监管行业（非医疗/金融/政府），但作为 **AI 创意工具**，有以下领域特定需求：

### AI 内容溯源
- **C2PA / Content Credentials**：导出的图片/视频应可选择嵌入 "AI-generated with Canvas Pro · Model: X" 元数据
- **当前状态**：建议项。单机+自带 Key 模式下用户自行承担溯源责任
- **触发条件**：云同步/模板分发/社区功能上线时升级为必须

### 生成式 AI 合规边界
- 单人单机 + 自带 API Key 模式下，产品本身不是 AI 服务提供者，不受生成式 AI 服务备案约束
- 产品不做 prompt 审查、不做生成结果审核、不中转用户 API 调用
- 若未来提供"内置模型"或"内容发布/分享"功能，需重新评估备案义务

### 输出保真度
- **色彩管理**：Canvas 渲染与导出文件色域一致性。PDF 内嵌颜色配置文件
- **字体嵌入**：PDF 导出必须内嵌中文字体 TTF。不嵌入 = 空白方块（静默数据丢失）
- **跨格式一致性**：PNG / SVG / PDF / HTML 导出应视觉一致。已知限制：Html 覆盖层节点不参与 Konva 导出

### Seed 可复现性
- 生成结果的 `seed` 应持久化存储，用户可查看历史 seed 并重新提交复现
- 注意：并非所有 Provider 支持 seed 参数，需 graceful degradation

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. 交互范式创新：连线 = 意图表达**
现有节点工具的连线表达数据流。AI Canvas Pro 的连线表达创作依赖——"这张图变成那段视频"。连线不是技术管线，是创作者意图的视觉语法。属于 `web_app` 的 "New interaction" 创新信号。

**2. 品类融合创新：画布 × 工作流引擎**
画布工具（Figma/Miro）是自由排版 + AI 插件；工作流工具（ComfyUI）是 DAG 但工程师化。AI Canvas Pro 融合两者——同一张画布既是 moodboard 也是可执行管线。

**3. 架构创新：可插拔 AI 网关**
不绑定单一 AI 服务。Provider 可配置驱动——新增模型一个文件 + 推入数组。

### Market Context & Competitive Landscape

| 竞品 | 语义节点 | AI 原生 | 叙事/分镜 | 本地优先 |
|------|----------|---------|-----------|----------|
| ComfyUI | ✗ 技术节点 | ✓ SD 生态 | ✗ | ✓ |
| Krea AI | ✗ 自由画布 | ✓ 实时 | ✗ | ✗ 云端 |
| tldraw/Miro | ✗ 白板 | ✗ 插件 | ✗ | ✗ 云端 |
| **AI Canvas Pro** | ✓ | ✓ 多模型 | ✓ | ✓ |

### Validation Approach

- 连线创建成功率 ≥ 90%
- 连线使用率 ≥ 25% 验证"工作流引擎"定位
- 新增第三个 Provider 开发成本 ≤ 200 行

### Risk Mitigation

- 用户不理解连线 → 模板预建链，先"用链"再"建链"；单节点完全可用
- 复杂场景连线混乱 → 无边界画布 + 自由缩放空间分区

## Web App Specific Requirements

### Project-Type Overview

单页应用（SPA）— React 19 + Vite 6。核心交互面为 Konva Canvas 渲染引擎（非典型 DOM-based web app）。本地优先，无需 SSR，不依赖 SEO。

### Browser Support

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | 120+（主要目标） |
| Edge | 120+（Chromium 兼容） |
| Firefox | 120+（次要，Canvas 行为需验证） |
| Safari | 17+（次要，WebKit Canvas 差异需关注） |
| IE / 旧 Edge | 不支持 |

### Responsive Design

- **桌面优先**：≥1280×720 为核心体验
- **平板**：≥768px 可用但不保证完整；触屏 Canvas 交互退化为单点
- **移动端**：不在范围内

### Performance Targets

详见 [Non-Functional Requirements > Performance](#performance)。

### SEO Strategy

不适用。桌面应用，非公开网页。

### Accessibility

- DOM chrome 层：WCAG AA（对比度 ≥ 4.5:1，键盘全可达，aria-label/title）
- Canvas 层：Canvas 2D 无 DOM 语义，节点内容不可被屏幕阅读器访问（已知限制）
- 核心键盘路径：新建节点、平移、撤销、导出全部键盘可达

## Functional Requirements

> FR 列表为绑定合约。下游 UX、架构、Epic、开发均以此为准。
> [MVP] 已实现 / [V1] 当前待实现 / [V2] 远期

### 画布交互 (Canvas)

- FR1: [V1] 移动/缩放节点时，边缘和中心与邻近节点在 4px 内自动吸附，显示参考线
- FR2: [V1] 框选多节点，Ctrl+G 成组，Ctrl+Shift+G 解组。组可整体拖拽
- FR3: [V2] 图层面板查看、排序、锁定、隐藏节点
- FR4: [V2] 自由手绘贝塞尔矢量路径，产物作为画布节点
- FR5: [V2] 在 image 节点上拉框创建蒙版区域

### AI 生成 (AI Generation)

- FR6: [MVP] 配置多 AI Provider（API Key + base URL），SettingsModal 集中管理
- FR7: [MVP] NodeInputBar 选择模型，按能力标签分组展示
- FR8: [MVP] 输入 prompt → 生成 → 结果替换节点。失败显示分类错误 + 重试
- FR9: [MVP] image 输出连线到另一 image 的 image(ref) 输入，进行图生图
- FR10: [MVP] 一次生成多张变体（1/2/4/6/9），网格展示，点击提升为主节点
- FR11: [MVP] 从提示词库选择预设风格片段注入 prompt，可叠加
- FR12: [V1] image 节点开启局部重绘模式，框选区域生成蒙版
- FR13: [V2] 文生视频/图生视频，默认 6s 竖屏

### 连线与工作流 (Workflow)

- FR14: [MVP] 从输出端口拖拽连线到输入端口。类型不匹配拒绝连线
- FR15: [MVP] 有向环自动检测并拒绝。贝塞尔曲线渲染
- FR16: [V1] 选中含连线子图点"运行"，按拓扑序依次执行。有环拒绝运行
- FR17: [V1] 节点五状态：idle / queued / running / success / failed
- FR18: [V1] 运行失败不阻断其他分支。可局部重跑失败节点

### 节点系统 (Nodes)

- FR19: [MVP] 创建 7 种节点：text / image / video / audio / sticky / rectangle / file
- FR20: [MVP] 节点拖拽定位、8 点缩放、旋转、锁定、注释
- FR21: [MVP] 生成成功后追加版本记录，版本切换器切换历史版本
- FR22: [MVP] 文件节点按 MIME 智能预览
- FR23: [V2] table / code / embed 节点类型

### 运行监控 (Execution)

- FR24: [V1] 运行面板：实时日志、节点进度条、耗时、取消按钮
- FR25: [V1] 一键取消所有进行中任务

### 叙事分镜 (Storyboard)

- FR26: [V1] 剧本节点，Markdown 格式，`### 场 N` 自动识别为分镜锚点
- FR27: [V1] 画布/分镜双视图切换，卡片网格展示 scene 节点
- FR28: [V1] 双视图数据互通
- FR29: [V2] 剧本右键"拆分镜头"——LLM 分析场次，创建 scene 节点
- FR30: [V2] scene 节点绑定角色参考图，AI 生成时自动传入

### 资源与模板 (Assets)

- FR31: [MVP] 资源库：上传素材、浏览生成结果、收藏，拖入画布创建节点
- FR32: [MVP] 模板市场选择预设画布布局，一键实例化
- FR33: [V1] 当前画布布局保存为自定义模板

### 导出 (Export)

- FR34: [MVP] 框选区域或选中节点导出 PNG（2x）
- FR35: [V1] 导出 SVG / PDF / HTML 独立网页
- FR36: [V1] 分镜模式按 scene 顺序导出拼接 MP4
- FR37: [V1] 导出含画布 JSON + 素材的 ZIP
- FR38: [V2] 导出文件嵌入 AI 生成元数据（模型/prompt/seed/time）

### 历史与持久化 (Persistence)

- FR39: [MVP] 撤销/重做 50 步，时间线面板跳转任意历史状态
- FR40: [MVP] 关闭/刷新自动恢复。异步任务重启后继续轮询
- FR41: [MVP] 大文件 >1MB 自动存入独立大对象存储，不占用画布主存储空间

### 视觉与主题 (Theming)

- FR42: [MVP] light/dark 主题切换
- FR43: [MVP] CSS 设计 token 系统统一颜色/间距/圆角/阴影

### 平台 (Platform)

- FR44: [V1] Windows/Mac 桌面独立窗口运行，支持本地文件关联打开
- FR45: [V1] `.canvas` 文件与桌面应用关联

## Non-Functional Requirements

### Performance

- NFR1: 画布平移/缩放（100节点 + 3并行链）保持 ≥ 55 FPS
- NFR2: Web 冷启动到可交互 ≤ 2.5s
- NFR3: AI 图像生成 P95 ≤ 25s；视频 P95 ≤ 90s；超时自动失败
- NFR4: IndexedDB 写入 ≤ 100ms，不阻塞 UI
- NFR5: 拖拽帧级更新不触发写盘。mouseup 时单次 flush < 50ms

### Security

- NFR6: API Key 使用浏览器原生加密 API + 用户口令加密存储，不明文持久化
- NFR7: 导出 ZIP 默认剔除 API Key 配置
- NFR8: 用户 AI 调用直连 Provider API，不经产品服务端中转
- NFR9: 遥测数据仅本地存储，不上报外部

### Storage

- NFR10: 单画布上限 500 节点 / 500MB。超阈值提示拆分
- NFR11: >1MB 文件路由到独立大对象存储，不占用画布主存储空间
- NFR12: 异步任务状态持久化，重启后自动恢复轮询

### Accessibility

- NFR13: DOM chrome 层 WCAG AA（对比度 ≥ 4.5:1，键盘全可达，aria-label）
- NFR14: Canvas 层受限于无 DOM 语义——节点内容不可被屏幕阅读器访问（已知限制）

### Internationalization

- NFR15: 当前 zh-CN。V1 起增加英文，资源库和模板支持 i18n
