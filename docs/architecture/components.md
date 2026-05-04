# 组件树与职责矩阵

## 组件全景图

```
App
├── TopBar                        — 顶栏：项目标题 + 设置/模板入口
├── ToolDock                      — 左侧工具坞：节点创建面板 + 工具切换
│   └── (内部：FlowDock 文件上传通道)
├── FloatingActions               — 右下浮动圆形按钮组（模板、Chat）
├── InfiniteCanvas (核心)          — Konva Stage 无限画布
│   ├── CanvasElements            —   所有节点的 Konva 渲染 + 拖拽/选中/变换
│   ├── NodeInputBar (DOM 浮层)   —   选中节点的底栏（prompt/模型/档位）
│   ├── NodeVersionSwitcher       —   生成版本历史缩略图切换器
│   ├── InpaintOverlay (DOM 浮层) —   局部重绘蒙版绘制层
│   └── NodeNoteIndicator         —   节点右上角注释标记
├── PropertiesPanel               — 右侧属性面板：节点详细属性编辑
├── HistoryPanel                  — 左侧操作历史时间线（undo/redo 可跳转）
├── AssetLibraryPanel             — 资产库面板：图片/视频素材，拖入画布
├── AlignmentToolbar              — 多选对齐/分布工具栏（6 种对齐 + 2 种分布）
├── GenerationQueuePanel          — AI 生成队列侧栏
├── StatusBar                     — 底部状态栏：保存时间/缩放率/连线数
├── Atmosphere                    — 纸质肌理 + 暗角晕影 + SVG 滤镜定义
├── SettingsModal (模态)          — API Key 配置 / Provider 管理 / 偏好
└── TemplatesModal (模态)         — 模板库：预设布局一键实例化
```

## 组件职责矩阵

| 组件 | 自身状态 (useState) | 读取 Store | 写入 Store | 副作用 |
|------|---------------------|------------|------------|--------|
| App | 模态开关、键盘事件 | elements, stageConfig, activeTool, selectedIds | addElement, setActiveTool, setSelection, undo, redo, deleteElements | 快捷键绑定、pending 任务恢复（周期性）、open-settings 事件监听 |
| InfiniteCanvas | 右键菜单位置、框选框、选框导出状态 | elements, connections, stageConfig, activeTool, drawingConnection, inpaintMask, selectedIds | setStageConfig, addElement, addConnection, setSelection, setDrawingConnection, setActiveTool | Konva Stage 全局注册、Space 键平移切换、拖放事件、文件上传 |
| CanvasElements | — | elements, selectedIds | updateElement, updateElementPosition, replaceElement, setSelection | Port hover 检测、inpaint 交互 |
| NodeInputBar | prompt 文本、展开状态 | settings (API Key) | updateElement (prompt/generation) | 调用 imageGeneration / videoGeneration |
| PropertiesPanel | — | elements (selected), connections | updateElement, deleteElements | — |
| HistoryPanel | — | past, future, currentLabel | undo, redo, jumpToHistory | — |
| AssetLibraryPanel | 展开/折叠 | — | addElement (拖放) | 资产增删持久化 |
| AlignmentToolbar | — | selectedIds, elements | batchUpdatePositions | — |
| GenerationQueuePanel | — | elements (AIGeneratingElement) | — | — |
| StatusBar | — | elements, connections, stageConfig, lastSavedAt | — | 实时刷新 |
| SettingsModal | — | settings store | settings store | API Key 持久化 |
| TemplatesModal | — | elements, stageConfig | clearCanvas, addElement | 模板实例化 + 网格布局 |
| Atmosphere | — | stageConfig | — | SVG 滤镜注入 DOM |

## State 分类原则

### 持久化状态（Zustand persist → localStorage）

```
elements: CanvasElement[]      — 全部节点
connections: Connection[]      — 全部连线
stageConfig: { scale, x, y }  — 视口变换
lastSavedAt: number | null     — 最后保存时间戳
```

### 会话临时状态（Zustand，不持久化）

```
past: HistorySnapshot[]        — 撤销栈 (max 50)
future: HistorySnapshot[]      — 重做栈
selectedIds: string[]          — 当前选中
activeTool: string             — 当前工具
drawingConnection: DrawingConnection | null  — 连线绘制中的临时线
inpaintMask: InpaintMaskState | null         — 局部重绘状态
_coalesceKey / _coalesceAt     — 编辑合并防抖标记
```

### UI 局部状态（React useState / useRef）

```
模态开关: isSettingsOpen, isTemplatesOpen
画布交互: quickAddMenu, selectionBox, marquee, isSpacePressed
Konva ref: stageRef, containerRef
```

### 全局交互事件（window CustomEvent）

```
open-settings           → 任意深层组件请求打开设置模态
canvas:start-marquee-export → 菜单/热键触发选框导出模式
```

## 组件通信模式

1. **Zustand 直连** — 大部分组件直接从 Store 读取，不经过 props 逐层传递
2. **CustomEvent 总线** — 用于跨层级触发模态等一次性动作
3. **回调 props 传递** — App → 直接子组件（ToolDock.onCreate, TopBar.onOpenSettings），仅一层
4. **模块级注册表** — `stageRegistry` 将 Konva Stage 实例存入模块变量，export 工具无需 prop drilling
