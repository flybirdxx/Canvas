# 项目架构重构建议

## 现状诊断

通过代码分析，主要耦合问题有：

1. **Store 直接被 Service 层调用**（`imageGeneration.ts` 直接 `useCanvasStore.getState()`）
2. **组件层混杂业务逻辑**（`NodeInputBar.tsx` 1000+ 行，包含生成调度、状态管理、UI）
3. **跨层依赖混乱**（Service → Store → Component 的单向依赖被反复打破）
4. **类型定义分散**（`canvas.ts`、`gateway/types.ts`、各 store 各自定义）

---

## 建议分层架构

```
src/
├── core/                    # 纯领域逻辑，零依赖
│   ├── types/               # 统一类型定义
│   ├── domain/              # 领域模型与纯函数
│   └── ports/               # 抽象接口（依赖倒置）
│
├── infrastructure/          # 外部系统适配层
│   ├── gateway/             # AI Provider 网关（现有）
│   ├── storage/             # 持久化（IndexedDB、localStorage）
│   └── imgHost/             # 图床上传
│
├── application/             # 应用用例层
│   ├── usecases/            # 具体用例编排
│   ├── store/               # 状态管理（Zustand）
│   └── services/            # 应用服务（协调 store + infra）
│
├── presentation/            # 纯展示层
│   ├── canvas/              # 画布渲染
│   ├── panels/              # 面板组件
│   ├── chrome/              # 顶栏/工具栏
│   └── ui/                  # 原子 UI 组件
│
└── shared/                  # 跨层共享工具
    ├── utils/
    └── hooks/
```

---

## 各层详细设计

### 1. Core 层 — 零外部依赖

```
core/
├── types/
│   ├── canvas.ts            # CanvasElement、Connection 等（从现有迁移）
│   ├── generation.ts        # GenRequest、GenResult 等
│   ├── execution.ts         # ExecutionRun、NodeStatus 等
│   └── index.ts             # 统一导出
│
├── domain/
│   ├── canvas/
│   │   ├── alignment.ts     # 对齐纯函数（现有 utils/alignment.ts）
│   │   ├── layout.ts        # gridLayout.ts 迁移
│   │   ├── flow.ts          # flowResolver.ts 迁移
│   │   └── portDefaults.ts  # 端口默认值
│   ├── generation/
│   │   ├── pricing.ts       # 价格计算纯函数
│   │   └── sizePresets.ts   # 尺寸预设常量
│   └── execution/
│       └── topology.ts      # topologicalSort（从 executionEngine 提取）
│
└── ports/                   # 抽象接口（依赖倒置核心）
    ├── ICanvasRepository.ts
    ├── IGenerationService.ts
    ├── IStorageService.ts
    └── IImageHostService.ts
```

**关键设计：`ports/` 定义接口，上层依赖接口而非实现**

```typescript
// core/ports/IGenerationService.ts
export interface IGenerationService {
  generateImage(req: ImageGenRequest): Promise<ImageGenResult>;
  generateVideo(req: VideoGenRequest): Promise<VideoGenResult>;
  generateText(req: TextGenRequest): Promise<TextGenResult>;
  pollTask(providerId: string, taskId: string): Promise<ImageGenResult>;
}

// core/ports/ICanvasRepository.ts
export interface ICanvasRepository {
  getElements(): CanvasElement[];
  getElementById(id: string): CanvasElement | undefined;
  addElement(element: CanvasElement): void;
  updateElement(id: string, patch: Partial<CanvasElement>): void;
  replaceElement(oldId: string, newElement: CanvasElement): void;
  deleteElements(ids: string[]): void;
}
```

---

### 2. Infrastructure 层 — 外部适配

```
infrastructure/
├── gateway/                 # 现有 services/gateway/ 迁移
│   ├── providers/
│   │   ├── t8star.ts
│   │   └── runninghub.ts
│   ├── registry.ts          # Provider 注册中心
│   └── GatewayGenerationService.ts  # 实现 IGenerationService
│
├── storage/
│   ├── IndexedDBStorage.ts  # fileStorage.ts 迁移
│   ├── LocalStorageAdapter.ts
│   └── BlobMigration.ts
│
└── imgHost/
    └── ImgbbService.ts      # imgbb.ts 迁移，实现 IImageHostService
```

