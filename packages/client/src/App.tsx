import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PanelSplit } from './components/layout/PanelSplit';
import { useSocket } from './hooks/useSocket';
import { useStore } from './store';
import { socket } from './lib/socket';

export default function App() {
  useSocket();
  const isProcessing = useStore((s) => s.isProcessing);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProcessing) {
        socket.emit('chat:cancel');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing]);

  return (
    <AppShell>
      <PanelSplit />
    </AppShell>
  );
}
