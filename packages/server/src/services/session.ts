import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import type { Session, SessionSummary, ChatMessage, Task, FileDiff } from '@coding-agent/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../..');
const SESSIONS_DIR = path.resolve(projectRoot, 'data', 'sessions');

function sessionFilePath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9\-]/g, '');
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

export async function ensureSessionsDir(): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

export async function getSession(sessionId: string): Promise<Session> {
  const filePath = sessionFilePath(sessionId);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Session;
}

export async function saveSession(session: Session): Promise<void> {
  const filePath = sessionFilePath(session.id);
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function listSessions(): Promise<SessionSummary[]> {
  await ensureSessionsDir();
  const files = await fs.readdir(SESSIONS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const summaries: SessionSummary[] = [];
  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
      const session = JSON.parse(raw) as Session;
      summaries.push({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
        taskCount: session.tasks.length,
      });
    } catch {
      // Skip corrupt files
    }
  }

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSession(title?: string): Promise<Session> {
  const now = Date.now();
  const session: Session = {
    id: uuid(),
    title: title || 'New Session',
    createdAt: now,
    updatedAt: now,
    messages: [],
    tasks: [],
  };
  await saveSession(session);
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const filePath = sessionFilePath(sessionId);
  await fs.unlink(filePath);
}

export async function addMessageToSession(sessionId: string, message: ChatMessage): Promise<void> {
  const session = await getSession(sessionId);
  session.messages.push(message);
  session.updatedAt = Date.now();
  // Auto-title from first user message
  if (session.title === 'New Session' && message.role === 'user') {
    session.title = message.content.slice(0, 60) + (message.content.length > 60 ? '...' : '');
  }
  await saveSession(session);
}

/** Strip heavy content from diffs before persisting (keep hunks for inline preview) */
function slimTask(task: Task): Task {
  return {
    ...task,
    steps: task.steps.map((step) => {
      if (!step.diff) return step;
      return {
        ...step,
        diff: {
          ...step.diff,
          oldContent: '',
          newContent: '',
        },
      };
    }),
  };
}

export async function upsertTaskInSession(sessionId: string, task: Task): Promise<void> {
  const session = await getSession(sessionId);
  const slim = slimTask(task);
  const idx = session.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    session.tasks[idx] = slim;
  } else {
    session.tasks.push(slim);
  }
  session.updatedAt = Date.now();
  await saveSession(session);
}
