PRD: RunningHub LLM 模型接入与文本生成能力扩展
1. 目标 (Objectives)
模型扩展: 接入 Gemini 3.1 (Pro/Flash) 和 DeepSeek V4 (Pro/Flash) 系列高性能语言模型。
能力闭环: 激活画布中的“文本节点”生成功能，使其支持从提示词到结构化内容的生成。
架构一致性: 复用现有的 Gateway Provider 模式，将文本生成能力集成到 RunningHubProvider 中。
2. 接入模型清单 (Model List)
模型 ID (Wire-level)	画布显示名称 (Label)	描述
google/gemini-3.1-pro-preview	Gemini 3.1 Pro	谷歌最强预览版，适合复杂推理与创意写作。
google/gemini-3.1-flash-lite-preview	Gemini 3.1 Flash Lite	极速响应，适合短文本生成与提示词精修。
deepseek/deepseek-v4-pro	DeepSeek V4 Pro	深度求索最新专业版，代码与逻辑能力极强。
deepseek/deepseek-v4-flash	DeepSeek V4 Flash	高性价比大模型，适合大规模文本处理。
3. 技术规格 (Technical Specifications)
3.1 接口协议
协议类型: OpenAI Chat Completion 兼容协议。
Endpoint: https://llm.runninghub.ai/v1/chat/completions
鉴权方式: Bearer Token (复用现有的 RunningHub API Key)。
3.2 功能点定义
文本生成 (Text Generation): 支持根据节点提示词生成长文本。
连线上下文 (Flow Context): 支持读取上游连线的文本节点内容作为生成背景。
流式响应 (Streaming - 可选): 考虑到画布节点 UI，首期采用非流式等待模式，保证节点状态转换的一致性。
4. 架构改动点 (Proposed Changes)
4.1 Gateway 层扩展
src/services/gateway/types.ts:
在 Capability 中确认包含 'text'。
定义 TextGenRequest 和 TextGenResult 接口（遵循 OpenAI 消息格式）。
src/services/gateway/providers/runninghub.ts:
在 models 数组中追加上述 4 个模型配置，capability 设为 'text'。
实现 generateText(req, config) 方法，负责组装 JSON 并调用 llm.runninghub.ai。
src/services/gateway/index.ts:
暴露 generateTextByModelId 统一调用入口。
4.2 业务逻辑层
src/services/textGeneration.ts (新建):
实现 runTextGeneration 函数。
处理“生成中”状态：创建/更新 text 类型的节点，或将 aigenerating 节点转换为文本。
src/store/slices/elementSlice.ts:
确保 updateElement 支持更新 text 内容。
4.3 UI 层更新
src/components/NodeInputBar.tsx:
当 element.type === 'text' 时，激活 handleSubmit 的文本生成分支。
移除“文本生成即将上线”的 Alert 拦截。
src/components/canvas/CanvasElements.tsx:
优化 TextNode 的展示，支持显示 Markdown 或带格式的长文本。