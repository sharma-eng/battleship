import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { GameMode } from '@shared/types';

// In dev, connect directly to the backend so WebSocket isn't broken by the Vite proxy
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export function useSocket(gameId: string, mode: GameMode): ReturnType<typeof io> | null {
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    if (mode !== 'multiplayer') {
      setSocket(null);
      return;
    }
    const s = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });
    s.emit('joinGame', gameId);
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [gameId, mode]);

  return socket;
}
