# 产品需求文档 — 已实现功能回溯

## 产品概述

**产品名**：AI 画布 Pro · Warm Paper Studio

**一句话描述**：在无限画布上放置文本/图片/视频/音频节点，通过连线定义数据流向，接入多 AI Provider 完成图像和视频生成。所有操作可回溯、可版本管理。

**目标用户**：AI 创意工作者——设计师、视频创作者、概念艺术家、AI 提示词工程师。

**项目状态**：MVP 已交付，以下功能全部实现。

---

## 功能清单

### 1. 节点系统（7 种节点类型）

每种节点都是画布上的独立实体，支持拖拽定位、8 点缩放、旋转、锁定、注释(note)。

| 节点类型 | UI 表现 | 输入端口 | 输出端口 | 典型用途 |
|----------|---------|----------|----------|----------|
| `text` | 富文本渲染框 | — | text ×1 | 写提示词，输出连到 image/video/audio 节点 |
| `image` | 图片渲染（支持版本历史） | text(prompt) ×1, image(ref) ×1 | image ×1 | AI 生图、静态图片展示、局部重绘 |
| `video` | 视频第一帧+播放浮层 | image ×1 | video ×1 | AI 生视频、视频播放、版本历史 |
| `audio` | 波形图+播放浮层 | text(prompt) ×1 | audio ×1 | AI 语音生成、音频播放 |
| `sticky` | 便签卡片（鹅黄色背景） | any ×1 | any ×1 | 自由备注、数据中转 |
| `rectangle` | 圆角矩形 | any ×1 | any ×1 | 视觉分隔、形状占位 |
| `file` | 按 MIME 智能预览 | — | image ×1（仅 image/*） | 文件附件、图片来源（img2img） |

**通用节点属性**：
- 位置 (x, y)、尺寸 (w, h)、旋转角 (rotation)
- 锁定 (isLocked)：禁止拖拽/缩放
- 注释 (note)：自由文本，显示为节点右上角钉子图标

**生成节点专属属性**（image / video / aigenerating）：
- prompt：生成提示词
- generation：模型/宽高比/分辨率/质量/张数/参考图配置
- versions：历史版本数组（每次生成追加）
- activeVersionIndex：当前查看的版本

### 2. 连线工作流

```
[Text Node] --text--> [Image Node] --image--> [Video Node]
                           ↑
                    [File Node(image)]  (img2img 参考图)
```

**核心规则**：
- 类型匹配：同类型端口直连，`any` 端口兼容所有类型
- 贝塞尔曲线渲染：双层笔触（底层半透明宽线 + 上层细线）模拟墨迹
- 环检测：DFS 遍历，检测到有向环则拒绝创建连线
- 端口吸附：鼠标靠近端口 20px 内自动吸附

**上游内容收集**（flowResolver）：
- 触发时机：AI 生成前
- 逻辑：从目标节点的 prompt 输入端口出发，沿连线向上 DFS 递归收集 text 节点的内容
- 结果：所有上游文本拼入 prompt，参考图注入 `referenceImages`

### 3. AI 生成管线

#### 已接入 Provider

| Provider | 类型 | 模型数 | 生成模式 | 定价 |
|----------|------|--------|----------|------|
| T8Star | image | 3 | 同步 | 一口价 |
| RunningHub | image | 3 | 异步 | 质量×分辨率矩阵 |

#### 生成流程

1. 选中 image/video 节点 → NodeInputBar 填写 prompt + 选模型
2. 调参数：宽高比 / 分辨率(1K/2K/4K) / 质量(low/medium/high) / 张数
3. 点击生成 → 节点替换为 AIGeneratingElement（加载动画）
4. 等待结果：
   - 成功 → 自动替换为 image/video 节点，显示结果
   - 异步提交 (RunningHub) → 显示等待中，周期性轮询
   - 失败 → 显示错误面板 + 重试按钮

#### 图生图 (Image-to-Image)

- 将 image 节点的 image 输出连到另一个 image 节点的 image(ref) 输入
- 生成时自动将上游图片作为 `referenceImages` 发给 API

#### 局部重绘 (Inpaint)

- 选中图片节点 → 工具栏开启局部重绘模式
- 在图片上拖拽框选矩形 → 生成 PNG 蒙版
- 蒙版透明区域 = "请 AI 重绘这里"，不透明区域 = "保持原样"
- 蒙版随请求发给支持 inpainting 的 Provider

#### 生成队列

- GenerationQueuePanel 统一展示当前进行中的生成任务
- 支持并发：多个节点同时触发生成，各自独立生命周期

#### 跨会话恢复

- 刷新/关闭浏览器时，未完成的异步任务状态持久化在 placeholder 上
- 重新打开 → `taskResume` 扫描所有 pending 任务 → 调用 `pollImageTask` 继续轮询
- 成功/失败后自动替换/标记

### 4. 节点版本历史

- 每次生成成功后追加一个新 `NodeVersion { id, src, prompt, createdAt }`
- `src` 始终等于 `versions[activeVersionIndex].src`
- 版本 >= 2 时，节点上方出现 `NodeVersionSwitcher`（缩略图条）
- 点击切换即时更新 `src`，不修改 `versions` 数组（只读切换）
- 所有版本随 localStorage 持久化

### 5. 画布交互

| 交互 | 操作方式 |
|------|----------|
| 平移 | 鼠标中键拖拽 / 空格+左键拖拽 / 手形工具(h) |
| 缩放 | 滚轮（0.1x ~ 5x），以指针为中心缩放 |
| 框选 | 选择工具(v) → 在空白区域拖拽 → AABB 碰撞检测 |
| 多选 | Shift+点击 / 框选 |
| 节点拖拽 | 选择工具 → 直接拖动 |
| 节点缩放/旋转 | 选中后 Transformer 锚点操作 |
| 对齐 | 多选后 AlignmentToolbar：左/中/右/上/中/下对齐 + 水平/垂直均匀分布 |
| 右键菜单 | 双击画布空白 → Quick Add 菜单（文本/图片/视频/音频/上传） |
| 快捷键 | 完整键盘映射（见 App.tsx 键盘处理） |

**点格背景**：`backgroundSize` 随 `stageConfig.scale` 同步缩放，视觉上锚定纸面而非视口。

### 6. 快捷键

| 键 | 操作 |
|----|------|
| v | 选择工具 |
| h | 手形平移工具 |
| t | 创建文本节点 |
| r | 创建矩形节点 |
| i | 创建图片节点 |
| s | 创建便签节点 |
| e | 选框导出模式 |
| Ctrl+Shift+E | 导出选中节点为 PNG |
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z / Ctrl+Y | 重做 |
| Ctrl+A | 全选 |
| Ctrl+D | 复制选中节点（偏移 24px） |
| Delete / Backspace | 删除选中 |
| Escape | 取消选择 / 退出工具 / 退出选框导出 |

### 7. 资产库

- 图片/视频素材以 data URL 存储
- 上传：面板内上传按钮 + 画布拖放
- 使用：从面板拖入画布 → 创建对应节点
- 归档：AI 生成结果自动入库
- 独立 persist key (`ai-canvas-asset-library`)
- 已知限制：视频/音频拖入使用 blob URL（刷新后丢失），上传按钮走 data URL 持久化

### 8. 模板系统

- 预设画布布局（提示词模板 + 节点排列）
- 模板数据：`src/data/templates.ts`
- 一键实例化：`instantiateTemplate` 创建节点 + `gridLayout` 自动布局
- 实例化前弹出确认模态 (TemplatesModal)

### 9. 提示词库

- 内置预设 + 用户自定义（独立 persist）
- 按类别分组
- 应用：NodeInputBar 内点击 chip 注入对应 snippet 到 prompt
- 可组合：多个预设叠加（记录在 `appliedPresets`）

### 10. 撤消/重做系统

- 最多 50 步历史快照
- 每步记录：完整 `elements` + `connections` + 操作标签 + 时间戳
- 智能合并：同元素同属性类型在 500ms 内的连续编辑归为一步
- 拖拽位置不推入 undo 栈（帧级调用），只在拖拽结束时通过 `batchUpdatePositions` 记一步
- HistoryPanel 时间线 UI：任意跳转到历史状态

### 11. 导出

- **选中导出** (Ctrl+Shift+E)：将选中节点渲染到离屏 Canvas → PNG 下载
- **区域导出** (E)：拖拽虚框 → 确认工具栏 → PNG 下载
- 导出包含节点 + 连线
- 使用 `stageRegistry` 全局 Stage 引用，无需 prop drilling

### 12. 视觉风格

- CSS 变量系统：`--bg-0/1/2`（背景层级）、`--ink-0/1/2`（前景/文字）、`--accent`（强调色）
- 字体：Fraunces（标题 serif）、General Sans（正文）、IBM Plex Mono（等宽/代码）
- SVG 滤镜：纸质肌理（feTurbulence + mix-blend-mode: multiply）、暗角晕影（radial-gradient）
- 点格背景：`radial-gradient` 的圆点图案
- light/dark 双主题（`data-theme` 属性切换）
