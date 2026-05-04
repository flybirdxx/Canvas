# 产品需求文档 — 下一阶段功能规划

## 路线图总览

```
Phase 2 (近期 1-3 月)   — 补齐已知限制 + 质量提升
Phase 3 (中期 3-6 月)   — 新能力扩展 + 协作
Phase 4 (远期 6-12 月)  — 生态与分发
```

---

## Phase 2 — 补齐与打磨

### 2.1 大文件存储升级

**现状问题**：FileElement 的 data URL 以 base64 存在 localStorage，单文件可达数 MB。大量大文件会撑爆 localStorage quota (5-10MB)，且每次 persist 序列化都阻塞主线程。

**方案**：
- 引入 IndexedDB 作为大对象存储后端
- >1MB 的文件自动写入 IndexedDB，localStorage 仅存 `{ persistence: 'blob', blobKey: string }`
- <1MB 的小文件保持现有 `persistence: 'data'` 路径（简单、够用）
- UI 降级：blob 模式的节点在跨域/清理后丢失 → 显示"附件已丢失，点此重传"占位卡

**影响范围**：
- `FileElement.persistence` 类型扩展
- `useCanvasStore.persist.storage` 改为 IndexedDB adapter（保留 localStorage 作为小对象通道）
- `CanvasElements` 新增 "broken attachment" 状态渲染

### 2.2 更多 AI Provider 接入

| Provider | 能力 | 接入优先级 | 原因 |
|----------|------|------------|------|
| OpenAI (DALL·E 3) | image | 高 | 用户基数大，API 成熟 |
| Stability AI (SD3) | image + img2img | 高 | img2img + inpainting 原生支持 |
| Midjourney (非官方) | image | 中 | 社区需求高，但无公开 API |
| Luma Dream Machine | video | 中 | 视频生成质量领先 |
| Runway Gen-3 | video | 中 | 视频+img2vid 强 |
| Google Imagen | image | 低 | Gemini 生态整合 |
| Kling | video | 低 | 中文用户群体 |

每个新 Provider 预计工作量：~200 行 Provider 实现 + SettingsModal 配置卡片 + 模型描述符注册。

### 2.3 生成体验优化

**生成历史面板**：
- 跨节点的全局"所有生成记录"时间线视图
- 每条记录：缩略图 + prompt + 模型 + 时间
- 点击可将历史生成结果置入画布

**批量生成**：
- 多选 image/video 节点 → 右上角"批量生成"按钮
- 共享参数（模型/分辨率）或不共享（各节点保留自己的配置）
- 队列化执行，避免同时轰炸 API

**费用预估**：
- 生成按钮旁展示预估费用（单价 × 张数 × 并发）
- 每日/每月费用统计（SettingsModal 内）

### 2.4 导出增强

- **SVG 导出**：将 Konva Stage 序列化为 SVG（受限于 Konva 能力，复杂节点降级为图片）
- **PDF 导出**：多页 PDF（每页一个"画布视区"），使用 jsPDF
- **导出为网页**：生成独立 HTML 文件，内嵌所有 data URL + 只读画布查看器
- **导出保留层级**：节点 z-order / 锁定状态 / 注释随导出元数据保存

---

## Phase 3 — 能力扩展

### 3.1 工作流自动化

**触发节点**：
- Webhook 触发：外部系统 POST → 触发指定节点的生成
- 定时触发：cron 表达式 → 定时自动生成（如每日日报封面图）
- 文件监听：监听本地文件夹 → 新文件自动创建 file 节点

**条件分支**：
- 基于节点元数据路由："图片尺寸 > 2K → 走高端模型，否则走低价模型"
- 可视化路由编辑器（节点 + 连线 + 条件标签）

**DAG 执行**：
- 批量生成支持依赖关系：B 节点依赖 A 节点生成结果
- 并行执行无依赖的节点，串行执行有依赖的节点

### 3.2 文本生成集成

**新增 LLM Text 节点**：
- 接入 Claude / Gemini API — 生成/改写/翻译提示词
- 场景：用户输入"一只猫" → LLM 扩展为"一只橘猫坐在窗台上，午后阳光透过百叶窗洒下条纹光影，35mm 胶片质感" → 连到 image 节点自动生图
- 支持 system prompt 自定义（和 SettingsModal 中的 API Key 打通）

### 3.3 节点类型扩展

| 新类型 | 渲染方式 | 典型场景 |
|--------|----------|----------|
| `table` | Markdown 表格渲染 | 结构化数据展示、A/B 比较 |
| `code` | 语法高亮代码块 | 技术文档片段 |
| `embed` | iframe 嵌入 | YouTube / Figma / Notion 嵌入预览 |
| `group` | 虚线边界框 | 逻辑分组（不影响连线/生成） |

### 3.4 实时协作

**技术选型**：Yjs (CRDT) + y-websocket

**一期范围**：
- 画布节点同步：elements CRDT → Y.Map 映射
- 光标/选区广播：每个用户的光标位置和色块
- 连线同步
- 权限：编辑/只读/评论三种角色

**不在一期**：
- 操作历史合并（多用户 undo 语义复杂）
- AI 生成同步（仅触发者看到生成过程，结果自动同步）

---

## Phase 4 — 生态与分发

### 4.1 插件系统

- **Provider 热加载**：第三方开发者可发布 npm 包作为 Provider 插件，无需 fork 主项目
- **自定义节点类型 SDK**：定义节点渲染组件 + 端口规则 + 属性面板
- **社区市场**：内置插件浏览器，一键安装

### 4.2 内容分发

- **一键发布**：导出 + 发布到 Notion / WordPress / 小红书
- **作品集导出**：生成独立页面，带生成参数水印（模型/prompt/时间）
- **REST API**：外部系统通过 API 触发画布生成 → 返回结果 URL

### 4.3 桌面端

- **Electron 打包**（已有 `cursor/electron-packaging` 分支探索）：
  - 独立窗口，不受浏览器标签页限制
  - 本地文件系统直读：拖入大文件无需上传，直接读本地路径
  - 系统托盘 + 通知
- **离线生成**：
  - 集成 WebGPU 本地推理（ONNX Runtime Web / Transformers.js）
  - 适用于敏感数据不离本地的场景
