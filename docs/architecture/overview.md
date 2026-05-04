# 技术架构总览 · Warm Paper Studio

## 项目定位与设计理念

AI 画布 Pro (Warm Paper Studio) 是一个无限画布单页应用，核心理念是**节点即文档、连线即工作流**。用户在纸质肌理的画布上放置文本/图片/视频/音频节点，通过连线定义数据流向，接入多 AI Provider 完成图像和视频生成。

设计原则：

| 原则 | 实现方式 |
|------|----------|
| 节点即文档 | 每种节点自带完整交互：拖拽/缩放/旋转/属性编辑/注释 |
| 连线即工作流 | 端口类型匹配 + 上游内容自动收集，驱动 AI 生成参数 |
| 全操作可撤销 | Zustand 快照栈，最多 50 步，智能合并连续编辑 |
| 视觉即品牌 | Warm Paper 色板 + 纸质肌理 + Fraunces 字体，区别于工具化 UI |
| 持久化零感知 | localStorage 自动保存，300ms 防抖，跨刷新恢复 pending 任务 |

## 技术栈一览

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 框架 | React | 19 | UI 渲染 |
| 构建 | Vite | 6 | 开发/打包 |
| 语言 | TypeScript | 5.8 | 类型安全 |
| Canvas | Konva + react-konva | 10 / 19 | 2D 画布渲染 |
| 状态 | Zustand | 5 | 全局状态 + persist 中间件 |
| 样式 | TailwindCSS | 4 | 原子化 CSS + CSS 变量主题 |
| 动画 | motion (framer-motion) | 12 | 声明式动画 |
| 后端 | Express | 4 | 仅图床代理 (imgbb) |
| AI SDK | @google/genai | 1.50 | Gemini 文本生成（预留） |

## Z-Index 分层架构

```
z=60 ─ 模态层     SettingsModal · TemplatesModal
z=30 ─ Chrome 层   TopBar · ToolDock · 面板们 · StatusBar · FloatingActions
z=20 ─ Konva DOM 浮层 NodeInputBar · NodeVersionSwitcher · InpaintOverlay · NodeNoteIndicator
z=2  ─ 暗角晕影   vignette
z=1  ─ 纸质肌理   paper grain (mix-blend: multiply)
z=0  ─ 画布表面   点格背景 + Konva Stage + Layer
```

每层独立定位，互不干扰。DOM 浮层通过 `stageConfig.{x,y,scale}` 换算屏幕坐标，跟随画布平移缩放。

## 项目文件结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # App Shell（布局 + 快捷键 + 生命周期）
├── index.css                   # TailwindCSS + CSS tokens
├── types/
│   └── canvas.ts               # 核心类型定义（7 种节点 + Connection + Port）
├── components/
│   ├── canvas/
│   │   ├── InfiniteCanvas.tsx  # 画布主控（事件/视图变换/拖放）
│   │   └── CanvasElements.tsx  # 节点渲染分派器
│   ├── chrome/
│   │   ├── TopBar.tsx          # 顶栏
│   │   └── ToolDock.tsx        # 左侧工具坞
│   ├── properties/
│   │   └── PropertiesPanel.tsx # 属性面板
│   ├── NodeInputBar.tsx        # 节点底栏（prompt/模型/生成参数）
│   ├── NodeVersionSwitcher.tsx # 版本历史切换器
│   ├── InpaintOverlay.tsx      # 局部重绘蒙版
│   ├── NodeNoteIndicator.tsx   # 注释标记
│   ├── HistoryPanel.tsx        # 操作历史
│   ├── AssetLibraryPanel.tsx   # 资产库
│   ├── AlignmentToolbar.tsx    # 对齐工具栏
│   ├── GenerationQueuePanel.tsx# 生成队列
│   ├── StatusBar.tsx           # 状态栏
│   ├── SettingsModal.tsx       # 设置
│   ├── TemplatesModal.tsx      # 模板
│   ├── FloatingActions.tsx     # 浮动按钮组
│   ├── ExportMenu.tsx          # 导出菜单
│   ├── Atmosphere.tsx          # 纸质肌理 + SVG defs
│   └── ...
├── store/
│   ├── useCanvasStore.ts       # 画布主 Store（elements/connections/history）
│   ├── useSettingsStore.ts     # 设置（API Key/偏好）
│   ├── useGenerationQueueStore.ts
│   ├── useAssetLibraryStore.ts
│   └── usePromptLibraryStore.ts
├── services/
│   ├── gateway/
│   │   ├── index.ts            # Provider 注册表 + 路由
│   │   ├── types.ts            # GatewayProvider 接口定义
│   │   └── providers/
│   │       ├── t8star.ts       # T8Star Provider 实现
│   │       └── runninghub.ts   # RunningHub Provider 实现
│   ├── imageGeneration.ts      # 图像生成服务层
│   ├── videoGeneration.ts      # 视频生成服务层
│   ├── taskResume.ts           # 跨会话 pending 任务恢复
│   ├── fileIngest.ts           # 文件摄取（File → FileElement）
│   ├── fileNodeTelemetry.ts    # file 节点埋点观察
│   └── imgHost/
│       └── imgbb.ts            # 图床上传代理
├── utils/
│   ├── flowResolver.ts         # 上游内容递归收集
│   ├── alignment.ts            # 对齐/分布算法
│   ├── exportPng.ts            # PNG 导出
│   ├── gridLayout.ts           # 网格布局
│   ├── instantiateTemplate.ts  # 模板实例化
│   ├── mask.ts                 # 蒙版生成
│   └── stageRegistry.ts        # Konva Stage 全局注册
└── data/
    ├── promptLibrary.ts        # 内置提示词库
    └── templates.ts            # 内置模板
```

## 运行时生命周期

1. **启动** → StrictMode 挂载 App → Zustand persist rehydrate (localStorage 同步读取)
2. **恢复** → `taskResume.resumePendingImageTasks()` 扫描带 `pendingTask` 的 AIGeneratingElement，调用 `pollImageTaskByProviderId` 接回未完成任务
3. **运行** → 节点 CRUD → 连线 → AI 生成 → 300ms 防抖持久化 → 周期性任务扫描（每 3 分钟）
4. **关闭** → `beforeunload` / `pagehide` 事件 → `flush()` 强制将最后一次 set 写入 localStorage
