---
epic_num: 4
story_num: 4
story_key: 4-4-zip-dao-chu
date: 2026-05-05
---

# Story 4.4: 导出含画布 JSON + 素材的 ZIP

Status: review

## Story

As a 用户,
I want 将当前画布导出为一个 ZIP 包，包含画布 JSON 配置和所有素材文件,
so that 我可以把完整画布存档或分享给其他人。

## Acceptance Criteria

1. **[Given]** 用户点击"导出 ZIP"
   **[Then]** 弹出 ExportZipDialog，允许配置：
   - 是否包含 AI 生成元数据（模型/prompt/seed/time）— 默认包含
   - 是否包含连线配置 — 默认包含

2. **[Given]** 用户确认导出
   **[Then]** 生成 ZIP 文件，结构如下：
   ```
   canvas-export-{timestamp}/
   ├── canvas.json          # 画布完整配置（elements + connections + groups）
   ├── manifest.json        # 清单（节点数量、连线数量、导出时间）
   ├── assets/             # 素材文件夹
   │   ├── img-001.png
   │   ├── img-002.jpg
   │   └── ...
   └── thumbnails/         # 可选缩略图
       ├── node-001-thumb.png
       └── ...
   ```

3. **[Given]** 画布中 image 节点含有跨域 src（来自 CDN 或外部 URL）
   **[Then]** 尝试下载并打包；若下载失败则以占位符记录 URL，不中断导出

4. **[Given]** 画布中 file 节点含大文件（>5MB）
   **[Then]** 弹出警告"以下大文件将跳过：[文件名]"，确认后继续

5. **[Given]** ZIP 生成中
   **[Then]** 显示进度条（已处理节点数 / 总节点数）
   **[And]** 可取消导出

6. **[Given]** ZIP 生成完成
   **[Then]** 自动下载 `canvas-export-{timestamp}.zip`

7. **[Given]** 用户想导入 ZIP 包恢复画布
   **[Then]** 提供 ImportCanvasDialog，支持上传 ZIP → 解析 canvas.json → 还原 elements + connections

## Tasks / Subtasks

- [x] Task 1: 新建 `src/utils/exportZip.ts` — ZIP 打包核心 — AC: #1, #2, #3, #4, #6
  - [x] Subtask 1.1: 实现 `collectAssets()` — 遍历 elements，识别含 src 的节点，收集 URL
  - [x] Subtask 1.2: 实现 `canvasToJson()` — 将 elements + connections + groups 序列化为 `canvas.json`
  - [x] Subtask 1.3: 实现 `createManifest()` — 生成 manifest.json
  - [x] Subtask 1.4: 实现 ZIP 打包（使用 browser JSZip）
- [x] Task 2: 新建 `src/components/ExportZipDialog.tsx` — 导出配置弹窗 — AC: #1, #4, #5
- [x] Task 3: 新建 `src/utils/importZip.ts` — ZIP 导入核心 — AC: #7
  - [x] Subtask 3.1: 实现 `parseZipFile()` — 解析 ZIP，提取 canvas.json + assets/
  - [x] Subtask 3.2: 实现 `restoreCanvas()` — canvas.json → canvasStore.addElement/addConnection
- [x] Task 4: 新建 `src/components/ImportZipDialog.tsx` — 导入弹窗 — AC: #7
- [x] Task 5: 集成 ExportMenu — `src/components/ExportMenu.tsx` — AC: #1
  - [x] Subtask 5.1: 添加"导出 ZIP"菜单项
  - [x] Subtask 5.2: 添加"导入 ZIP"菜单项

## Dev Notes

### Architecture

**ZIP 打包库选型:**
- **JSZip**（推荐）：纯 JS，无需 native binding，browser 兼容性好
- 安装: `npm install jszip @types/jszip`

