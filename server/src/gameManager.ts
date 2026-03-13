import { v4 as uuidv4 } from 'uuid';
import { SHIP_SPECS } from './shared/types.js';
import type { GameState, GameMode, ShipPlacement, PlayerRole, Board } from './shared/types.js';
import {
  createEmptyBoard,
  applyPlacementsToBoard,
  processShot,
  allShipsSunk,
  getRandomPlacements,
  canPlaceShip,
  getCellsForPlacement,
} from './shared/gameLogic.js';
import { GRID_SIZE } from './shared/constants.js';
import { getGameState, setGameState } from './storage.js';

function getOpponentView(shots: GameState['player1Shots'], fullBoard: Board | null): Board | null {
  if (!fullBoard) return null;
  const view = createEmptyBoard();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const shot = shots.find((s) => s.row === r && s.col === c);
      if (shot) {
        const cell = fullBoard[r][c];
        view[r][c] = shot.hit
          ? { state: cell.state === 'sunk' ? 'sunk' : 'hit', shipId: cell.shipId }
          : { state: 'miss' };
      }
    }
  }
  return view;
}

export function getStateForPlayer(state: GameState, player: PlayerRole): GameState {
  if (player === 'player1') {
    return {
      ...state,
      player2Board: getOpponentView(state.player1Shots, state.player2Board),
    };
  }
  return {
    ...state,
    player1Board: getOpponentView(state.player2Shots, state.player1Board),
  };
}

export async function createGame(mode: GameMode): Promise<GameState> {
  const gameId = uuidv4();
  const now = Date.now();
  const player2ShipsPlaced = mode === 'ai' ? getRandomPlacements() : [];
  const player2Board = mode === 'ai' ? applyPlacementsToBoard(player2ShipsPlaced) : null;

  const state: GameState = {
    gameId,
    mode,
    phase: 'placement',
    currentTurn: null,
    player1Board: null,
    player2Board,
    player1Shots: [],
    player2Shots: [],
    player1ShipsPlaced: [],
    player2ShipsPlaced,
    winner: null,
    createdAt: now,
    updatedAt: now,
    movesLog: [],
  };
  await setGameState(state);
  return state;
}

export async function getGame(gameId: string, player?: PlayerRole): Promise<GameState | null> {
  const state = await getGameState(gameId);
  if (!state) return null;
  if (player) return getStateForPlayer(state, player);
  return getStateForPlayer(state, 'player1');
}

/** Get the full (unfiltered) game state — needed for AI logic and win probability. */
export async function getFullGame(gameId: string): Promise<GameState | null> {
  return getGameState(gameId);
}

function validatePlacements(placements: ShipPlacement[]): boolean {
  const requiredIds = new Set(SHIP_SPECS.map((s) => s.id));
  if (placements.length !== requiredIds.size) return false;
  const seen = new Set<string>();
  const board = createEmptyBoard();
  const applied: ShipPlacement[] = [];
  for (const p of placements) {
    if (!requiredIds.has(p.shipId) || seen.has(p.shipId)) return false;
    if (!canPlaceShip(board, applied, p.row, p.col, p.shipId, p.orientation)) return false;
    seen.add(p.shipId);
    applied.push(p);
    const cells = getCellsForPlacement(p.row, p.col, p.shipId, p.orientation);
    for (const { row: r, col: c } of cells) {
      board[r][c] = { state: 'ship', shipId: p.shipId };
    }
  }
  return true;
}

function normalizePlacements(placements: unknown[]): ShipPlacement[] {
  return placements.map((p: unknown) => {
    const x = p as Record<string, unknown>;
    const orientation = x.orientation === 'vertical' ? 'vertical' : 'horizontal';
    return {
      shipId: x.shipId as ShipPlacement['shipId'],
      row: Number(x.row),
      col: Number(x.col),
      orientation,
    };
  });
}

export async function submitPlacements(
  gameId: string,
  player: PlayerRole,
  placements: ShipPlacement[]
): Promise<GameState | null> {
  const state = await getGameState(gameId);
  if (!state || state.phase !== 'placement') return null;
  const normalized = normalizePlacements(placements);
  if (!validatePlacements(normalized)) return null;

  if (player === 'player1') {
    state.player1ShipsPlaced = normalized as GameState['player1ShipsPlaced'];
    state.player1Board = applyPlacementsToBoard(normalized);
  } else {
    state.player2ShipsPlaced = normalized as GameState['player2ShipsPlaced'];
    state.player2Board = applyPlacementsToBoard(normalized);
  }
  state.updatedAt = Date.now();

  const bothPlaced = state.player1Board && state.player2Board;
  if (bothPlaced) {
    state.phase = 'firing';
    state.currentTurn = 'player1';
  }
  await setGameState(state);
  return state;
}

export async function fire(
  gameId: string,
  player: PlayerRole,
  row: number,
  col: number
): Promise<{ result: { hit: boolean; sunkShipId?: string; sunkShipName?: string; gameOver?: boolean }; state: GameState } | null> {
  const state = await getGameState(gameId);
  if (!state || state.phase !== 'firing' || state.currentTurn !== player) return null;
  const targetBoard = player === 'player1' ? state.player2Board! : state.player1Board!;
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  if (shots.some((s) => s.row === row && s.col === col)) return null;

  const { hit, sunkShipId, sunkShipName, allSunk } = processShot(targetBoard, row, col);
  shots.push({ row, col, hit, sunkShipId });

  if (!state.movesLog) state.movesLog = [];
  state.movesLog.push({ player, row, col, hit, sunkShipId });

  state.updatedAt = Date.now();
  state.currentTurn = hit ? player : player === 'player1' ? 'player2' : 'player1';

  if (allSunk) {
    state.phase = 'ended';
    state.winner = player;
    state.currentTurn = null;
    state.completedAt = Date.now();
  }

  await setGameState(state);
  return {
    result: { hit, sunkShipId, sunkShipName, gameOver: !!allSunk },
    state,
  };
}
