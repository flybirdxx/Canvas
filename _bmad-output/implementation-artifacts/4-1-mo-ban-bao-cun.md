---
epic_num: 4
story_num: 1
story_key: 4-1-mo-ban-bao-cun
date: 2026-05-05
---

# Story 4.1: 画布布局保存为自定义模板

Status: review

## Story

As a 用户,
I want 将当前画布布局保存为自定义模板,
so that 我可以快速复用常用布局，下次直接一键调出。

## Acceptance Criteria

1. **[Given]** 用户当前画布上有若干节点和连线
   **[When]** 点击"模板"按钮打开模板面板
   **[Then]** 面板显示"保存当前画布"选项

2. **[Given]** 用户点击"保存当前画布"
   **[Then]** 弹出 SaveTemplateModal，要求输入模板名称（默认值：当前日期时间）
   **[And]** 可选择分类（下拉：短视频 / 小红书 / 故事分镜 / 角色设定）
   **[And]** 可填写描述（可选）

3. **[Given]** 用户填写名称并确认保存
   **[Then]** 系统将当前 canvasStore 序列化为 CanvasTemplate 结构
   **[And]** 节点 x/y/width/height/type/type-specific payload 均被保存
   **[And]** 连线（fromLocalId/toLocalId/portIndex）被保存
   **[And]** 模板持久化到 localStorage（不丢）
   **[And]** 保存成功后，模板面板中立即出现该模板

4. **[Given]** 用户打开模板面板
   **[Then]** 内置模板和用户自定义模板同时展示
   **[And]** 自定义模板显示"删除"按钮（内置模板不显示）

5. **[Given]** 用户点击自定义模板的"删除"按钮
   **[Then]** 弹出确认提示
   **[And]** 确认后模板从 localStorage 中移除，立即从面板消失

6. **[Given]** 用户点击某个模板的"使用"按钮
   **[Then]** `instantiateTemplate()` 被调用，节点被渲染到画布视口中心
   **[And]** 连线被重建
   **[And]** 新创建的节点被自动选中

## Tasks / Subtasks

- [x] Task 1: 扩展 `src/data/templates.ts` — 添加 `useUserTemplatesStore` (Zustand, persist, version bump) — AC: #3, #4, #5
  - [x] Subtask 1.1: 定义 UserTemplateStore 接口和方法（`saveTemplate`, `deleteTemplate`, `listTemplates`）
  - [x] Subtask 1.2: 迁移：现有 persist version 从 v7 递增到 v8，添加 userTemplates 到迁移函数
- [x] Task 2: 新建 `src/components/SaveTemplateModal.tsx` — 模板保存弹窗 — AC: #2, #3
  - [x] Subtask 2.1: 实现 UI：名称输入 + 分类下拉 + 描述 + 确认/取消按钮
  - [x] Subtask 2.2: 实现保存逻辑：调用 `canvasToTemplate()` 将当前 canvasStore 转为 CanvasTemplate
- [x] Task 3: 实现 `canvasToTemplate()` 序列化函数 — AC: #3
  - [x] Subtask 3.1: 遍历 elements，转换为 TemplateElement[]（x→offsetX, y→offsetY）
  - [x] Subtask 3.2: 遍历 connections，转换为 TemplateConnection[]（解析 port id → index）
- [x] Task 4: 集成到模板面板 — 在 TemplatesModal 中添加"保存当前画布"按钮 — AC: #1, #2
- [x] Task 5: 删除功能 — 在模板卡片上添加删除按钮并实现 — AC: #5

## Dev Notes

### Architecture

**模板数据流:**
- `canvasStore.elements` → `canvasToTemplate()` → `CanvasTemplate` → `useUserTemplatesStore.saveTemplate()`
- `useUserTemplatesStore.listTemplates()` → `TemplatesModal` cards
- `instantiateTemplate()`（已有）→ `canvasStore.addElement()`

**现有文件参考:**
- `src/data/templates.ts` — `CanvasTemplate`, `TemplateElement`, `TemplateConnection`, `BUILTIN_TEMPLATES` 已定义
- `src/utils/instantiateTemplate.ts` — 已有 `instantiateTemplate()` 实现，熟悉其 `idMap` + 两阶段创建模式

### Key Implementation Details

**序列化（`canvasToTemplate`）:**
- 用 `uuidv4()` 为模板生成 `id`
- `elements[i].x` → `offsetX`，`elements[i].y` → `offsetY`（相对视口中心）
- `connections` 中 `fromId/toId` 必须映射为 `localId`（因为模板内节点 id 与画布节点不同）
- 端口引用通过 `outputs.findIndex(p => p.id === conn.fromPortId)` 转为 index

**store:**
- 新建 `src/store/useUserTemplatesStore.ts`，persist key 为 `'ai-canvas-user-templates'`
- 初始 version: 0（全新 store）
- 状态: `{ templates: CanvasTemplate[] }`

**UI 约定:**
- Modal 使用现有的 `window.dispatchEvent(new CustomEvent('open-save-template'))` 模式
- Modal 组件: `SaveTemplateModal.tsx`，用 DOM `<dialog>` 或与现有 Modal 组件共用样式

### Constraints

- **jsPDF 无中文**：模板名称/描述保存为 JSON 时不受限，但若未来需要导出含中文的 PDF 模板卡片则需嵌入 TTF
- **Html 节点**：序列化时需要包含 `(el as any).text` / `(el as any).markdown` 等 DOM 节点内容
- **文件元素**：`file` 类型节点可能含 blob URL — 模板中应存空值或 base64（受大小限制）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-7b-20250514

### Debug Log References

### Completion Notes List

## File List

- `src/store/useUserTemplatesStore.ts` — NEW
- `src/components/SaveTemplateModal.tsx` — NEW
- `src/utils/canvasToTemplate.ts` — NEW
- `src/components/TemplatesModal.tsx` — UPDATE (add save button, user template listing, delete button)

## Change Log

- 2026-05-05: Story created — Epic 4 首发故事
- 2026-05-05: Implementation complete — All 5 tasks done, type-check passes
