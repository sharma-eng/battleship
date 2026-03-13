import IORedis from 'ioredis';
const Redis = IORedis.default ?? IORedis;
import type { GameState } from './shared/types.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL env var is required');

export const redis = new Redis(REDIS_URL);

const GAME_TTL = 60 * 60 * 24; // 24 hours

export async function getGameState(gameId: string): Promise<GameState | null> {
  const raw = await redis.get(`game:${gameId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function setGameState(state: GameState): Promise<void> {
  await redis.set(`game:${state.gameId}`, JSON.stringify(state), 'EX', GAME_TTL);
}

export async function deleteGameState(gameId: string): Promise<void> {
  await redis.del(`game:${gameId}`);
}
