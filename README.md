# Coding Agent

AI 驱动的编码助手，采用类 Manus 风格的左右分栏布局。左侧为对话面板，右侧为文件树 + 代码查看器（支持 diff 高亮）。支持 Claude API 和 Mock 模式。

## 功能特性

- **AI 对话** — 通过自然语言描述需求，AI 自动规划并执行文件操作（创建、读写、搜索）
- **流式输出** — AI 回复逐字流式显示，每轮规划文本实时可见
- **文件变更预览** — 对话中内联展示文件修改 diff，点击可在右侧查看完整对比
- **代码编辑器** — Monaco Editor 提供语法高亮和 diff 对比视图
- **文件监控** — 自动监听 workspace 目录变化，实时刷新文件树
- **会话持久化** — 所有对话和任务步骤保存为 JSON 文件，刷新页面不丢失
- **多会话管理** — 支持创建、切换、删除多个独立会话

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 状态管理 | Zustand |
| 代码编辑器 | Monaco Editor |
| 布局 | react-resizable-panels |
| 通信 | Socket.io |
| 后端 | Express + TypeScript |
| AI | Anthropic Claude SDK |
| 文件监控 | Chokidar |
| Diff | diff (npm) |

## 项目结构

```
coding-agent/
├── packages/
│   ├── shared/          # 共享类型定义（消息、任务、文件、Socket 事件）
│   ├── server/          # Express + Socket.io 后端
│   │   └── src/
│   │       ├── agent/       # AI Agent 循环、规划器、执行器、工具
│   │       ├── providers/   # AI 提供者（Claude / Mock）
│   │       ├── services/    # workspace、session、diff、file-watcher
│   │       └── socket/      # Socket 事件处理
│   └── client/          # React 前端
│       └── src/
│           ├── components/
│           │   ├── chat/    # 对话面板（消息、输入、会话侧栏、文件变更块）
│           │   ├── code/    # 代码面板（文件树、代码查看器、Diff 查看器）
│           │   └── layout/  # 整体布局（AppShell、PanelSplit）
│           ├── hooks/       # useSocket、useAutoScroll
│           └── store/       # Zustand 状态
├── workspace/           # AI 操作的沙盒目录
├── data/sessions/       # 会话持久化存储
└── .env                 # 环境变量配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例配置并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# AI 提供者: "mock"（无需 API Key）或 "claude"
AI_PROVIDER=mock

# Anthropic API Key（AI_PROVIDER=claude 时必填）
ANTHROPIC_API_KEY=sk-ant-...

# 服务端口
PORT=3001

# workspace 目录（相对于 server 根目录）
WORKSPACE_ROOT=../../workspace
```

### 3. 构建共享包

```bash
npm run build:shared
```

### 4. 启动开发服务器

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3001

## 使用说明

1. 打开 http://localhost:5173
2. 在左侧输入框输入需求，例如「创建一个 Express 服务器」
3. AI 会自动规划步骤并执行文件操作，过程实时流式显示
4. 文件变更会以 diff 块形式展示在对话中，点击可在右侧查看完整对比
5. 左上角可以管理多个会话，所有对话自动保存

## AI 提供者

### Mock 模式

设置 `AI_PROVIDER=mock`，使用预设脚本模拟 AI 响应，适合开发调试。每次请求执行 3 轮：创建目录/文件 → 创建配置/文档 → 输出总结。

### Claude 模式

设置 `AI_PROVIDER=claude`，使用 Anthropic Claude API（claude-sonnet-4-5-20250929）。需要有效的 `ANTHROPIC_API_KEY`。AI 可使用以下工具：

| 工具 | 说明 |
|------|------|
| `read-file` | 读取 workspace 中的文件 |
| `write-file` | 写入文件（自动创建目录） |
| `create-dir` | 创建目录 |
| `list-dir` | 列出目录内容 |
| `search-files` | 按 glob 模式搜索文件 |

## 构建生产版本

```bash
npm run build
```