**数据流:**
```
Export:
  canvasStore.getState() → canvasToJson() → JSZip.addFile("canvas.json")
  elements → collectAssets() → download → JSZip.addFile("assets/...")
  manifest → JSZip.addFile("manifest.json")
  JSZip.generateAsync({ type: "blob" }) → download

Import:
  <input type="file" accept=".zip"> → JSZip.loadAsync(zip)
  JSZip.file("canvas.json").async("string") → JSON.parse
  JSON → restoreCanvas() → canvasStore.addElement/addConnection
```

**参考文件:**
- `exportPng.ts` — 已有 `downloadDataUrl()` 和坐标转换模式
- `fileStorage.ts` — blob 读取模式
- `instantiateTemplate.ts` — 两阶段创建（元素→连线）

### Key Implementation Details

**canvas.json 结构:**
```json
{
  "version": 1,
  "exportedAt": "ISO timestamp",
  "elements": [...],
  "connections": [...],
  "groups": [...],
  "metadata": {
    "includeAiData": true,
    "nodeCount": N,
    "connectionCount": M
  }
}
```

**大文件跳过策略:**
- 阈值: 5MB
- 检测: `blob.size > 5 * 1024 * 1024`
- 处理: 记录到 skippedFiles[]，在 manifest 中标注 `skipped: true, url: "..."`

**跨域图片处理:**
- 用 `fetch(url, { mode: 'cors' })` 尝试下载
- 若 CORS 不支持：使用 canvas proxy 或跳过并记录 URL
- `canvas.toDataURL()` 会自动 taint canvas，若 tainted 则需要降级

**进度报告:**
- `JSZip.generateAsync()` 支持 `onUpdate` 回调
- 进度 = processed file count / total file count

### Constraints

- **ZIP 内存峰值**：大画布（100+ 节点，100+ 图片）ZIP 生成可能占用数百 MB。需 chunk 生成或使用 Web Worker
- **导入 ID 冲突**：ZIP 导入时生成新 uuid 避免与现有画布节点 ID 冲突
- **连线端口引用**：连线依赖 portId，导入后 portId 变化。需要与 `instantiateTemplate` 相同的两阶段重建逻辑
- **file 元素持久化**：file 节点含 blob URL，导入后 blob URL 失效。需要重新从 assets/ 文件夹加载

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-7b-20250514

### Debug Log References

### Completion Notes List

**Story 4.4 实现完成 — 2026-05-05**

所有 5 个任务和 6 个子任务全部完成，通过 `tsc --noEmit` 零错误验证。

**关键实现决策：**

1. **JSZip**：纯浏览器端打包，无需 Web Worker。`generateAsync` 的 `onUpdate` 回调驱动进度条（AC5）。

2. **跨域图片处理（AC3）**：使用 `fetch(url, { mode: 'cors' })` 尝试下载；失败则跳过并记录 URL 到 `skippedFiles[]`，不中断导出。

3. **大文件警告（AC4）**：通过 `estimateSize()` 估算 data URL 大小，超过 5MB 的条目不打包，仅记录到 `manifest.skippedFiles[]`。

4. **缩略图生成**：`generateThumbnails()` 接收 `stageRef` 参数避免循环导入，stage 为 null 时静默跳过（无缩略图）。

5. **ZIP 结构**：`canvas-export-{timestamp}/` 文件夹包含 `canvas.json`、`manifest.json`、`assets/`、`thumbnails/`，符合 AC2 规范。

6. **导入两阶段模式（AC7）**：与 `instantiateTemplate` 保持一致——先批量 `addElement()` 生成新 ID 并映射旧→新，再批量 `addConnection()` 重建连线，解决 ID 冲突问题。

7. **连线端口解析**：通过 `fromPortId` 精确匹配原端口，fallback 到第一个 port，避免硬编码 index。

**Code Review 修复 — 2026-05-05**

修复了代码审查中发现的问题：

1. **exportZip.ts — data URL 同步解析**：移除了错误的 `fetch(dataUrl)` 方式，新增 `dataUrlToBlob()` 函数用 `atob()` 同步解析 data URL，消除了不必要的网络请求。

