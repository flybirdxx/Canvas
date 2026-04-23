# AI 画布 Pro · Redesign Spec v1.1

> Stage 1 产物 · 由 `ui-ux-pro-max` 指引编写
> 美学方向（v1.1 PIVOT）：**Warm Paper Studio**（浅色优先 · 奶白纸面 · 墨色正文 · 秋叶 terracotta 主强调 · 手绘墨线连接 · 克制肌理）
> 拒绝 v1.0 Retro-Futuristic 的原因：too geeky — 赛博朋克味过重，缺设计师感
> 交付格式：规范文档 → 美学指引 → 静态高保真原型 → 再动 React 代码

---

## 0. Redesign Mandate（为什么要重做）

现状问题（从代码/截图推断的可操作痛点）：
- **语言不统一**：`rounded-xl` + `rounded-full` + `rounded-[20px]` 混用；shadow 从 `shadow-sm` 到 `shadow-[0_20px_60px]` 五六种；颜色从 `gray-*` 到 `blue-600` 到 `purple-*` 到紫色渐变，没有强制约束。
- **视觉平权**：所有 chip / 面板都是半透明白 + 细边，没有层级；核心动作（生成、分享）不突出。
- **画布 ≠ 主角**：canvas surface 是一张灰色点阵 `#fafafa`，节点是白卡片，和周边 chrome 没有拉开对比。创作者看不到"进入了一个工作空间"的感觉。
- **状态缺席**：没有系统反馈——生成中、连线流向、选中态、错误态都靠临时叠一个组件解决。
- **缺身份感**：产品没有记忆点。用户打开看到的第一屏 = 任何一个 React 白板脚手架。

Redesign 目标：
1. **画布即主角**：chrome 收拢为"浮层器皿"，让画布+节点本身承担 90% 视觉。
2. **一套 token 语言**：所有颜色/间距/字号/圆角/阴影/动画均派生自 tokens，禁止 inline 魔法值。
3. **状态可见**：生成中、可连、冲突、错误，都有专属视觉信号，不靠文字解释。
4. **记忆点**：奶白纸面 + 手绘墨线连接 + polaroid 式节点卡片 + 衬线 wordmark——第一眼就知道"这是一本设计师的 moodboard notebook"。
5. **可访问**：WCAG AA 文本对比度 4.5:1 以上，全键盘可用，`prefers-reduced-motion` 降级。

---

## 1. Design Principles

| # | Principle | 含义 | 反面案例（必须避免） |
|---|---|---|---|
| P1 | **Canvas-first chrome** | UI 器皿是浮层 / 纸边 hairline，永远让画布透出来 | 顶栏 = 实心底色横条 |
| P2 | **One accent, one signal** | 全局只有 1 个 CTA 色 = 秋叶 terracotta；1 个信号色 = 墨绿 teal | 紫色按钮 + 蓝色链接 + 绿色标签并存 |
| P3 | **Serif for voice, mono for data, sans for UI** | wordmark / 空态大标题走 Fraunces 衬线；元数据（坐标 / 尺寸 / 模型 / 时间）走 IBM Plex Mono；按钮 / 标签走 General Sans | 所有文本都一种字重，或用 Inter 开局 |
| P4 | **Shadow = paper lift, not glow** | 交互态用"纸张抬起"的柔阴影表达；**禁止**任何发光、霓虹、屏幕色 | 每个卡片都带外发光，或用亮色描边撞色 |
| P5 | **Hand-drawn only where it matters** | 手绘抖动只出现在 connection 墨线、selection 框、少量分隔线；UI 主体仍然几何精准 | 整个界面像贴纸涂鸦 |
| P6 | **Reduced motion is first-class** | 所有动效必须有静态 fallback；纸面方向天然克制，默认无 loop 动画 | 关掉动效后组件看不见 |

---

## 2. Information Architecture

App 分为 4 个**视觉层级**（z-index 从低到高）：

