/// <reference types="vite/client" />
/**
 * Backend base URL for API and WebSocket.
 * - Dev: uses Vite proxy for /api and direct localhost:3001 for Socket.io.
 * - Prod on Vercel: set VITE_API_URL to your backend URL (e.g. https://your-app.railway.app)
 *   so the client talks to that host for both REST and Socket.io (vs Human).
 * - Prod same-origin: leave unset so the app uses the same host (e.g. if you serve
 *   the built client from the Express server).
 */
const VITE_API_URL = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE =
  import.meta.env.DEV ? '/api' : (VITE_API_URL ? `${VITE_API_URL.replace(/\/$/, '')}/api` : '/api');

export const SOCKET_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : (VITE_API_URL ? VITE_API_URL.replace(/\/$/, '') : '');
