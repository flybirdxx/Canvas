# AI 画布 (AI Canvas) - 架构与开发指南

## 1. 核心功能需求（初始版本 MVP - 阶段二）
根据开发计划文档（第3-7周：核心引擎开发），初始版本（Alpha/MVP）将不包含复杂的多人协同和工作流引擎，而是专注在产品的单机版体验和核心AI接驳能力：

1.  **高性能无限画布引擎 (Core Canvas Engine)**
    *   无限漫游（平移、缩放）、渲染视口优化。
    *   多图层管理、元素基础变换（移动、缩放、旋转）。
    *   历史记录系统（支持Undo/Redo 50步）。
2.  **AI 生成模块 (AI Generation Integration)**
    *   统一 AI 网关，支撑"文生图" (Text-to-Image) 和"图生图" (Image-to-Image)。
    *   基于提示词的智能生成、参数调节、批量生成。
    *   智能提示词辅助（联想补全、预设风格集）。
3.  **基础绘图与素材工具 (Drawing & Material Tools)**
    *   富文本、基础形状、便签、钢笔路径和蒙版。
    *   本地素材上传（PNG/SVG）及云端素材库索引。
    *   工作区管理与属性面板。

## 2. 核心用户体验路径 (User Flow)

```mermaid
graph TD
    A[用户登录/注册] --> B[进入工作区 Dashboard]
    B --> C{选择操作}
    C -->|新建空白画布| D[进入无限画布引擎]
    C -->|打开历史文件| D
    
    D --> E[使用基础工具栏]
    E --> F[添加形状/文本/上传图片]
    
    D --> G[使用 AI 创作面板]
    G --> H[输入提示词 \n 选择风格 & 参数]
    H --> I[调用 AI 网关生成图片]
    I --> J[将生成图片拖入/渲染至画布]
    
    F --> K[画布元素排版/二次编辑]
    J --> K
    
    K --> L[局部重绘 / AI 抠图扩展]
    L --> K
    
    K --> M[保存 / 历史版本记录]
    M --> N[导出图片 / 分享链接 (Beta)]
```

## 3. 开发环境与前端架构设置

基于计划书中的技术选型规划（React 19, TypeScript, WebGL/Canvas2D, Node.js后端），以下为纯前端应用（AI Studio 预览环境）的搭建步骤及软件库清单：

### 核心技术栈 & 库清单
*   **前端框架**: React 19 + TypeScript + Vite (环境已提供)。
*   **页面样式**: Tailwind CSS v4 (已配置) + Lucide React (图标)。
*   **画布渲染引擎**: `konva` + `react-konva` (采用 Canvas 2D 方案保证兼容与稳定性，满足MVP阶段性能基准)。
*   **状态管理**: `zustand` (负责跨组件的画布元素状态、选中状态、撤销栈管理)。
*   **唯一标识符**: `uuid` (用于生成图层、元素的唯一 ID)。

### 初始项目结构规划
```text
/src
 ├── /components          # UI 组件库
 │   ├── /canvas          # 无限画布与Konva渲染组件
 │   ├── /toolbar         # 左侧/顶部工具栏
 │   ├── /properties      # 右侧属性配置面板
 │   └── /ui              # 基础无状态UI组件 (Button, Input)
 ├── /store               # Zustand 状态中心
 │   ├── canvasStore.ts   # 画布元素、缩放、位置状态
 │   └── uiStore.ts       # 面板开闭等应用层状态
 ├── /types               # TypeScript 接口定义
 │   └── canvas.ts        # 元素类型 (Shape, Image, Text) 定义
 ├── /hooks               # 自定义 React Hooks (如快捷键监听)
 ├── /services            # 外部服务接口
 │   └── geminiService.ts # 针对AI Studio的Gemini API封装
 └── /lib                 # 工具函数 (Classnames 组合等)
```
