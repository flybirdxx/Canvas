# AI 无限画布 · 高保真原型

这份原型把 [PRD](../docs/PRD.md) 描述的 6 个关键界面做成了可交互的单文件页面。没有真实 API，没有数据存储，打开即看。

## 运行

直接双击 `index.html`，或者在浏览器里拖开。依赖全部走 CDN：

- [Tailwind Play CDN](https://cdn.tailwindcss.com)（含 forms / typography 插件）
- [Lucide Icons](https://unpkg.com/lucide@latest)

离线环境需要代理或本地镜像。

## 6 屏索引

| # | 名称 | 锚点 | 关注点 | 对应 PRD 特性 |
| - | - | - | - | - |
| 1 | Canvas 主视图 | `#canvas` | 默认工作界面 + 选中图片节点 + NodeInputBar + 批量变体网格 | 现状能力 · F10 · F11 |
| 2 | 模型网关 | `#nodebar` | NodeInputBar 模型下拉展开，文/图/视频按能力分组 | F7 · F11 |
| 3 | 分镜模式 | `#story` | 剧本大纲 + 6 个 scene 卡片（含 running / failed 状态） | F14 · F16 · F19 |
| 4 | 运行面板 | `#run` | 画布节点 5 状态 + 右侧滑出运行面板 + 日志 | F19 · F20 · F12 |
| 5 | 资源库 | `#assets` | 左侧抽屉（素材 / 最近 / 收藏 / 模板）+ 模板市场预览 | F21 · F22 |
| 6 | 导出 | `#export` | PNG / PDF / MP4 / ZIP / 只读链接 + 预览 + 分辨率选项 | F6 · F23 |

## 交互方式

- 顶部中间的胶囊按钮直接跳屏。
- URL 带 `#` 锚点（例如 `index.html#story`）可直接进入指定屏。
- 数字键 `1–6` 对应 6 屏切换（输入区聚焦时忽略）。

## 原则与不做

- 所有按钮 / 输入框只有视觉态，**不触发真实逻辑**。
- 不做响应式，固定 1440 宽优化，窄屏可能错位——这和 PRD "PC 优先" 的结论一致。
- 不写单独 CSS / JS 文件，一切嵌在 `index.html`；改动只此一处。
- 不用 `<canvas>` 渲染节点图，改用 `<div>` + SVG 画连线，HTML 审查更轻。

## 与设计规格的对应关系

| 原型元素 | 设计规格章节 | 代码位置（现有实现） |
| - | - | - |
| 点阵画布 + 左胶囊工具栏 + 顶部栏 | [design-spec §3.1](../docs/design-spec.md#31-canvas-主视图默认) | [`Canvas/src/App.tsx`](../src/App.tsx) |
| 节点 + 端口 | design-spec §5.3 | [`Canvas/src/components/canvas/CanvasElements.tsx`](../src/components/canvas/CanvasElements.tsx) |
| NodeInputBar | design-spec §5.4 | [`Canvas/src/components/NodeInputBar.tsx`](../src/components/NodeInputBar.tsx) |
| 分镜网格 | design-spec §3.2 | 新增（F16，V1） |
| 运行面板 | design-spec §3.3 | 新增（F20，V1） |
| 资源库抽屉 | design-spec §1 IA | 新增（F21，MVP） |
| 导出对话框 | design-spec §1 IA | 新增（F23，V1） |

## 已知偏差

- **按钮真实产品没有这么密**。原型为了呈现能力，把很多"隐藏控件"同时露出，例如运行面板上的日志等级切换。实际交付时会默认收起。
- **颜色对比度**：部分辅助文字在浅底上色阶偏浅（`gray-400`），最终实现时会统一走设计令牌中的 `text.secondary/tertiary`，满足 WCAG AA。
- **分镜卡片的占位图用了渐变**。真实产品里是生成结果的实际图片；这里仅作视觉占位，请勿误读为产品 VI。

## 改动须知

如果要扩充到 7 屏以上：

1. 复制任一 `<section class="screen"...>` 块并改 `id`。
2. 在顶部 screen-switcher `<div class="screen-switcher">` 追加一个 button，`data-goto` 与新 id 的后缀保持一致。
3. 在底部 `<script>` 的 `idx` 数组里追加名字，保证数字键仍工作。
