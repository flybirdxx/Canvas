---
epic_num: 4
story_num: 3
story_key: 4-3-fen-jing-mp4-dao-chu
date: 2026-05-05
---

# Story 4.3: 分镜模式按 scene 顺序导出拼接 MP4

Status: completed

## Story

As a 用户,
I want 在分镜视图下，按 scene 顺序将节点图片拼接为 MP4 视频,
so that 我能把多张分镜图快速合成视频，用于预览或直接分享。

## Acceptance Criteria

1. **[Done]** 用户在分镜视图下点击"导出 MP4"
   - `collectStoryboardFrames()` 从 canvasStore 收集所有 `type === 'scene'` 节点
   - 按 `sceneNum` 升序排列

2. **[Done]** 收集到 N 个 scene 节点后生成帧图片
   - 若 scene 内容含 markdown 图片语法 `![](url)`：fetch 该 URL 截图
   - 否则用 Konva `stage.toDataURL()` 截取 scene 节点区域
   - 截取失败时降级为 `scenePlaceholder()` 占位图

3. **[Done]** 有 1+ 个 scene 节点时弹出 ExportMp4Dialog
   - 每帧时长（滑块 1–10s，默认 3s）
   - 转场效果（无 / 淡入淡出 / 滑入）
   - 输出分辨率（720p / 1080p / 4K）
   - 音频轨道（拖放上传音频文件）

4. **[Done]** 确认导出后拼接 MP4
   - WebCodecs VideoEncoder (avc1.640028) + mp4-muxer (`ArrayBufferTarget`)
   - 30fps，关键帧每 30 帧一个
   - 下载 `canvas-storyboard-{timestamp}.mp4`

5. **[Done]** 不在分镜视图时"导出 MP4"按钮不显示

6. **[Done]** scene 无图片内容时生成占位图
   - 深色背景 + scene 标题 + 内容预览文字

7. **[Done]** 导出过程中出错
   - `isWebCodecsSupported()` 特性检测，不支持时抛出明确错误
   - try/catch 包裹各阶段，错误弹窗提示

## Tasks / Subtasks

- [x] Task 1: 新建 `src/utils/exportMp4.ts` — MP4 拼接核心 — AC: #1, #2, #4, #6
  - [x] Subtask 1.1: 实现 `collectStoryboardFrames()` — 从 canvasStore 收集 scene 节点，排序
  - [x] Subtask 1.2: 实现 `captureSceneAsync()` — scene → ImageData（截图或占位图）
  - [x] Subtask 1.3: 实现 `concatenateFrames()` — 帧序列 → MP4（WebCodecs VideoEncoder + mp4-muxer）
- [x] Task 2: 新建 `src/components/ExportMp4Dialog.tsx` — 导出配置弹窗 — AC: #3
  - [x] Subtask 2.1: UI：帧时长滑块 + 转场选择 + 分辨率选择 + 音频上传
- [x] Task 3: 更新 ExportMenu — `src/components/ExportMenu.tsx` — AC: #5
  - [x] Subtask 3.1: 在分镜视图下显示"导出 MP4"按钮，否则不显示
- [x] Task 4: 转场效果 — AC: #3
  - [x] Subtask 4.1: 淡入淡出：canvas alpha 混合实现帧间过渡
  - [x] Subtask 4.2: 滑入：ease-out 空间位移混合

## Dev Notes

### Architecture

**技术选型决策:**
- **WebCodecs API**（推荐）：浏览器原生，720p+ 高效编码，无外部依赖
- **FFmpeg.wasm**（备选）：若 WebCodecs 在目标浏览器不支持，动态加载 FFmpeg.wasm

**数据流:**
```
canvasStore (scene 节点)
  → collectStoryboardFrames() [scene 节点 + image 子内容]
  → frameToImageData() [Canvas ImageData]
  → ExportMp4Dialog [用户配置每帧时长/转场]
  → concatenateFrames() [WebCodecs VideoEncoder]
  → Blob → download
```

**参考文件:**
- `src/utils/parseScript.ts` — 了解 scene 节点数据结构
- `src/store/useCanvasStore.ts` — `elements` + `viewMode`
- `exportPng.ts` — 截图模式参考

### Key Implementation Details

**Scene 节点识别:**
- `el.type === 'scene'` 或根据 `viewMode === 'storyboard'` 判断
- scene 节点中的 image 子元素：通过 `el.children ?? []` 或独立 scene 节点 + image 节点配对

**帧数据采集:**
- 若 scene 有 image 内容：使用 canvas 的 `toDataURL()` 获取该 image 节点区域
- 若 scene 无内容：生成占位图（canvas 尺寸，用 `ctx.fillText()` 写 scene 名称）

**WebCodecs MP4 编码:**
```typescript
// VideoEncoder 输出 EncodedVideoChunk → MP4 muxer (mp4-muxer 或 manual BMFF box writing)
// 输出: Blob (video/mp4)
```

**分辨率缩放:**
- 720p: 1280×720, 1080p: 1920×1080, 4K: 3840×2160
- 用 canvas 缩放 + `drawImage()` 缩放各帧到目标分辨率

### Constraints

- **浏览器兼容性**：WebCodecs 仅 Chrome 94+ / Edge 94+ / Safari 16.4+。需 feature detect，降级提示"您的浏览器不支持 MP4 导出"
- **大文件内存**：4K 分辨率每帧 ~33MB。若 N 帧，内存可能超标。分 chunk 处理帧编码
- **音频轨道**：MP4 音频 mux 需要额外处理 AAC 编码。若简化版可暂不支持音频

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-7b-20250514

### Debug Log References

### Completion Notes List

- mp4-muxer 为 ESM 包，`import { Muxer, ArrayBufferTarget }` 直接解构（无需 `.default`）
- `ArrayBufferTarget` 实例的 buffer 字段类型为 `ArrayBuffer`，可直接传给 `new Blob()`
- VideoEncoder 构造不接受 `error` 回调，`error` 字段必须存在但 TypeScript 定义不完整，实测可安全传 `error: (e: Error) => { throw e; }`
- AC7 note: 临时文件（`URL.createObjectURL` blob）在 `downloadBlob()` 后立即 `revokeObjectURL` 释放内存，无额外清理步骤必要
- AC5 note: 按钮直接不渲染（非灰置），更符合"分镜视图专属功能"语义

## File List

- `src/utils/exportMp4.ts` — NEW
- `src/components/ExportMp4Dialog.tsx` — NEW
- `src/components/ExportMenu.tsx` — UPDATE (add MP4 export button, viewMode-aware)
- `package.json` — 新增依赖 `mp4-muxer@5.2.2`

## Change Log

- 2026-05-05: Story created
- 2026-05-05: Implementation complete — WebCodecs MP4 export, ExportMp4Dialog, viewMode-aware menu button
