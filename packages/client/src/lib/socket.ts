import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@coding-agent/shared';

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
