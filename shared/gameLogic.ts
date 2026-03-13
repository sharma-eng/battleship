import { SHIP_SPECS, type Board, type ShipPlacement, type ShipId, type Orientation } from './types';
import { GRID_SIZE } from './constants';

export function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: 'empty' as const }))
  );
}

function getShipLength(shipId: ShipId): number {
  const spec = SHIP_SPECS.find((s) => s.id === shipId);
  return spec?.length ?? 0;
}

export function getCellsForPlacement(row: number, col: number, shipId: ShipId, orientation: Orientation): { row: number; col: number }[] {
  const len = getShipLength(shipId);
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < len; i++) {
    cells.push(
      orientation === 'horizontal' ? { row, col: col + i } : { row: row + i, col }
    );
  }
  return cells;
}

export function canPlaceShip(
  board: Board,
  placements: ShipPlacement[],
  row: number,
  col: number,
  shipId: ShipId,
  orientation: Orientation
): boolean {
  const cells = getCellsForPlacement(row, col, shipId, orientation);
  for (const { row: r, col: c } of cells) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    if (board[r][c].state === 'ship') return false;
  }
  // Check overlap with already placed ships (from placements applied to board)
  const alreadyPlaced = placements.filter((p) => p.shipId !== shipId);
  for (const p of alreadyPlaced) {
    const otherCells = getCellsForPlacement(p.row, p.col, p.shipId, p.orientation);
    for (const cell of cells) {
      if (otherCells.some((o) => o.row === cell.row && o.col === cell.col)) return false;
    }
  }
  return true;
}

export function applyPlacementsToBoard(placements: ShipPlacement[]): Board {
  const board = createEmptyBoard();
  for (const p of placements) {
    const cells = getCellsForPlacement(p.row, p.col, p.shipId, p.orientation);
    for (const { row, col } of cells) {
      board[row][col] = { state: 'ship', shipId: p.shipId };
    }
  }
  return board;
}

export function processShot(
  board: Board,
  row: number,
  col: number
): { hit: boolean; sunkShipId?: ShipId; sunkShipName?: string; allSunk?: boolean } {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
    return { hit: false };
  }
  const cell = board[row][col];
  if (cell.state === 'hit' || cell.state === 'miss' || cell.state === 'sunk') {
    return { hit: false }; // already shot
  }
  if (cell.state === 'empty') {
    board[row][col] = { state: 'miss' };
    return { hit: false };
  }
  // Hit a ship
  const shipId = cell.shipId!;
  board[row][col] = { ...cell, state: 'hit' };
  const sunk = checkShipSunk(board, shipId);
  if (sunk) {
    markShipSunk(board, shipId);
    const name = SHIP_SPECS.find((s) => s.id === shipId)?.name ?? shipId;
    const allSunk = allShipsSunk(board);
    return { hit: true, sunkShipId: shipId, sunkShipName: name, allSunk };
  }
  return { hit: true };
}

function checkShipSunk(board: Board, shipId: ShipId): boolean {
  const len = getShipLength(shipId);
  let hitCount = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = board[r][c];
      if (cell.shipId === shipId && (cell.state === 'hit' || cell.state === 'sunk')) hitCount++;
    }
  }
  return hitCount >= len;
}

function markShipSunk(board: Board, shipId: ShipId): void {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c].shipId === shipId) {
        board[r][c] = { ...board[r][c], state: 'sunk' };
      }
    }
  }
}

export function allShipsSunk(board: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = board[r][c];
      if (cell.state === 'ship') return false;
    }
  }
  return true;
}

export function getRandomPlacements(): ShipPlacement[] {
  const board = createEmptyBoard();
  const placements: ShipPlacement[] = [];
  for (const spec of SHIP_SPECS) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const orientation: Orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      if (canPlaceShip(board, placements, row, col, spec.id, orientation)) {
        placements.push({ shipId: spec.id, row, col, orientation });
        const cells = getCellsForPlacement(row, col, spec.id, orientation);
        for (const { row: r, col: c } of cells) {
          board[r][c] = { state: 'ship', shipId: spec.id };
        }
        placed = true;
      }
    }
    if (!placed) throw new Error(`Could not place ${spec.id}`);
  }
  return placements;
}
