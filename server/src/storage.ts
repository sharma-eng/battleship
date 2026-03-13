/**
 * Local file-based persistence for game state.
 * Uses a JSON file so no DB is required; suitable for single-server deployment.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { GameState } from './shared/types.js';

const DATA_DIR = join(process.cwd(), 'data');
const GAMES_FILE = join(DATA_DIR, 'games.json');

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function loadGames(): Promise<Record<string, GameState>> {
  await ensureDataDir();
  if (!existsSync(GAMES_FILE)) return {};
  const raw = await readFile(GAMES_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveGames(games: Record<string, GameState>): Promise<void> {
  await ensureDataDir();
  await writeFile(GAMES_FILE, JSON.stringify(games, null, 0), 'utf-8');
}
