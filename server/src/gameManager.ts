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
import { loadGames, saveGames, loadHistory, appendHistory } from './storage.js';

let games: Record<string, GameState> = {};

export async function initStorage() {
  games = await loadGames();
}

async function persist() {
  await saveGames(games);
}

/** Returns view of opponent board for a player (only hit/miss/sunk, no ship positions). */
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

/** Serialize state for a player (hide opponent's ship positions). */
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

export function createGame(mode: GameMode): GameState {
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
  };
  games[gameId] = state;
  persist();
  return state;
}

export function getGame(gameId: string, player?: PlayerRole): GameState | null {
  const state = games[gameId];
  if (!state) return null;
  if (player) return getStateForPlayer(state, player);
  return getStateForPlayer(state, 'player1');
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

export function submitPlacements(
  gameId: string,
  player: PlayerRole,
  placements: ShipPlacement[]
): GameState | null {
  const state = games[gameId];
  if (!state || state.phase !== 'placement') return null;
  if (!validatePlacements(placements)) return null;
  if (player === 'player2' && state.mode === 'multiplayer' && !state.player1Board) return null;
  if (player === 'player1') {
    state.player1ShipsPlaced = placements as GameState['player1ShipsPlaced'];
    state.player1Board = applyPlacementsToBoard(placements);
  } else {
    state.player2ShipsPlaced = placements as GameState['player2ShipsPlaced'];
    state.player2Board = applyPlacementsToBoard(placements);
  }
  state.updatedAt = Date.now();

  const bothPlaced =
    state.player1Board && state.player2Board;
  if (bothPlaced) {
    state.phase = 'firing';
    state.currentTurn = 'player1';
  }
  persist();
  return state;
}

export function fire(
  gameId: string,
  player: PlayerRole,
  row: number,
  col: number
): { result: { hit: boolean; sunkShipId?: string; sunkShipName?: string; gameOver?: boolean }; state: GameState } | null {
  const state = games[gameId];
  if (!state || state.phase !== 'firing' || state.currentTurn !== player) return null;
  const targetBoard = player === 'player1' ? state.player2Board! : state.player1Board!;
  const shots = player === 'player1' ? state.player1Shots : state.player2Shots;
  if (shots.some((s) => s.row === row && s.col === col)) return null;

  const { hit, sunkShipId, sunkShipName, allSunk } = processShot(targetBoard, row, col);
  shots.push({ row, col, hit, sunkShipId });

  state.updatedAt = Date.now();
  state.currentTurn = hit ? player : player === 'player1' ? 'player2' : 'player1';

  if (allSunk) {
    state.phase = 'ended';
    state.winner = player;
    state.currentTurn = null;
    const moves = state.player1Shots.length + state.player2Shots.length;
    appendHistory({
      gameId,
      mode: state.mode,
      winner: state.winner,
      moves,
      createdAt: state.createdAt,
      completedAt: Date.now(),
    });
  }

  persist();
  return {
    result: { hit, sunkShipId, sunkShipName, gameOver: !!allSunk },
    state: state,
  };
}

export function getGamesMap(): Record<string, GameState> {
  return games;
}
