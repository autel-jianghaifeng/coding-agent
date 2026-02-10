import React from 'react';
import { useStore } from '../../store';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { MessageItem } from './MessageItem';
import { TaskStepComponent } from './TaskStep';
import type { TaskStep } from '@coding-agent/shared';

function StepsBlock({ steps }: { steps: TaskStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div style={{ padding: '4px 16px 4px 16px' }}>
      <div
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        {steps.map((step, i) => (
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

  // Build the render list: interleave messages and their associated steps chronologically
  const items: React.ReactNode[] = [];
  const renderedStepIds = new Set<string>();

  for (const msg of messages) {
    items.push(<MessageItem key={msg.id} message={msg} />);

    // After each assistant message, render the steps that belong to this message
    if (msg.role === 'assistant' && msg.taskId) {
      const task = tasks.get(msg.taskId);
      if (task) {
        const stepsForMessage = task.steps.filter(
          (s) => s.afterMessageId === msg.id
        );
        if (stepsForMessage.length > 0) {
          for (const s of stepsForMessage) renderedStepIds.add(s.id);
          items.push(
            <StepsBlock key={`steps-${msg.id}`} steps={stepsForMessage} />
          );
        }
      }
    }
  }

  // Show any remaining steps that haven't been rendered yet
  // (e.g. steps without afterMessageId from old sessions, or steps still running)
  const activeTask = activeTaskId ? tasks.get(activeTaskId) : undefined;
  const unrenderedSteps = activeTask
    ? activeTask.steps.filter((s) => !renderedStepIds.has(s.id))
    : [];

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
      {unrenderedSteps.length > 0 && (
        <StepsBlock steps={unrenderedSteps} />
      )}
    </div>
  );
}
