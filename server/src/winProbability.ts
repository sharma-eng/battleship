import type { GameState, PlayerRole, Board } from './shared/types.js';
import { processShot, allShipsSunk } from './shared/gameLogic.js';
import { GRID_SIZE } from './shared/constants.js';

function cloneBoard(board: Board | null): Board | null {
  if (!board) return null;
  return board.map((row) =>
    row.map((cell) => ({ ...cell }))
  );
}

function cloneShots(
  shots: GameState['player1Shots']
): GameState['player1Shots'] {
  return shots.map((s) => ({ ...s }));
}

/** Mutable copy of state (boards + shots + currentTurn) for playouts. */
interface PlayoutState {
  player1Board: Board | null;
  player2Board: Board | null;
  player1Shots: GameState['player1Shots'];
  player2Shots: GameState['player2Shots'];
  currentTurn: PlayerRole;
}

function cloneStateForPlayout(state: GameState): PlayoutState | null {
  if (!state.player1Board || !state.player2Board) return null;
  if (state.phase !== 'firing' || !state.currentTurn) return null;
  return {
    player1Board: cloneBoard(state.player1Board),
    player2Board: cloneBoard(state.player2Board),
    player1Shots: cloneShots(state.player1Shots),
    player2Shots: cloneShots(state.player2Shots),
    currentTurn: state.currentTurn,
  };
}

function getUnshotCells(shots: GameState['player1Shots']): { row: number; col: number }[] {
  const shotSet = new Set(shots.map((s) => `${s.row},${s.col}`));
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!shotSet.has(`${r},${c}`)) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Run one random playout from the given state; returns winner. */
function runOnePlayout(copy: PlayoutState): PlayerRole {
  const { player1Board, player2Board, player1Shots, player2Shots } = copy;
  if (!player1Board || !player2Board) return 'player1'; // fallback

  let currentTurn = copy.currentTurn;
  const maxMoves = GRID_SIZE * GRID_SIZE * 2;
  let moves = 0;

  while (moves < maxMoves) {
    const shots = currentTurn === 'player1' ? player1Shots : player2Shots;
    const targetBoard = currentTurn === 'player1' ? player2Board : player1Board;
    const unshot = getUnshotCells(shots);
    if (unshot.length === 0) break;

    const idx = Math.floor(Math.random() * unshot.length);
    const { row, col } = unshot[idx];
    const { hit, allSunk } = processShot(targetBoard, row, col);
    shots.push({ row, col, hit });

    if (allSunk) return currentTurn;
    currentTurn = hit ? currentTurn : currentTurn === 'player1' ? 'player2' : 'player1';
    moves++;
  }
  return 'player1'; // tie-break
}

const DEFAULT_PLAYOUTS = 150;

/**
 * Estimate win probability from current state by random playouts.
 * Returns proportions for player1 and player2 (sum to 1).
 */
export function getWinProbability(
  state: GameState,
  n: number = DEFAULT_PLAYOUTS
): { player1: number; player2: number } {
  if (!cloneStateForPlayout(state)) return { player1: 0.5, player2: 0.5 };

  let player1Wins = 0;
  let player2Wins = 0;
  for (let i = 0; i < n; i++) {
    const play = cloneStateForPlayout(state)!;
    const winner = runOnePlayout(play);
    if (winner === 'player1') player1Wins++;
    else player2Wins++;
  }
  const total = player1Wins + player2Wins;
  return {
    player1: total === 0 ? 0.5 : player1Wins / total,
    player2: total === 0 ? 0.5 : player2Wins / total,
  };
}