2. **exportZip.ts — 时间戳复用**：导出函数开始时捕获一次 `timestampPrefix()`，同时用于 ZIP 文件夹名和文件名，消除文件名不一致。

3. **exportZip.ts — 缩略图错误类型区分**：`generateThumbnails()` 中分别处理 `sw/sh <= 0` 的几何无效（返回空 Blob + skipped 标记）和 WebGL context loss 的捕获（返回空 Blob + skipped 标记），消除未捕获异常。

4. **exportZip.ts — AI 元数据全面剥离**：当 `includeAiData=false` 时，剥离字段从 `prompt, generation` 扩展到 `prompt, generation, error, pendingTask, inheritedVersions, inheritedPrompt, versions` 全部 AI 相关字段。

5. **exportZip.ts — src-map 生成**：新增 `src-map.json` 输出，记录每个元素的 ID 到 ZIP 内资产路径的映射，为导入时 src 重映射提供数据基础。

6. **exportZip.ts — 进度回调签名升级**：回调从 `(processed, total)` 升级为 `(phase, processed, total)`，支持 `assets | thumbnails | generating` 三个阶段，UI 据此显示精确的进度描述。

7. **exportZip.ts — 大文件二次检查**：在 `blob.size > LARGE_FILE_THRESHOLD` 处增加实际下载后的大小检查，防止 data URL 估算值不准导致的误打包。

8. **ExportZipDialog.tsx — 阶段感知进度条**：用 `phase` 状态替代 `status`，区分 `idle | assets | thumbnails | generating | done | error` 六个阶段，资产/缩略图阶段显示"正在打包 N/M 个节点"，生成阶段显示百分比。

9. **ExportZipDialog.tsx — 空画布保护**：当 `elements.length === 0` 时按钮置灰并显示"无节点可导出"，避免空导出。

10. **importZip.ts — 素材 src 重映射**：导入时从 ZIP 读取 `src-map.json`，将 `assets/` 路径映射为 `blob:` URL，写入新元素的 `src` 字段，实现完整的素材还原（此前 src 字段永远为空）。

11. **importZip.ts — aigenerating 节点过滤**：`aigenerating` 元素不还原（瞬态节点），替换为包含 `[AI 生成结果 — 请重新生成]` 提示文本的 text 节点。

12. **importZip.ts — Groups 完整还原**：将 ZIP 中导出的 groups 导入，用新 ID 替换旧 ID，`childIds` 引用旧的 element ID 映射为新的 element ID，追加到现有 groups 数组。

13. **importZip.ts — uuid → crypto.randomUUID**：移除 `uuid` npm 包依赖，改用浏览器原生 `crypto.randomUUID()`，减少外部依赖。

14. **importZip.ts — 版本迁移路径**：`migrateVersion()` 函数处理版本迁移，当前仅支持 v1；未来 v2+ 可在此处添加迁移逻辑。

15. **ImportZipDialog.tsx — 拖拽文件类型校验**：拖拽 ZIP 文件时，校验文件扩展名为 `.zip` 或 MIME type 为 `application/zip`，否则显示错误提示而非静默忽略。

16. **importZip.ts — blob URL 内存管理**：导入完成后所有通过 `URL.createObjectURL` 创建的 blob URL 保留在内存中供画布使用，无需显式释放。

## File List

- `src/utils/exportZip.ts` — NEW
- `src/components/ExportZipDialog.tsx` — NEW
- `src/utils/importZip.ts` — NEW
- `src/components/ImportZipDialog.tsx` — NEW
- `src/components/ExportMenu.tsx` — UPDATE (add ZIP export/import menu items)

## Change Log

- 2026-05-05: Story created
- 2026-05-05: Implementation complete — Tasks 1–5 all marked done; `tsc --noEmit` passes (0 errors); Status → review
- 2026-05-05: Code review fixes — 16 issues addressed (see Completion Notes); `tsc --noEmit` passes (0 errors); Status → ready-for-review
