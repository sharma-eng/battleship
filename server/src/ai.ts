import type { GameState } from './shared/types.js';
import { GRID_SIZE } from './shared/constants.js';

/** Returns cells that are valid to shoot (not yet shot by AI). */
function getValidTargets(state: GameState): { row: number; col: number }[] {
  const shots = state.player2Shots;
  const shotSet = new Set(shots.map((s) => `${s.row},${s.col}`));
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!shotSet.has(`${r},${c}`)) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Get adjacent cells (up, down, left, right) that haven't been shot. */
function getAdjacentUnshot(
  state: GameState,
  row: number,
  col: number
): { row: number; col: number }[] {
  const shots = state.player2Shots;
  const shotSet = new Set(shots.map((s) => `${s.row},${s.col}`));
  const adj: { row: number; col: number }[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && !shotSet.has(`${r},${c}`)) {
      adj.push({ row: r, col: c });
    }
  }
  return adj;
}

/** Find last hit that isn't part of a sunk ship (we don't track sunk per cell; use hits that might have adjacent). */
function getHitsToProbe(state: GameState): { row: number; col: number }[] {
  const hits = state.player2Shots.filter((s) => s.hit);
  return hits.map((s) => ({ row: s.row, col: s.col }));
}

/** Smart AI: prefer adjacent cells to hits, otherwise random. */
export function getAIShot(state: GameState): { row: number; col: number } | null {
  const valid = getValidTargets(state);
  if (valid.length === 0) return null;

  const hits = getHitsToProbe(state);
  for (const h of hits) {
    const adj = getAdjacentUnshot(state, h.row, h.col);
    if (adj.length > 0) {
      return adj[Math.floor(Math.random() * adj.length)];
    }
  }
  return valid[Math.floor(Math.random() * valid.length)];
}
