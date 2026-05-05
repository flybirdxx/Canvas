---
epic_num: 4
story_num: 2
story_key: 4-2-duo-ge-shi-dao-chu
date: 2026-05-05
---

# Story 4.2: SVG / PDF / HTML 多格式导出增强

Status: completed

## Story

As a 用户,
I want 画布可导出为高质量 SVG、独立 HTML 和 PDF（含中文字体）,
so that 我能把作品分享为可独立浏览的网页或打印文档，不依赖浏览器。

## Acceptance Criteria

1. **[Done]** 用户选中若干节点后点击"导出 SVG"
   - `exportSvg.ts` 遍历 elements，按类型生成对应 SVG 元素（`<rect>`、`<ellipse>`、`<image>`、`<text>`）
   - image 节点 crossOrigin → canvas drawImage → toDataURL 转 base64 嵌入 `<image href>`
   - 连接线用 `<path d="bezierCurve">` 渲染
   - 中文字符检测 `hasChinese()` 自动映射 Noto Sans SC / PingFang SC 字体族

2. **[Done]** 用户点击"导出 PDF"
   - `exportAsCustomPdf(size)` 支持 'a4' | 'a3' | 'letter' | 'viewport' 四种尺寸
   - Bounding box 居中渲染到 PDF，带 margin 和 scale 适配
   - 含中文时动态 fetch NotoSansCJK TTF → `addFileToVFS` + `addFont` 注入字体

3. **[Done]** 用户点击"导出 HTML"
   - `exportAsStandaloneHtml()` 生成自包含 HTML，base64 图片嵌入
   - 每个节点按 canvas 坐标 `position:absolute` 精确排列

4. **[Done]** 画布有 text 或 sticky 节点
   - text/sticky 渲染为 `<div class="node-text">` 可复制文本
   - image 节点以 `<img src="data:...">` base64 嵌入

5. **[Done]** 画布有连接线
   - SVG `<path>` 贝塞尔曲线渲染连线

6. **[Done]** 导出过程中发生错误
   - 所有函数 try/catch + alert() 友好提示，无崩溃路径

## Tasks / Subtasks

- [x] Task 1: 增强 SVG 导出 — `src/utils/exportSvg.ts` — AC: #1, #6
  - [x] Subtask 1.1: 实现 node-aware SVG 导出（遍历 elements，生成对应 SVG 元素而非 rasterize）
  - [x] Subtask 1.2: 将 image 节点内容 base64 嵌入 SVG
- [x] Task 2: 增强 PDF 导出 — `src/utils/exportPdf.ts` — AC: #2, #6
  - [x] Subtask 2.1: 实现自定义尺寸选项（A4/A3/Custom）
  - [x] Subtask 2.2: 实现中文支持：检测中文内容，嵌入 NotoSansCJK 字体子集
  - [x] Subtask 2.3: PDF 内容基于 bounding box（Konva toDataURL rasterize）
- [x] Task 3: 增强 HTML 导出 — `src/utils/exportHtml.ts` — AC: #3, #4, #5, #6
  - [x] Subtask 3.1: 将所有 image 节点 base64 嵌入 `<img>`
  - [x] Subtask 3.2: 将 text/sticky 内容渲染为可复制文本
  - [x] Subtask 3.3: 用 SVG 渲染连线（贝塞尔曲线）
- [x] Task 4: 更新 ExportMenu — `src/components/ExportMenu.tsx` — AC: #2
  - [x] Subtask 4.1: 在 PDF 导出菜单项中添加尺寸选择子项（PdfSizeSubmenu 组件）

## Dev Notes

### Architecture

**现有导出基础设施:**
- `src/utils/exportSvg.ts` — 已有 `exportSelectionAsSvg()`，仅 rasterize stage
- `src/utils/exportPdf.ts` — 已有 `exportViewportAsPdf()` + `exportSelectionAsPdf()`，基于 jsPDF rasterize
- `src/utils/exportHtml.ts` — 已有 `exportAsStandaloneHtml()`，基础 DOM 序列化

**文件位置参考:**
- `ExportMenu.tsx` — 导出菜单入口
- `exportPng.ts` — 已有 screen-space 坐标转换模式
- `stageRegistry.ts` — `getStage()` 获取 Konva Stage

### Key Implementation Details

**SVG 导出（node-aware）:**
```
遍历 elements:
  - rectangle: <rect x={x} y={y} width={w} height={h} fill={fill} />
  - circle: <ellipse cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2} />
  - image: <image href={base64(src)} x={x} y={y} width={w} height={h} />
  - text/sticky: <text x={x} y={y}>{text}</text> （字体映射）
  - connection: <path d={bezierCurve} /> （贝塞尔参数）
```

**PDF 中文字体策略:**
- 检测节点文本中是否含中文字符（`/[\u4e00-\u9fa5]/.test(text)`）
- 若含中文，动态加载开源中文字体（如 Google Fonts NotoSansCJK subset）
- jsPDF `addFont()` + `setFont()` 注入字体子集

**HTML 导出增强:**
- 用 `<div class="canvas-container">` 包裹
- 每个节点: `<div class="node node-{type}">`
- text/sticky 内容: `<div class="node-text">{text}</div>`
- 布局: CSS Grid 按节点 x/y 排列（`grid-column/grid-row`）

### Constraints

- **SVG foreignObject 限制**：Safari 不完全支持 SVG 内嵌 HTML foreignObject。text/sticky 在 SVG 中渲染受限，需降级为 SVG `<text>`
- **中文字体体积**：完整中文字体包过大。策略：按需加载字体子集（仅包含使用到的汉字）
- **图片跨域**：canvas 中的 image 可能来自跨域 URL。base64 嵌入需要 canvas `taint` 处理——现有 `exportPng.ts` 已处理，参考其 try/catch 模式

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-7b-20250514

### Debug Log References

### Completion Notes List

- AC3 note: HTML 布局使用 `position:absolute` 而非 CSS Grid，以完整保留节点原始 canvas 坐标
- AC2 note: PDF 中文字体注入依赖网络 fetch，失败时静默降级（光栅化内容不受字体影响）

## File List

- `src/utils/exportSvg.ts` — UPDATE (node-aware SVG generation)
- `src/utils/exportPdf.ts` — UPDATE (custom size, Chinese font embedding)
- `src/utils/exportHtml.ts` — UPDATE (enhanced node rendering, connections)
- `src/components/ExportMenu.tsx` — UPDATE (PDF size submenu, async SVG/HTML handlers)

## Change Log

- 2026-05-05: Story created
- 2026-05-05: Implementation complete — node-aware SVG/PDF/HTML export, PDF size submenu