```
┌─ L0 Atmosphere ────────────────────────────────────┐
│   全屏扫描线渐变 + CRT 颗粒噪声（固定，不跟随画布）  │
│                                                     │
│  ┌─ L1 Canvas Surface ────────────────────────────┐│
│  │   Konva stage（被 Phosphor Grid 覆盖）         ││
│  │   - nodes（image/video/text/sticky/shape）     ││
│  │   - connections（neon polyline + glow）         ││
│  │   - ports（六边形霓虹点）                        ││
│  │                                                  ││
│  │  ┌─ L2 Anchored Overlays ──────────────────────┐││
│  │  │  NodeInputBar / NodeVersionSwitcher /        │││
│  │  │  NodeNoteIndicator / InpaintOverlay         │││
│  │  │  （跟随节点屏幕坐标）                         │││
│  │  └──────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────┘│
│                                                     │
│  L3 Floating Chrome（屏幕坐标，固定）                │
│   ├─ TopBar（logo + doc + undo/redo + queue + share）│
│   ├─ ToolDock（左侧垂直浮条）                        │
│   ├─ PropertiesPanel（右侧可折叠）                    │
│   ├─ HistoryPanel / AssetLibrary / PromptLibrary    │
│   ├─ AlignmentToolbar（多选时浮现）                  │
│   ├─ GenerationQueuePanel（右上角）                   │
│   └─ StatusBar（底部细条：坐标/缩放/工具提示）        │
│                                                     │
│  L4 Modal Stage（Modal / Sheet 出现时整屏压暗）       │
│   └─ SettingsModal / TemplatesModal / ...            │
└─────────────────────────────────────────────────────┘
```

**改动点（对比现状）**：
- 新增 L0 全屏 atmosphere 层（极淡纸面颗粒 + 边缘暗角）和 L4 modal stage（现在无）
- 新增 StatusBar（底部坐标/缩放/提示；现在散落在浮条）
- Chrome 全部从"实心块"改为"paper chip"：奶白面 + 1px 墨灰 hairline + 柔和 y-offset 投影
- Canvas 背景从灰点阵 → **淡暖米纸面** + 更柔的 dot grid（0.6px 墨点、24px 间距）

---

## 3. Critical User Flows

### 3.1 冷启动 → 创建第一个节点

```
[空画布] → 看到 EmptyState 中央提示（极小字号 + mono）"Press / to summon"
  → 按 / 或点左侧 Dock +  → 浮出 NodeMenu
  → 方向键/鼠标选 Image → 节点落在视口中心 + 一次扫描线沿节点扫过
  → 节点下方 NodeInputBar 自动出现并 focus
  → 输入 prompt → Enter → NodeInputBar 收起 + 节点转 AIGenerating 态（边框霓虹流动）
  → GenerationQueuePanel 右上角自动展开，显示此任务
  → 成功 → 节点瞬间淡入图像，queue 项 4s 后自消
```

**关键状态**：Empty / Spawning（120ms 扫线） / Idle / InputActive / Generating / Success / Error

### 3.2 连线驱动流（text → image）

```
[text 节点] 拖拽 Output:Text 端口 → 浮现半透明霓虹引线
  → 悬停 [image 节点] Input:Prompt → 端口吸附 + 端口环 bloom
  → 松手 → 连线 draw 动画（stroke-dashoffset 400ms）
  → image 节点出现 "inherited prompt" 标签角标
  → 在 image 的 NodeInputBar 点生成 → 上游文本被注入
```

### 3.3 局部重绘（F15 inpaint）

```
[image 节点 · 有 src] 在 NodeInputBar 点「局部重绘」chip
  → InpaintOverlay 接管节点上方（外围压暗 50%、中心透明）
  → 用户拖拽选框 → 框显示宽高 px + 画面占比 %
  → 输入新 prompt → 提交
  → 覆盖节点转 AIGenerating，保留原 versions
```

### 3.4 批量对齐

```
Shift+拖选 多节点 → AlignmentToolbar 从底部浮起（滑入 200ms）
  → 点「水平居中对齐」→ 所有节点在 180ms 缓动到目标位置
  → ToolBar 显示刚才的动作名 "Align center H"（2s 自隐）
  → Ctrl+Z 一步撤销所有位移
```

