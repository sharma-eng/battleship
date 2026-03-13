import type { GameState, PlayerRole, AIStrategyId } from './shared/types.js';
import { GRID_SIZE } from './shared/constants.js';
import { SHIP_SPECS } from './shared/types.js';

/** Cells not yet shot by this player. */
function getValidTargets(state: GameState, player: PlayerRole): { row: number; col: number }[] {
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  const set = new Set(shots.map((s) => `${s.row},${s.col}`));
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!set.has(`${r},${c}`)) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Adjacent cells (up/down/left/right) not yet shot by this player. */
function getAdjacentUnshot(state: GameState, player: PlayerRole, row: number, col: number): { row: number; col: number }[] {
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  const set = new Set(shots.map((s) => `${s.row},${s.col}`));
  const adj: { row: number; col: number }[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && !set.has(`${r},${c}`))
      adj.push({ row: r, col: c });
  }
  return adj;
}

function getHitsToProbe(state: GameState, player: PlayerRole): { row: number; col: number }[] {
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  return shots.filter((s) => s.hit).map((s) => ({ row: s.row, col: s.col }));
}

/** Random among all valid cells. */
function strategyRandom(state: GameState, player: PlayerRole): { row: number; col: number } | null {
  const valid = getValidTargets(state, player);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

/** Hunt: prefer adjacent to hits; otherwise random. */
function strategyHunt(state: GameState, player: PlayerRole): { row: number; col: number } | null {
  const valid = getValidTargets(state, player);
  if (valid.length === 0) return null;
  const hits = getHitsToProbe(state, player);
  for (const h of hits) {
    const adj = getAdjacentUnshot(state, player, h.row, h.col);
    if (adj.length > 0) return adj[Math.floor(Math.random() * adj.length)];
  }
  return valid[Math.floor(Math.random() * valid.length)];
}

/** Parity: only shoot cells where (row+col)%2 === parity. Optimal vs random placement. */
function strategyParity(state: GameState, player: PlayerRole): { row: number; col: number } | null {
  const valid = getValidTargets(state, player);
  if (valid.length === 0) return null;
  const parity = 0; // even (row+col)%2 === 0
  const filtered = valid.filter((c) => (c.row + c.col) % 2 === parity);
  const pool = filtered.length > 0 ? filtered : valid;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Probability: for each unsunk ship length, count placements that cover each cell; shoot highest. */
function strategyProbability(state: GameState, player: PlayerRole): { row: number; col: number } | null {
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  const shotSet = new Set(shots.map((s) => `${s.row},${s.col}`));
  const hitSet = new Set(shots.filter((s) => s.hit).map((s) => `${s.row},${s.col}`));
  const sunk = new Set(shots.filter((s) => s.sunkShipId).flatMap((s) => (s.sunkShipId ? [s.sunkShipId] : [])));
  const lengths = SHIP_SPECS.filter((spec) => !sunk.has(spec.id)).map((s) => s.length);
  if (lengths.length === 0) {
    const valid = getValidTargets(state, player);
    return valid.length ? valid[Math.floor(Math.random() * valid.length)] : null;
  }
  const heat: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (const len of lengths) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        for (const horizontal of [true, false]) {
          let fits = true;
          for (let i = 0; i < len; i++) {
            const rr = horizontal ? r : r + i;
            const cc = horizontal ? c + i : c;
            if (rr < 0 || rr >= GRID_SIZE || cc < 0 || cc >= GRID_SIZE || shotSet.has(`${rr},${cc}`)) {
              fits = false;
              break;
            }
          }
          if (fits) for (let i = 0; i < len; i++) heat[horizontal ? r : r + i][horizontal ? c + i : c]++;
        }
      }
    }
  }
  let best = -1;
  const candidates: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (shotSet.has(`${r},${c}`)) continue;
      if (heat[r][c] > best) {
        best = heat[r][c];
        candidates.length = 0;
        candidates.push({ row: r, col: c });
      } else if (heat[r][c] === best) candidates.push({ row: r, col: c });
    }
  }
  if (candidates.length === 0) return strategyRandom(state, player);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const STRATEGIES: Record<AIStrategyId, (state: GameState, player: PlayerRole) => { row: number; col: number } | null> = {
  random: strategyRandom,
  hunt: strategyHunt,
  parity: strategyParity,
  probability: strategyProbability,
};

export function getShot(state: GameState, player: PlayerRole, strategyId: AIStrategyId): { row: number; col: number } | null {
  const fn = STRATEGIES[strategyId] ?? STRATEGIES.random;
  return fn(state, player);
}

export const STRATEGY_IDS: AIStrategyId[] = ['random', 'hunt', 'parity', 'probability'];
