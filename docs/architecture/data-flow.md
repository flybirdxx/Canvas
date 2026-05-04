# 数据流

## 状态全景

```
useCanvasStore (Zustand + persist)
├── elements: CanvasElement[]       ← 整个画布的唯一数据源
├── connections: Connection[]       ← 连线（含环检测逻辑在 addConnection 中）
├── stageConfig: { scale, x, y }   ← 视口变换（影响所有屏幕坐标换算）
├── past: HistorySnapshot[]         ← 撤销栈，MAX=50，不持久化
├── future: HistorySnapshot[]       ← 重做栈，不持久化
├── selectedIds: string[]           ← 当前选中节点
├── activeTool: string              ← 当前工具模式
├── drawingConnection: DrawingConnection | null  ← 连线绘制中临时态
├── inpaintMask: InpaintMaskState | null         ← 局部重绘会话
├── _coalesceKey / _coalesceAt     ← 编辑合并防抖标记
└── lastSavedAt: number | null      ← 最后自动保存时间

useSettingsStore       ← API Key / Base URL / 偏好
useGenerationQueueStore ← 生成队列
useAssetLibraryStore    ← 资产库（独立 persist key: 'ai-canvas-asset-library'）
usePromptLibraryStore   ← 提示词预设库（独立 persist key）
```

## 节点生命周期

```
创建
  addElement(element)
  → 自动分配 input/output ports（按节点类型规则）
  → 推入 past 栈
  → 清空 future
  → persist 写入（300ms 防抖）

编辑
  updateElement(id, attrs)
  → 查找目标节点 → 合并属性
  → 500ms 合并窗口：同 id + 同属性 key 的连续 edit 合并一个 undo 步
  → 否则推入 past 栈
  → persist 写入

拖拽
  updateElementPosition(id, x, y)
  → 直接替换 position — 不推入 past（每帧调用，历史栈只记录最终位置）
  → persist 写入（受 300ms 防抖）

批量位移
  batchUpdatePositions([{id, x, y}, ...])
  → 一次性更新多节点 position
  → 推入 past（整个操作作为单步 undo）
  → 用于对齐/分布操作

删除
  deleteElements(ids)
  → 从 elements 中过滤
  → 级联删除涉及这些 id 的所有 connections
  → 从 selectedIds 中移除
  → 推入 past

替换
  replaceElement(oldId, newElement)
  → 原地替换节点（同 index）
  → 继承老节点的 ports（如 newEl 未提供或为空数组）
  → 重写所有指向 oldId 的 connection fromId/toId（保持 portId 不变）
  → 推入 past（单步 undo）
  → 用途：生成占位符替换 / 文件节点版本更新

清空
  clearCanvas()
  → 推入当前快照到 past
  → elements=[], connections=[], selectedIds=[]
```

## 从 Store 到 Canvas 的渲染路径

```
Zustand state 变化
  → React re-render（useCanvasStore selector）
    → InfiniteCanvas
      → CanvasElements（遍历 elements）
        → 按 element.type 分派渲染：

type === 'rectangle' → Konva Rect   (fill: --accent-bg, cornerRadius, stroke)
type === 'circle'    → Konva Ellipse
type === 'text'      → Konva Text   (fontFamily, fontSize, align, lineHeight)
type === 'image'     → useImage(src) + Konva Image + Transformer
type === 'sticky'    → Konva Rect + Text + drag handle
type === 'video'     → Konva Image (poster/第一帧) + play overlay
type === 'audio'     → 自定义波形 + play overlay
type === 'file'      → 按 MIME 分派：
  ├── image/* → Konva Image (用 thumbnailDataUrl 或 src)
  ├── video/* → Konva Image (thumbnailDataUrl) + play overlay
  ├── audio/* → 波形图 (thumbnailDataUrl) + play overlay
  ├── application/pdf → PDF 预览 (thumbnailDataUrl) 或附件卡片
  └── 其他 → 通用附件卡片 (文件名 + 大小 + 类型图标)

type === 'aigenerating' →
  ├── 有 error  → 错误面板（含重试按钮 + 错误详情）
  ├── 有 pendingTask → 等待中骨架屏 + 已等待时长
  └── 无 error  → 加载动画骨架屏
```

## AI 生成数据流

```
1. 用户在 NodeInputBar 填写 prompt + 选模型 + 调参数 → 点击生成

2. imageGeneration.runGeneration(element, settings)
   │
   ├── flowResolver.collectUpstreams(element, elements, connections)
   │   递归收集上游 text/image 节点内容 → 拼入 prompt
   │
   ├── 创建 AIGeneratingElement 占位符（replaceElement 替换原节点）
   │
   ├── gateway.generateImageByModelId(request)
   │    → findModel(modelId) → getProvider(providerId)
   │    → provider.generateImage(request, config)
   │
   ├── 结果处理
   │   ├── ok: true
   │   │   → replacePlaceholderWithImage()
   │   │     → replaceElement 原子替换 AIGeneratingElement → ImageElement
   │   │     → 追加 versions（新版本到 history 末尾）
   │   │     → 更新 asset library
   │   │
   │   ├── ok: 'pending'（仅异步 provider）
   │   │   → 写 PendingGenerationTask 到 placeholder
   │   │   → taskResume 启动周期性轮询（每 3 分钟）
   │   │   → 轮询成功 → replacePlaceholderWithImage
   │   │   → 轮询超时/失败 → 写 error 到 placeholder
   │   │
   │   └── ok: false
   │       → 构造 AIGenerationError → 写到 placeholder.error
   │       → UI 展示错误面板（含 retry 按钮，保留完整 request）
```

## 持久化策略

### 写入

```
Zustand set() → persist middleware → JSON.stringify(partialized state)
  → ThrottledLocalStorage.setItem()
    → 缓存 {key, value}，启动/重置 300ms 定时器
    → 300ms 内新写入覆盖旧值（最后一次胜出）
    → 定时器触发 → localStorage.setItem()
```

### 兜底

```
beforeunload / pagehide 事件 → flush() 同步写入
  → 清除定时器 → 立即 setItem → 确保不丢最后几百 ms 的编辑
```

### 已知限制

- data URL 图像/视频以 base64 字符串存在 localStorage，单节点可达数 MB
- 大量大节点 → localStorage quota (5-10MB) 可能溢出
- v2 路线：>1MB 的内容迁移到 IndexedDB，localStorage 仅存元数据 + blob key