### 3.5 错误 → 重试 → 成功

```
[aigenerating 节点] 失败 → 节点体切换为 ErrorState
  （红色霓虹描边 + 右上角红色警示点）
  → 在面板上显示结构化错误：provider / code / message
  → 三个行动：重试、打开设置、解除占位
  → 点重试 → 节点回 AIGenerating + queue 新增一项（标记 retry）
```

---

## 4. Component Inventory（必须覆盖的 UI 对象）

### 4.1 画布元素（L1）
| Component | 现状 | 重设计要点 |
|---|---|---|
| ImageNode | 白底圆角矩形 | **Polaroid 纸卡**：奶白底 + 墨灰 hairline + 柔 y-offset 阴影；hover 阴影加深 2px；error / loading 有专属边框形态 |
| VideoNode | 同 image | 同 image 卡片语言 + 左下用 terracotta 墨色胶囊标 ⏵ / ⏸ |
| TextNode | 浅灰底 | **稿纸感**：极淡 ruled lines 背景 + 正文走 General Sans，引用 / 关键字高亮走 Fraunces italic |
| StickyNode | 便签黄 | 保留便签，但改成柔暖蜂蜡黄 oklch(0.94 0.11 90)，边缘微微翘起（0.5deg rotate + 阴影） |
| AudioNode | 长条 | 墨线波形 + 时间码 mono |
| Rectangle / Circle | 纯色填充 | 加细墨灰描边 + 纸质颗粒填充纹理 |
| AIGeneratingNode | 紫色边框 | **墨水扩散**动效：极淡脉动 terracotta 晕边 + 中央 mono "GENERATING · 0:12"（无扫描线） |
| Connection | SVG 线 | **手绘墨线**（SVG turbulence filter 微抖） + 墨滴箭头；激活时线条颜色加深、不发光 |
| Port | 小圆点 | **圆形墨点**，text=墨绿 / image=terracotta / video=芥末 / audio=墨紫；hover 外圈 1px 墨灰环（不发光） |
| SelectionRect | 虚线 | **手绘墨虚线框**（SVG 抖动 path），四角小墨色短切线 |

### 4.2 Anchored Overlays（L2，跟随节点）
- **NodeInputBar**：奶白 paper chip（14px 圆角 + 墨灰 hairline + 柔阴影）；mono 标签 + 衬线引导文字；terracotta 主按钮
- **NodeVersionSwitcher**：`◀ 2/5 ▶` 改成 **mono 计数器 + 墨点 dots**（选中态 dot 填为 terracotta）
- **NodeNoteIndicator**：**折角便签**造型，蜂蜡黄底，右上角用 SVG 画一个 1 像素折角
- **InpaintOverlay**：保留四向压暗策略；选框用手绘墨线抖动（而非实线）

### 4.3 Floating Chrome（L3）
- **TopBar**：左侧 Wordmark + 文件名 + Undo/Redo；中间面包屑（可选）；右侧 queue 徽章 + ThemeToggle + Profile + **PrimaryCTA「Share」**
- **ToolDock**：垂直浮条（左侧）。核心工具：Select / Hand / Frame / Text / Media（弹出菜单） / Shape / Sticky / Asset
- **PropertiesPanel**：右侧抽屉，tab: Style / AI / Data / Connections；空态时显示 mono tips
- **HistoryPanel**：时间轴抽屉（底部滑入）。每一步一个 chip + mono timestamp
- **AssetLibraryPanel**：左下角可拉开的 drawer / grid
- **PromptLibraryPanel**：从 NodeInputBar 右侧弹出的 side panel
- **AlignmentToolbar**：多选时从底部浮起胶囊
- **GenerationQueuePanel**：右上角折叠面板，任务卡片带状态指示灯
- **StatusBar**：底部细条（20px 高）。左：工具 tip；中：坐标 `(x, y) scale 1.00×`；右：节点数 / 选中数
- **CommandPalette** *(新增)*：Ctrl/⌘+K 触发，中心悬浮 mono list。

