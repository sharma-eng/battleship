const STORAGE_KEY = 'battleship_game';

export interface StoredGame {
  gameId: string;
  mode: 'ai' | 'multiplayer';
  playerRole: 'player1' | 'player2';
}

export function saveGame(data: StoredGame): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadGame(): StoredGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredGame;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
