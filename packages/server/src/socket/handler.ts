import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@coding-agent/shared';
import { config } from '../config.js';
import { getFileTree, readFile, getLanguageFromPath } from '../services/workspace.js';
import { runAgentLoop } from '../agent/agent-loop.js';
import { MockProvider } from '../providers/mock.js';
import { ClaudeProvider } from '../providers/claude.js';
import type { AIProvider } from '../providers/provider.js';
import * as sessionService from '../services/session.js';

function createProvider(): AIProvider {
  if (config.aiProvider === 'claude') {
    return new ClaudeProvider();
  }
  return new MockProvider();
}

const activeAborts = new Map<string, { aborted: boolean }>();

export function setupSocketHandler(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  const provider = createProvider();

  socket.on('workspace:init', async () => {
    try {
      const tree = await getFileTree();
      socket.emit('file:tree', tree);
    } catch (err: any) {
      socket.emit('error', { message: `Failed to load workspace: ${err.message}` });
    }
  });

  socket.on('file:tree', async () => {
    try {
      const tree = await getFileTree();
      socket.emit('file:tree', tree);
    } catch (err: any) {
      socket.emit('error', { message: `Failed to load file tree: ${err.message}` });
    }
  });

  socket.on('file:select', async ({ path: filePath }) => {
    try {
      const content = await readFile(filePath);
      const language = getLanguageFromPath(filePath);
      socket.emit('file:content', { path: filePath, content, language });
    } catch (err: any) {
      socket.emit('error', { message: `Failed to read file: ${err.message}` });
    }
  });

  // Session events
  socket.on('session:list', async () => {
    try {
      const sessions = await sessionService.listSessions();
      socket.emit('session:list', sessions);
    } catch (err: any) {
      socket.emit('error', { message: `Failed to list sessions: ${err.message}` });
    }
  });

  socket.on('session:create', async ({ title }) => {
    try {
      const session = await sessionService.createSession(title);
      socket.emit('session:created', {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: 0,
        taskCount: 0,
      });
    } catch (err: any) {
      socket.emit('error', { message: `Failed to create session: ${err.message}` });
    }
  });

  socket.on('session:load', async ({ sessionId }) => {
    try {
      const session = await sessionService.getClientSession(sessionId);
      socket.emit('session:loaded', session);
    } catch (err: any) {
      socket.emit('error', { message: `Failed to load session: ${err.message}` });
    }
  });

  socket.on('session:delete', async ({ sessionId }) => {
    try {
      await sessionService.deleteSession(sessionId);
      socket.emit('session:deleted', { sessionId });
    } catch (err: any) {
      socket.emit('error', { message: `Failed to delete session: ${err.message}` });
    }
  });

  socket.on('chat:send', async ({ message, sessionId }) => {
    const abortSignal = { aborted: false };
    activeAborts.set(socket.id, abortSignal);

    try {
      await runAgentLoop(io, socket, provider, message, abortSignal, sessionId);
    } catch (err: any) {
      socket.emit('error', { message: `Agent error: ${err.message}` });
    } finally {
      activeAborts.delete(socket.id);
    }
  });

  socket.on('chat:cancel', () => {
    const abortSignal = activeAborts.get(socket.id);
    if (abortSignal) {
      abortSignal.aborted = true;
    }
  });
}