### 4.4 Modals（L4）
- **SettingsModal**：左侧 tab（Providers / General / Advanced / About），右侧内容
- **TemplatesModal**：顶部 filter 胶囊 + 网格 + hover 预览
- **AssetDetailModal**（新）：Asset 双击进入大图预览

### 4.5 Feedback
- **Toast**（新增）：右下滑入，autodismiss 4s
- **EmptyState**：不同场景不同 copy（canvas empty / no assets / queue empty / no history）
- **ErrorCard**（结构化）：statusCode | provider | message + 两个 action

### 4.6 状态矩阵（每个交互组件必须有 6 态）

| State | 视觉信号 |
|---|---|
| Default | 1px 墨灰 hairline + 柔阴影 shadow-1 |
| Hover | hairline → 墨色加深；shadow y-offset +2px；`--dur-sm` 120ms |
| Active / Pressed | 压下 translateY(1px)；shadow 减半模拟纸张贴回桌面 |
| Selected | 手绘墨线虚框（SVG wobble） + 右上 mono badge |
| Disabled | opacity 45% + cursor not-allowed；无阴影 |
| Loading | 墨水扩散脉动（terracotta 外圈 0→4px 柔晕，1200ms）；mono 计数器 |

---

## 5. Design Tokens（规范层；具体色值见 Stage 2）

### 5.1 色彩 token 命名
> 功能层 token 保持语义无关命名（便于未来换主题）；**Paper Studio 的语义别名**（--paper-*/--ink-*）放在 `02-aesthetic.md` 里声明。

```
--bg-0 / bg-1 / bg-2 / bg-3       # 浅色：奶白→稍深纸面；深色：墨纸→深绒
--fg-0 / fg-1 / fg-2 / fg-3       # 文字从强到弱（即"墨色深浅"）
--line / line-strong              # 墨灰 hairline
--accent / accent-hi              # 主强调（秋叶 terracotta）
--signal / signal-hi              # 次强调（墨绿 teal，仅 info / link / focus ring）
--warn / danger / success         # 语义色（不过饱和，与纸面共处）
--shadow-ink-1 / shadow-ink-2     # 纸面投影（偏暖黑、柔和）
--grid-dot                         # 画布 dot grid 色（极淡墨点）
--paper-grain                      # 纸面颗粒色（极低 alpha）
--port-text / port-image / port-video / port-audio  # 端口墨色
```

### 5.2 间距
4px 基准。spacing scale: `0 / 2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64`（单位 px，Tailwind 映射到 `0/0.5/1/1.5/2/3/4/5/6/8/12/16`）

### 5.3 圆角
- `--r-sm`: 8px（chip / button / input）
- `--r-md`: 12px（card inner / node head）
- `--r-lg`: 18px（panel / modal / polaroid node 外框）
- `--r-pill`: 999px（dock / segmented control）
- **禁止 0px 硬边**（纸面方向天然无直角；mono chip 的"尖锐感"改用细 hairline 边框表达）

### 5.4 字号阶梯（3× 跨度）
```
--fs-meta:  10px  mono  uppercase letter-spacing 0.08em
--fs-xs:    12px
--fs-sm:    13px  body default
--fs-md:    15px
--fs-lg:    20px
--fs-xl:    28px
--fs-2xl:   44px  hero / wordmark
--fs-3xl:   72px  display only
```

### 5.5 阴影（禁止发光）
```
--shadow-1:  inset 0 0 0 1px var(--line)                                  # hairline 细边
--shadow-2:  0 2px 4px -2px shadow-ink-1, 0 10px 24px -12px shadow-ink-2  # 纸面 lift（default）
--shadow-3:  0 4px 8px -4px shadow-ink-1, 0 18px 40px -16px shadow-ink-2  # 纸面 lift（hover）
--shadow-4:  0 8px 16px -8px shadow-ink-1, 0 32px 64px -24px shadow-ink-2 # modal
--shadow-press: 0 1px 0 0 shadow-ink-1                                    # 按下贴回
```
> **明令禁止**：`filter: drop-shadow(... color)`、outer glow ring、霓虹 box-shadow、任何超出黑/暖黑的 shadow color。

