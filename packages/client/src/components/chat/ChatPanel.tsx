import React from 'react';
import { useStore } from '../../store';
import { SessionSidebar } from './SessionSidebar';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { PlanApprovalBar } from './PlanApprovalBar';

export function ChatPanel() {
  const sessionSidebarOpen = useStore((s) => s.sessionSidebarOpen);
  const pendingPlanTaskId = useStore((s) => s.pendingPlanTaskId);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)' }}>
      {sessionSidebarOpen && <SessionSidebar />}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100%',
          minWidth: 0,
        }}
      >
        <ChatHeader />
        <MessageList />
        {pendingPlanTaskId ? <PlanApprovalBar /> : <InputBar />}
      </div>
    </div>
  );
}
