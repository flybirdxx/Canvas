# omniScript × Canvas 联动 — 开发计划

> **关联 PRD：** `prd-omniscript-canvas-integration.md`
> **文档版本：** 1.0
> **创建日期：** 2026-05-10

---

## Epic 1: Scene 节点端口化

> **目标：** 将 `SceneElement` 从"纯展示节点"升级为"可执行节点"，赋予端口使其能接入画布管线。

### Story 1.1: Scene 端口模板扩展

**文件：** `src/store/portDefaults.ts`

```typescript
// 修改 scene 的端口模板
scene: {
  inputs: [{ type: 'text', label: 'Prompt' }],
  outputs: [{ type: 'image', label: 'Image' }, { type: 'text', label: 'Text' }],
},
```

**AC：**
- [ ] 已有 scene 节点在 store 加载时通过 migration 补充 ports
- [ ] 新创建的 scene 节点立即带有完整端口

---

### Story 1.2: 类型守卫函数

**文件：** `src/types/canvas.ts`

```typescript
export function isSceneElement(el: CanvasElement): el is SceneElement {
  return el.type === 'scene';
}
export function isScriptElement(el: CanvasElement): el is ScriptElement {
  return el.type === 'script';
}
```

**AC：**
- [ ] `isSceneElement` 正确识别 scene 节点
- [ ] `isScriptElement` 正确识别 script 节点
- [ ] 替代 `el.type === 'scene'` 裸类型判断的使用点（至少 5 处）

---

## Epic 2: Flow Resolver 集成 Scene 语义

> **目标：** 让执行引擎能够从 scene 的 `ScriptLine[]` 自动提取 prompt 内容。

### Story 2.1: scene 作为文字源

**文件：** `src/utils/flowResolver.ts`

修改 `getOutgoingText()` 新增分支：

```typescript
case 'scene':
  return composeScenePrompt(el as SceneElement);
```

**AC：**
- [ ] scene 的 `lines[].content` 被拼接进 upstream contributions
- [ ] 多个 scene 上游时，按画布位置排序（从上到下、从左到右）
- [ ] `composeEffectivePrompt` 正确合并 scene 内容

---

### Story 2.2: scene 作为图像源

**文件：** `src/utils/flowResolver.ts`

修改 `getUpstreamImageContributions()` 新增分支：

```typescript
case 'scene': {
  const scene = src as SceneElement;
  if (!scene.linkedImageId) continue;
  // 查找 linked image 的 URL
}
```

**AC：**
- [ ] 有 `linkedImageId` 的 scene 输出该图片 URL
- [ ] 无 `linkedImageId` 的 scene 不产生图像贡献
- [ ] ImageInputBar 正确显示 scene 贡献的缩略图

---

### Story 2.3: composeScenePrompt 纯函数

**文件：** `src/services/scenePromptComposer.ts`（新增）

```typescript
export function composeScenePrompt(scene: SceneElement): string {
  // 输出格式见 PRD F6
}
```

**AC：**
- [ ] 无 lines 时使用 title
- [ ] dialogue 格式：`角色（情绪）：台词`
- [ ] action 格式：`[动作] 内容`
- [ ] environment 格式：`[环境] 内容`
- [ ] analysisNote 以 `[导演备注]` 追加
- [ ] 导出测试用例覆盖所有分支

---

## Epic 3: 执行引擎集成 Scene

> **目标：** 让 `executeNode` 能正确处理 scene 类型节点，触发生成。

### Story 3.1: scene 执行逻辑

**文件：** `src/services/executionEngine.ts`

修改 `executeNode()` 的节点类型判断：

```typescript
if (el.type === 'scene') {
  // 有 linkedImageId → 执行该 image
  // 无 linkedImageId → 自动创建 image 节点并连线
}
```

**AC：**
- [ ] scene 有 linkedImageId → 直接执行该 image 节点
- [ ] scene 无 linkedImageId → 在右侧 60px 处创建 image 节点
- [ ] 创建时：自动连线（scene output → image input）
- [ ] 创建后：立即 `updateElement(scene.id, { linkedImageId: newImage.id })`
- [ ] 创建后：立即 `executeNode(newImage.id, ...)`

---

### Story 3.2: scene 作为非生成型节点（次级路径）

**文件：** `src/services/executionEngine.ts`

将 scene 从"跳过"逻辑中移除，同时保持其不直接生成内容。

**AC：**
- [ ] scene 不会触发自身的 AI 生成（通过 linkedImage 间接执行）
- [ ] 无 linkedImageId 的 scene 触发自动创建流程（Story 3.1）
- [ ] 执行日志正确显示 scene 节点的处理路径

---

## Epic 4: 生成结果自动回填

> **目标：** AI 图片生成成功后，自动将结果与对应的 scene 关联。

### Story 4.1: image 生成成功后关联 scene

**文件：** `src/services/imageGeneration.ts`

修改 `replacePlaceholderWithImage()` 末尾新增：

```typescript
// 自动查找 linkedImageId === placeholderId 的 scene
// 查找 scene → image 的连线，更新 scene.linkedImageId
```

**AC：**
- [ ] 直接引用（linkedImageId === image.id）→ 更新 scene.linkedImageId
- [ ] 连线引用（scene.output → image.input）→ 更新 scene.linkedImageId
- [ ] 生成成功 → Storyboard 视图该 scene 缩略图刷新
- [ ] 幂等：已有 linkedImageId 的 scene 不重复更新

