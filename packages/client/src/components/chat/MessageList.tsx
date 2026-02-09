import React from 'react';
import { useStore } from '../../store';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { MessageItem } from './MessageItem';
import { TaskStepComponent } from './TaskStep';

function TaskStepsBlock({ taskId }: { taskId: string }) {
  const tasks = useStore((s) => s.tasks);
  const task = tasks.get(taskId);

  if (!task || task.steps.length === 0) return null;

  return (
    <div style={{ padding: '4px 16px 4px 16px' }}>
      <div
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        {task.steps.map((step, i) => (
          <TaskStepComponent key={step.id} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

export function MessageList() {
  const messages = useStore((s) => s.messages);
  const tasks = useStore((s) => s.tasks);
  const activeTaskId = useStore((s) => s.activeTaskId);
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, tasks, activeTaskId]);

  // Track which taskIds have already been rendered via user messages
  // so we don't duplicate the active task block at the bottom
  const renderedTaskIds = new Set<string>();

  // Build the render list: message + its task steps interleaved
  const items: React.ReactNode[] = [];

  for (const msg of messages) {
    items.push(<MessageItem key={msg.id} message={msg} />);

    // After a user message that triggered a task, render that task's steps
    if (msg.role === 'user' && msg.taskId) {
      renderedTaskIds.add(msg.taskId);
      items.push(<TaskStepsBlock key={`steps-${msg.taskId}`} taskId={msg.taskId} />);
    }
  }

  // If there's an active running task whose steps haven't been rendered yet
  // (e.g. the user message hasn't arrived from server yet), show at bottom
  const activeTask = activeTaskId ? tasks.get(activeTaskId) : undefined;
  const showTrailingSteps =
    activeTask &&
    activeTask.steps.length > 0 &&
    !renderedTaskIds.has(activeTaskId!);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {messages.length === 0 && !activeTask && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
            textAlign: 'center',
            padding: 32,
          }}
        >
          Ask the agent to build something.<br />
          It will create and modify files in the workspace.
        </div>
      )}
      {items}
      {showTrailingSteps && (
        <TaskStepsBlock taskId={activeTaskId!} />
      )}
    </div>
  );
}
