import {
  type GameState,
  type AIStrategyId,
  type PlayerRole,
  type Board,
  type ShipPlacement,
} from './shared/types.js';
import {
  createEmptyBoard,
  getRandomPlacements,
  getCellsForPlacement,
  processShot,
  allShipsSunk,
} from './shared/gameLogic.js';
import { GRID_SIZE } from './shared/constants.js';
import { getShot } from './strategies.js';

interface MonteCarloParams {
  games: number;
  p1Strategy: AIStrategyId;
  p2Strategy: AIStrategyId;
  maxTurns?: number;
}

interface MonteCarloSummary {
  games: number;
  p1Strategy: AIStrategyId;
  p2Strategy: AIStrategyId;
  wins: { player1: number; player2: number; ties: number };
  averageMoves: number;
  maxMoves: number;
}

function createBoardFromPlacements(placements: ShipPlacement[]): Board {
  const board = createEmptyBoard();
  for (const p of placements) {
    const cells = getCellsForPlacement(p.row, p.col, p.shipId, p.orientation);
    for (const { row, col } of cells) {
      board[row][col] = { state: 'ship', shipId: p.shipId };
    }
  }
  return board;
}

export function runMonteCarloGames(params: MonteCarloParams): MonteCarloSummary {
  const games = Math.max(1, Math.min(params.games || 0, 10_000));
  const maxTurns = params.maxTurns ?? 500;

  let winsP1 = 0;
  let winsP2 = 0;
  let ties = 0;
  let totalMoves = 0;
  let maxMoves = 0;

  for (let g = 0; g < games; g++) {
    const p1Placements = getRandomPlacements();
    const p2Placements = getRandomPlacements();
    const p1Board = createBoardFromPlacements(p1Placements);
    const p2Board = createBoardFromPlacements(p2Placements);

    const state: Pick<GameState, 'player1Shots' | 'player2Shots'> = {
      player1Shots: [],
      player2Shots: [],
    };

    let current: PlayerRole = 'player1';
    let moves = 0;

    while (moves < maxTurns) {
      const shot = getShot(state as GameState, current, current === 'player1' ? params.p1Strategy : params.p2Strategy);
      if (!shot) {
        break;
      }
      const targetBoard = current === 'player1' ? p2Board : p1Board;
      const shotsArr = current === 'player1' ? state.player1Shots : state.player2Shots;
      const { hit, sunkShipId, allSunk } = processShot(targetBoard, shot.row, shot.col);
      shotsArr.push({ row: shot.row, col: shot.col, hit, sunkShipId });
      moves++;

      if (allSunk || allShipsSunk(targetBoard)) {
        if (current === 'player1') winsP1++;
        else winsP2++;
        break;
      }

      current = current === 'player1' ? 'player2' : 'player1';
    }

    if (moves >= maxTurns) {
      ties++;
    }

    totalMoves += moves;
    if (moves > maxMoves) maxMoves = moves;
  }

  const averageMoves = games > 0 ? totalMoves / games : 0;
  return {
    games,
    p1Strategy: params.p1Strategy,
    p2Strategy: params.p2Strategy,
    wins: { player1: winsP1, player2: winsP2, ties },
    averageMoves,
    maxMoves,
  };
}

