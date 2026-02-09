import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { ensureWorkspace } from './services/workspace.js';
import { ensureSessionsDir } from './services/session.js';
import { setupSocketHandler } from './socket/handler.js';
import { startFileWatcher } from './services/file-watcher.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@coding-agent/shared';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', provider: config.aiProvider });
});

async function start() {
  await ensureWorkspace();
  await ensureSessionsDir();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    setupSocketHandler(io, socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  startFileWatcher(async (eventType, filePath) => {
    console.log(`File ${eventType}: ${filePath}`);
    try {
      const { getFileTree } = await import('./services/workspace.js');
      const tree = await getFileTree();
      io.emit('file:tree', tree);
    } catch {
      // Ignore errors during tree refresh
    }
  });

  httpServer.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`AI Provider: ${config.aiProvider}`);
    console.log(`Workspace: ${config.workspaceRoot}`);
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

start().catch(console.error);
