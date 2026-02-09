import React, { useState, useRef } from 'react';
import { socket } from '../../lib/socket';
import { useStore } from '../../store';

export function InputBar() {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isProcessing = useStore((s) => s.isProcessing);

  const activeSessionId = useStore((s) => s.activeSessionId);

  const send = () => {
    const text = value.trim();
    if (!text || isProcessing) return;
    if (!activeSessionId) {
      // Auto-create a session first; the message will be sent after session:created
      socket.emit('session:create', {});
      return;
    }
    socket.emit('chat:send', { message: text, sessionId: activeSessionId });
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape' && isProcessing) {
      socket.emit('chat:cancel');
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = '40px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        alignItems: 'flex-end',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={isProcessing ? 'Agent is working... (Esc to cancel)' : 'Ask the agent to code something...'}
        disabled={isProcessing}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: '10px 12px',
          minHeight: 40,
          maxHeight: 120,
          lineHeight: '20px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
        }}
      />
      <button
        onClick={isProcessing ? () => socket.emit('chat:cancel') : send}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          background: isProcessing ? 'var(--error)' : 'var(--accent)',
          color: '#fff',
          fontWeight: 500,
          fontSize: 13,
          minHeight: 40,
          transition: 'background 0.15s',
        }}
      >
        {isProcessing ? 'Cancel' : 'Send'}
      </button>
    </div>
  );
}