```typescript
// infrastructure/gateway/GatewayGenerationService.ts
// 实现 core/ports/IGenerationService.ts 接口
export class GatewayGenerationService implements IGenerationService {
  async generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
    return generateImageByModelId(req); // 委托现有实现
  }
  // ...
}
```

---

### 3. Application 层 — 用例编排

这是**重构最重要的层**，负责解耦 Service 与 Store 的直接依赖。

```
application/
├── store/                   # 现有 store/ 保持结构，但不被 service 直接调用
│   ├── canvas/
│   │   ├── slices/          # 现有 slices 迁移
│   │   └── useCanvasStore.ts
│   ├── useExecutionStore.ts
│   ├── useGenerationQueueStore.ts
│   └── ...
│
├── services/                # 应用服务（协调层），替代现有 services/
│   ├── generation/
│   │   ├── ImageGenerationService.ts   # 重构 imageGeneration.ts
│   │   ├── VideoGenerationService.ts   # 重构 videoGeneration.ts
│   │   └── TextGenerationService.ts    # 重构 textGeneration.ts
│   ├── execution/
│   │   └── ExecutionService.ts         # 重构 executionEngine.ts
│   └── canvas/
│       ├── FileIngestionService.ts     # fileIngest.ts 迁移
│       └── TaskResumeService.ts        # taskResume.ts 迁移
│
└── usecases/                # 独立用例，被组件直接调用
    ├── generation/
    │   ├── submitImageGeneration.ts
    │   ├── submitVideoGeneration.ts
    │   └── retryGeneration.ts
    ├── canvas/
    │   ├── importCanvas.ts
    │   └── exportCanvas.ts
    └── execution/
        └── runExecution.ts
```

**解耦关键 — 通过依赖注入而非直接 import：**

```typescript
// application/services/generation/ImageGenerationService.ts
export class ImageGenerationService {
  constructor(
    private readonly generationPort: IGenerationService,   // 接口，不是具体实现
    private readonly canvasRepo: ICanvasRepository,        // 接口
    private readonly assetLibrary: IAssetLibraryService,   // 接口
    private readonly queueStore: GenerationQueueStore,
  ) {}

  async runGeneration(placeholderIds: string[], request: GenRequest): Promise<void> {
    // 不再有 useCanvasStore.getState() 直接调用
    const taskId = this.queueStore.enqueue({ ... });
    const outcomes = await Promise.all(
      placeholderIds.map(id => this.runOneSlot(id, request))
    );
    this.queueStore.completeTask(taskId, /* status */);
  }

  private async runOneSlot(id: string, request: GenRequest): Promise<void> {
    const result = await this.generationPort.generateImage(request);
    if (result.ok === true) {
      // 通过接口操作 canvas，不直接 import store
      this.canvasRepo.replaceElement(id, this.buildImageElement(result));
    }
  }
}

// 工厂函数，在 app 启动时组装依赖
export function createImageGenerationService(): ImageGenerationService {
  return new ImageGenerationService(
    new GatewayGenerationService(),
    new CanvasStoreRepository(useCanvasStore),  // 适配器
    new AssetLibraryService(useAssetLibraryStore),
    useGenerationQueueStore.getState(),
  );
}
```

---

### 4. Presentation 层 — 纯展示

组件只做三件事：**渲染、用户交互、调用用例（usecase）**

