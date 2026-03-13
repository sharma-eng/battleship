import { API_BASE } from './config';

export async function createGame(mode: 'ai' | 'multiplayer'): Promise<{ gameId: string }> {
  const res = await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to create game'));
  return res.json();
}

export async function getGame(gameId: string, player?: 'player1' | 'player2'): Promise<unknown> {
  const url = player ? `${API_BASE}/games/${gameId}?player=${player}` : `${API_BASE}/games/${gameId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text().catch(() => 'Game not found'));
  return res.json();
}

export async function joinGame(gameId: string): Promise<{ player: 'player2' }> {
  const res = await fetch(`${API_BASE}/games/${gameId}/join`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Cannot join game'));
  return res.json();
}

export async function submitPlacements(
  gameId: string,
  player: 'player1' | 'player2',
  placements: Array<{ shipId: string; row: number; col: number; orientation: string }>
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/games/${gameId}/placements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, placements }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Invalid placements'));
  return res.json();
}

export async function fire(
  gameId: string,
  player: 'player1' | 'player2',
  row: number,
  col: number
): Promise<{
  hit: boolean;
  sunkShipId?: string;
  sunkShipName?: string;
  gameOver?: boolean;
  state?: import('@shared/types').GameState;
}> {
  const res = await fetch(`${API_BASE}/games/${gameId}/fire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, row, col }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Invalid shot'));
  return res.json();
}
