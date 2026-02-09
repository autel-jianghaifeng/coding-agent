import React from 'react';
import type { ChatMessage } from '@coding-agent/shared';
import { useStore } from '../../store';

export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const streamingMessageId = useStore((s) => s.streamingMessageId);
  const isStreaming = streamingMessageId === message.id;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        padding: '4px 16px',
      }}
    >
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? 'var(--user-bubble)' : 'var(--bg-tertiary)',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'var(--accent)',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'blink 0.8s step-end infinite',
            }}
          />
        )}
        {isStreaming && !message.content && (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Thinking...</span>
        )}
      </div>
    </div>
  );
}
