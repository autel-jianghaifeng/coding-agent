# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs server + client concurrently)
npm run dev

# Run server only (tsx watch, hot reload, port 3001)
npm run dev:server

# Run client only (Vite dev server, port 5173)
npm run dev:client

# Build all packages (must be in order: shared → server → client)
npm run build

# Build shared types only (needed when shared types change)
npm run build:shared

# Start production server
npm start -w packages/server
```

No linters, formatters, or test frameworks are configured.

## Environment

Copy `.env.example` to `.env`. Required variables:

- `AI_PROVIDER`: `mock` or `claude` (default: `mock`)
- `ANTHROPIC_API_KEY`: required when using `claude` provider
- `PORT`: server port (default: `3001`)
- `WORKSPACE_ROOT`: sandboxed directory for AI file operations (default: `../../workspace`)

## Architecture

Monorepo with npm workspaces: `packages/shared`, `packages/server`, `packages/client`.

**shared** (`@coding-agent/shared`): Pure TypeScript types — `ChatMessage`, `Task`, `TaskStep`, `FileNode`, `FileDiff`, `Session`, and Socket.io event interfaces. No runtime code.

**server** (`@coding-agent/server`): Express + Socket.io backend.
- `providers/`: AI provider abstraction. `AIProvider` interface with `chat()` and `streamChat()` methods, implemented by `ClaudeProvider` (Anthropic SDK, claude-sonnet-4-5-20250929) and `MockProvider`.
- `agent/agent-loop.ts`: Orchestrates multi-round planning+execution loop (max 3 rounds). Each round: call LLM → parse tool calls → execute tools → feed results back to conversation → repeat until no tools or max rounds.
- `agent/planner.ts`: Calls provider with system prompt and conversation history. `streamPlanTask()` is the primary entry used in the agent loop.
- `agent/executor.ts`: Executes individual tool steps.
- `agent/tools/index.ts`: Tool definitions (read-file, write-file, create-dir, list-dir, search-files). Each tool has both schema (for LLM) and `execute` function.
- `services/workspace.ts`: File system operations with path traversal protection via `resolveSafe()`.
- `services/session.ts`: Session persistence to `data/sessions/{id}.json`.
- `socket/handler.ts`: Socket.io event handlers; entry point for `chat:send` → `runAgentLoop()`.

**client** (`@coding-agent/client`): React 18 + Vite.
- `store/index.ts`: Zustand store — single centralized state for messages, tasks, files, sessions.
- `hooks/useSocket.ts`: Socket.io connection management and all event handlers.
- Two-panel layout: chat panel (left) + code/diff viewer with Monaco Editor (right).

**Data flow**: User message → `chat:send` socket event → `runAgentLoop()` → `streamPlanTask()` → Claude API (streaming) → text deltas emitted via `chat:stream:delta` → tool calls parsed into steps → `executeStep()` → tool results added to conversation history → next round.

## Conventions

- **ESM everywhere**: All packages use `"type": "module"`. Relative imports require `.js` extension.
- **TypeScript strict mode**, target ES2022, moduleResolution bundler.
- **Files**: kebab-case (`agent-loop.ts`). **Components**: PascalCase (`ChatPanel.tsx`). **Types**: PascalCase. **Constants**: UPPER_SNAKE_CASE.
- Type-only imports use `import type`.
- Providers are class-based; services and utilities are functional modules.
- Vite dev server proxies `/socket.io` to the backend (port 3001).
- Health check: `GET /api/health`.
