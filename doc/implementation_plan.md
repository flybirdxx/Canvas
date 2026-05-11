# 实施方案：结构化分镜升级

升级现有的 `SceneElement` 和 `StoryboardView`，以支持结构化剧本行（角色、情绪、时间戳），复刻 OmniScript 的核心体验。

## 需要用户评审

> [!IMPORTANT]
> **数据迁移：** 此更改为 `SceneElement` 引入了结构化的 `lines` 数组。现有的 `content` 将保留在新的 `summary` 字段中或作为备选，但 UI 将转向结构化视图。
> **AI 解析：** 初始实现将侧重于 UI 和手动编辑。从 Markdown 剧本自动解析的功能将作为对现有 `convertScriptToScenes` 逻辑的增量改进。

## 拟议变更

### 核心类型与存储 (Core Types & Store)

#### [修改] [canvas.ts](file:///d:/Programs/Board/Canvas/src/types/canvas.ts)
- 添加 `ScriptLine` 接口。
- 添加 `lineType`: `'dialogue' | 'action' | 'environment'`。
- 更新 `SceneElement` 以包含 `lines: ScriptLine[]` 和 `summary?: string`。
- 同步更新 `ParsedScene`。

#### [修改] [useCanvasStore.ts](file:///d:/Programs/Board/Canvas/src/store/useCanvasStore.ts)
- 确保持久化逻辑能正确处理新的嵌套数组。

---

### UI 组件 (UI Components)

#### [修改] [StoryboardView.tsx](file:///d:/Programs/Board/Canvas/src/components/StoryboardView.tsx)
- **详情面板 (DetailPanel)：** 完全重写内容区域。将单一的 `textarea` 替换为 `ScriptLine` 编辑器列表。
- **AI 按钮：** 在编辑器上方增加“AI 智能结构化”按钮，调用 AI 服务重写当前场次内容。
- **样式：** 为剧本行引入“OmniScript 风格”的 CSS（角色气泡、情绪图标）。

#### [新增] [ScriptLineEditor.tsx](file:///d:/Programs/Board/Canvas/src/components/storyboard/ScriptLineEditor.tsx)
- 用于编辑单行剧本的专用子组件（包含角色、情绪、内容选择）。

---

### 工具与服务 (Utils & Services)

#### [修改] [scriptParser.ts](file:///d:/Programs/Board/Canvas/src/utils/scriptParser.ts)
- **双引擎策略：**
  - **引擎 A (正则):** 增强正则表达式，快速提取标准格式（如 `角色：(情绪) 对话`）。
  - **引擎 B (AI):** 实现 `ScriptAiService.ts`。

#### [新增] [ScriptAiService.ts](file:///d:/Programs/Board/Canvas/src/services/ScriptAiService.ts)
- **核心逻辑：** 调用 `generateTextByModelId`。
- **System Prompt：** 预设专业剧本解析指令，要求 LLM 输出严格的 JSON 格式。
- **容错处理：** 自动处理 LLM 返回的 JSON 块（剥离 Markdown 标识符）。

---

## 验证计划

### 自动化测试
- `scriptParser` 单元测试：验证 `老板：(生气) 给我出去！` 是否能正确解析为 `ScriptLine`。
- 存储测试：验证添加/删除行不会破坏画布的持久化。

### 手动验证
1. 创建一个带有结构化对话的 `Script` 节点。
2. 点击“转换为分镜 (Convert to Scenes)”。
3. 打开 `StoryboardView`。
4. 验证每个 `SceneCard` 是否显示了解析出的剧本行。
5. 打开 `DetailPanel` 并编辑角色/情绪。
6. 验证更改是否已保存到 Store 中。
