import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '../chat/ChatPanel';
import { CodePanel } from '../code/CodePanel';

export function PanelSplit() {
  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      <Panel defaultSize={40} minSize={25}>
        <ChatPanel />
      </Panel>
      <PanelResizeHandle
        style={{
          width: 4,
          background: 'var(--border-color)',
          cursor: 'col-resize',
          transition: 'background 0.15s',
        }}
        className="resize-handle"
      />
      <Panel defaultSize={60} minSize={30}>
        <CodePanel />
      </Panel>
    </PanelGroup>
  );
}