---

### Story 4.2: 独立 image 生成后自动关联（无连线）

**文件：** `src/services/imageGeneration.ts`

当用户直接执行一个 image 节点（而非通过 scene），且画布上存在可关联的 scene 时，提供自动关联提示。

**AC：**
- [ ] image 有 `inputs` 从某个 scene 连来 → 自动更新该 scene 的 linkedImageId
- [ ] 无连线但画布上有 scene → 不自动关联（避免误关联）

---

## Epic 5: 分镜执行模式

> **目标：** 在 Storyboard 视图中提供一键批量执行入口。

### Story 5.1: StoryboardExecuteBar 组件

**文件：** `src/components/StoryboardExecuteBar.tsx`（新增）

```typescript
// 顶部工具栏组件
- "生成全部" 按钮（primary）
- "生成选中" 按钮（secondary，disabled 当无选中）
- 进度显示：已完成/总场次
```

**AC：**
- [ ] 工具栏固定在 StoryboardView 顶部
- [ ] "生成全部" 按钮始终可用（>0 scenes）
- [ ] "生成选中" 按钮在有选中时可用
- [ ] 进度显示实时更新（0/N → 1/N → ... → N/N）

---

### Story 5.2: Storyboard 场景多选

**文件：** `src/components/StoryboardView.tsx`

扩展选中逻辑：

```typescript
// Ctrl+点击：切换选中
// Shift+点击：范围选择
// 无修饰键：单选
```

**AC：**
- [ ] Ctrl+点击添加/移除选中
- [ ] Shift+点击选中两个点击位置之间的所有 scene
- [ ] 已选中状态下无修饰键点击只选中当前项
- [ ] 多选时 SceneDetailOverlay 保持单 scene 打开

---

### Story 5.3: 批量执行引擎集成

**文件：** `src/hooks/canvas/useSceneExecution.ts`（新增）

```typescript
export function useSceneExecution() {
  // handleExecuteAll(sceneIds): 按 sceneNum 顺序串行执行
  // handleExecuteSelected(): 执行 selectedIds 中的 scenes
  // 状态：executing | idle，progress: { done, total }
}
```

**AC：**
- [ ] 执行完成后自动切换 `setViewMode('canvas')`
- [ ] 执行过程中可取消（cancelExecution）
- [ ] 任意一场失败 → 继续执行剩余场次 → 最后统一提示失败数
- [ ] 取消后 → 保留已成功的结果，清除失败的 placeholder

---

## Epic 6: 剧本节点执行（可选）

> **目标：** 将 ScriptElement 本身变成可执行节点，点击后执行其所有子 scene。

### Story 6.1: Script 执行逻辑

**文件：** `src/services/executionEngine.ts`

```typescript
if (el.type === 'script') {
  // 收集所有 scriptId === el.id 的 scene
  // 按 sceneNum 排序后串行执行
}
```

**AC：**
- [ ] script 节点在执行面板显示所有子 scene 的执行状态
- [ ] 无子 scene 的 script → 标记 success，跳过
- [ ] 子 scene 执行失败 → script 仍标记完成（子级状态各异）

---

## 依赖关系图

```
Story 1.1 ──┐
             ├──► Epic 1 完成
Story 1.2 ──┘

Story 2.3 先于 2.1/2.2 开发（composeScenePrompt 被 2.1 引用）

Story 2.1 ──┐
Story 2.2 ──┼──► Epic 2 完成 ──► Story 3.1 依赖
             │
Story 3.1 ──┴──► Epic 3 完成 ──► Story 4.1 依赖

Story 5.1 ──┐
Story 5.2 ──┼──► Epic 5 完成
Story 5.3 ──┘

Epic 3 ──────────────────────────► Epic 4（并行可开发）
Epic 5 依赖 Epic 3+4
Epic 6 依赖 Epic 3
```

---

## 开发顺序建议

| 阶段 | Epic | Stories | 预计工时 |
|------|------|---------|----------|
| **Phase 0** | Epic 1 | 1.1, 1.2 | 2h |
| **Phase 1** | Epic 2 | 2.3 (先), 2.1, 2.2 | 3h |
| **Phase 2** | Epic 3 | 3.1, 3.2 | 2h |
| **Phase 3** | Epic 4 | 4.1, 4.2 | 1.5h |
| **Phase 4** | Epic 5 | 5.1, 5.2, 5.3 | 4h |
| **Phase 5** | Epic 6 | 6.1 | 1.5h |
| **总计** | | | **14h** |

---

## 测试策略

| Story | 测试场景 |
|-------|----------|
| 2.3 | `composeScenePrompt` 单元测试：lines 各种组合、空白场景 |
| 2.1 | flowResolver：scene 上游 → 收集台词 → 合并 prompt |
| 2.2 | flowResolver：scene linkedImageId → 输出图片 URL |
| 3.1 | 执行 scene → 自动创建 image → 连线 → 执行 |
| 4.1 | image 生成成功 → linkedImageId 更新 → Storyboard 缩略图 |
| 5.3 | 批量执行：100 个 scene，中途取消，验证无孤儿节点 |