### 5.6 动效
```
--dur-xs: 120ms    # instant click feedback
--dur-sm: 180ms    # hover / chip
--dur-md: 260ms    # panel slide / node spawn
--dur-lg: 400ms    # connection stroke / modal open
--ease-snap:   cubic-bezier(0.2, 0.8, 0.2, 1)
--ease-stand:  cubic-bezier(0.4, 0.0, 0.2, 1)
```

---

## 6. Typography Pairing
- **Wordmark / Display / Editorial Hero**：**Fraunces**（Variable Serif，opsz + wght + SOFT + WONK 轴；primary axes 300–500；SOFT = 100 给一点点可爱而不过头）
- **UI Body / Labels / Buttons**：**General Sans**（Fontshare，几何人文 sans，400/500/600）
- **Mono（坐标、模型名、时间、版本、尺寸、错误码、路径、坐标系）**：**IBM Plex Mono**（400/500/600；比 JetBrains Mono 更暖一丝，配合纸面方向）
- **Italic**：正文里的引用 / keyword 用 `Fraunces italic`（纸面的灵魂在一点点的衬线 italic）

> `frontend-design-ultimate` 的 BANNED 清单：Inter / Roboto / Arial / Open Sans / 系统字体 —— **均已避免**。
> 既没有踩 display skill 里"sparingly"的 Space Grotesk 陷阱（我们这版不用 Space Grotesk）。

---

## 7. Accessibility

| 要点 | 目标 |
|---|---|
| 文本对比度 | Dark: fg-0 on bg-0 ≥ 12:1（约 oklch(0.97) on oklch(0.13)）；UI 元素 ≥ 3:1 |
| 焦点可见 | 所有可交互元素 `:focus-visible` = 2px accent outline + 2px offset |
| 键盘操作 | 所有菜单 / 面板 Tab 可达；Modal trap focus；Esc close |
| 色盲安全 | 不靠单一颜色表达状态（端口色 + 图标形状双通道） |
| 动效降级 | `@media (prefers-reduced-motion)`：禁用 scan 动画、glow pulse、grid pan；节点 spawn 直接淡入 |
| 屏幕阅读 | `role` / `aria-*` 完整；Canvas 区域提供 `aria-label="Infinite canvas with N elements"` |

---

## 8. 验收标准（每一版原型 / 代码必须跑完）

### 8.1 视觉
- [ ] 全局只用 1 种 primary CTA 色
- [ ] 没有任何 inline 颜色魔法值（`#fafafa`/`#3b82f6`），全部走 token
- [ ] 任一组件的 6 态（default/hover/active/selected/disabled/loading）都已设计
- [ ] 至少一个"记忆点"已就位（本次 = 磷光格栅 + 霓虹端口）

### 8.2 功能
- [ ] 键盘全链路：`/` 召唤菜单 / `⌘K` 命令面板 / `⌘Z` 撤销 / `Esc` 退出 / 方向键移动选中
- [ ] Light / Dark 双主题无破绽切换（含动效降级）
- [ ] `prefers-reduced-motion` 下所有画面静止可用

### 8.3 代码
- [ ] tokens 单文件 (CSS vars + Tailwind 扩展)；组件禁止自创色值
- [ ] 原组件目录结构保留；仅外观重构，store / 数据流不变
- [ ] 无新增 lint / type error（沿用现有 pre-existing 两处除外）

---

## 9. 不在本次 redesign 范围内

- ❌ 数据结构 / store 改动（`useCanvasStore`、`useGenerationQueueStore` 不动）
- ❌ AI provider / gateway 逻辑
- ❌ Konva 渲染器替换（节点仍然由 Konva 绘制，重设计只改填充/描边/字体/动效）
- ❌ 品牌名变更（保留 "AI 画布 Pro"）

下一步 → `02-aesthetic.md`（美学具体化：双主题 token 值、ASCII wireframe、动画 micro-syntax、氛围配方）。