```
presentation/
├── canvas/
│   ├── InfiniteCanvas.tsx        # 现有，职责不变
│   ├── nodes/                    # 现有 nodes/ 迁移
│   ├── overlays/                 # 现有 overlays/ 迁移
│   └── hooks/                    # canvas 专用 hooks
│       ├── useCanvasPanZoom.ts
│       ├── useCanvasSelection.ts
│       ├── useCanvasConnections.ts
│       ├── useSnapCallbacks.ts
│       └── useCanvasDrop.ts
│
├── panels/
│   ├── PropertiesPanel.tsx
│   ├── HistoryPanel.tsx
│   ├── GenerationQueuePanel.tsx
│   ├── GenerationHistoryPanel.tsx
│   ├── AssetLibraryPanel.tsx
│   └── RunPanel.tsx
│
├── input/                        # NodeInputBar 拆分
│   ├── NodeInputBar.tsx          # 纯 UI 外壳（< 200 行）
│   ├── NodeInputToolbar.tsx      # 工具栏（模型/尺寸选择）
│   ├── PromptTextarea.tsx        # 提示词输入框
│   ├── ReferenceImageStrip.tsx   # 参考图栏
│   └── hooks/
│       ├── useNodeInputState.ts  # 本地 UI 状态
│       └── useGenerationSubmit.ts # 提交逻辑（调用 usecase）
│
├── chrome/
│   ├── TopBar.tsx
│   ├── ToolDock.tsx
│   └── StatusBar.tsx
│
└── ui/                           # 原子组件（现有 components/ui/）
    ├── Dropdown.tsx
    ├── QuickChip.tsx
    ├── ThumbChip.tsx
    └── ...
```

**NodeInputBar 拆分示意：**

```typescript
// presentation/input/NodeInputBar.tsx — 只做 UI 编排
export function NodeInputBar({ element, x, y, width, scale }: NodeInputBarProps) {
  const state = useNodeInputState(element);        // 本地 UI 状态 hook
  const { submit, isGenerating } = useGenerationSubmit(element); // 提交逻辑

  return (
    <div style={{ left: x, top: y, width }}>
      <PromptTextarea
        value={state.prompt}
        onChange={state.setPrompt}
        placeholder={state.placeholder}
        disabled={isGenerating}
      />
      <ReferenceImageStrip
        references={state.references}
        upstreamImages={state.upstreamImages}
        onRemove={state.removeReference}
      />
      <NodeInputToolbar
        mode={state.mode}
        model={state.model}
        aspect={state.aspect}
        onModelChange={state.setModel}
        onSubmit={submit}
        isGenerating={isGenerating}
      />
    </div>
  );
}

// presentation/input/hooks/useGenerationSubmit.ts — 只调用 usecase
export function useGenerationSubmit(element: CanvasElement) {
  const [isGenerating, setIsGenerating] = useState(false);

  const submit = useCallback(async (config: SubmitConfig) => {
    setIsGenerating(true);
    try {
      // 调用 application/usecases，不直接操作 store 或 service
      await submitImageGeneration({ element, ...config });
    } finally {
      setIsGenerating(false);
    }
  }, [element]);

  return { submit, isGenerating };
}
```

---

## 依赖关系图

```
Presentation  →  Application/Usecases  →  Application/Services
                                        →  Application/Store
                                        ↓
                                     Core/Ports (接口)
                                        ↑
                              Infrastructure (实现接口)
```

**单向依赖，无环，各层只依赖自己或内层的接口。**

---

## 渐进式迁移路线

建议分 4 个阶段，不破坏现有功能：

**Phase 1（1-2 周）— 提取 Core 层**
- 将 `utils/alignment.ts`、`utils/flowResolver.ts`、`utils/gridLayout.ts` 移入 `core/domain/`
- 将所有类型定义统一到 `core/types/`
- 在 `core/ports/` 定义接口（暂时空接口即可）
- 无破坏性变更

**Phase 2（2-3 周）— 拆分 NodeInputBar**
- 按上述方案拆分为 5 个文件
- 提取 `useNodeInputState`、`useGenerationSubmit` hook
- 将 `submitImage.ts`、`submitVideo.ts` 升级为 usecase 函数
- 收益最大，单文件从 1000+ 行降到 200 行以内

**Phase 3（2-3 周）— 解耦 Service 与 Store**
- 为 `useCanvasStore` 创建 `CanvasStoreRepository` 适配器
- `ImageGenerationService` 依赖接口而非直接调用 `useCanvasStore.getState()`
- `ExecutionService` 同理重构
- 完成后 `application/services/` 可独立单测

**Phase 4（1-2 周）— Infrastructure 层整理**
- 将 `gateway/` 移入 `infrastructure/gateway/`
- `fileStorage.ts` 移入 `infrastructure/storage/`
- `imgbb.ts` 移入 `infrastructure/imgHost/`
- 全面可测试，可按 provider 独立替换