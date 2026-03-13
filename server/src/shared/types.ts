export const SHIP_SPECS = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
] as const;

export type ShipId = (typeof SHIP_SPECS)[number]['id'];
export type Orientation = 'horizontal' | 'vertical';

export interface ShipPlacement {
  shipId: ShipId;
  row: number;
  col: number;
  orientation: Orientation;
}

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface GridCell {
  state: CellState;
  shipId?: ShipId;
}

export type Board = GridCell[][];
export type GameMode = 'ai' | 'multiplayer';
export type AIStrategyId = 'random' | 'hunt' | 'parity' | 'probability';
export type GamePhase = 'placement' | 'firing' | 'ended';
export type PlayerRole = 'player1' | 'player2';

export interface ShotResult {
  row: number;
  col: number;
  hit: boolean;
  sunkShipId?: ShipId;
  sunkShipName?: string;
  gameOver?: boolean;
}

/** A single recorded move (shot) in a completed game. */
export interface HistoryMove {
  player: PlayerRole;
  row: number;
  col: number;
  hit: boolean;
  sunkShipId?: ShipId;
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  phase: GamePhase;
  currentTurn: PlayerRole | null;
  player1Board: Board | null;
  player2Board: Board | null;
  player1Shots: Array<{ row: number; col: number; hit: boolean; sunkShipId?: ShipId }>;
  player2Shots: Array<{ row: number; col: number; hit: boolean; sunkShipId?: ShipId }>;
  player1ShipsPlaced: ShipPlacement[];
  player2ShipsPlaced: ShipPlacement[];
  winner: PlayerRole | null;
  createdAt: number;
  updatedAt: number;
  /** Set when phase becomes 'ended'; used for game-over display and history. */
  completedAt?: number;
  /** Moves in play order (filled as shots are made). Used to build history. */
  movesLog?: HistoryMove[];
}

