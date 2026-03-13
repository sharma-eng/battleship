import { memo } from 'react';
import { GRID_SIZE, COORDINATE_LETTERS } from '@shared/constants';
import type { Board, GridCell } from '@shared/types';
import './Grid.css';

interface GridProps {
  board: Board | null;
  hideShips?: boolean;
  interactive?: boolean;
  onCellClick?: (row: number, col: number) => void;
  shots?: Array<{ row: number; col: number; hit: boolean }>;
  pendingShot?: { row: number; col: number } | null;
  className?: string;
}

function getDisplayState(cell: GridCell, hideShips: boolean): GridCell['state'] {
  if (hideShips && cell.state === 'ship') return 'empty';
  return cell.state;
}

function GridInner({
  board,
  hideShips = false,
  interactive = false,
  onCellClick,
  shots = [],
  pendingShot,
  className = '',
}: GridProps) {
  const shotSet = new Set(shots.map((s) => `${s.row},${s.col}`));
  const shotHit = new Set(shots.filter((s) => s.hit).map((s) => `${s.row},${s.col}`));

  if (!board) {
    return (
      <div className={`grid ${className}`}>
        <div className="grid__placeholder">No board</div>
      </div>
    );
  }

  return (
    <div className={`grid ${className}`}>
      <div className="grid__row grid__row--header">
        <div className="grid__corner" />
        {Array.from({ length: GRID_SIZE }, (_, c) => (
          <div key={c} className="grid__header-cell">
            {COORDINATE_LETTERS[c]}
          </div>
        ))}
      </div>
      {board.map((row, r) => (
        <div key={r} className="grid__row">
          <div className="grid__side-cell">{r + 1}</div>
          {row.map((cell, c) => {
            const displayState = getDisplayState(cell, hideShips);
            const hasShot = hideShips && shotSet.has(`${r},${c}`);
            const isHit = hideShips && shotHit.has(`${r},${c}`);
            const isPending = pendingShot?.row === r && pendingShot?.col === c;

            let stateClass = 'grid__cell--empty';
            if (isPending) stateClass = 'grid__cell--pending';
            else if (displayState === 'ship') stateClass = 'grid__cell--ship';
            else if (displayState === 'hit' || (hasShot && isHit)) stateClass = 'grid__cell--hit';
            else if (displayState === 'miss' || (hasShot && !isHit)) stateClass = 'grid__cell--miss';
            else if (displayState === 'sunk') stateClass = 'grid__cell--sunk';

            const alreadyShot = hideShips && (displayState === 'hit' || displayState === 'miss' || displayState === 'sunk');
            return (
              <button
                key={c}
                type="button"
                className={`grid__cell ${stateClass}`}
                disabled={!interactive || alreadyShot || isPending}
                onClick={() => onCellClick?.(r, c)}
                aria-label={`${COORDINATE_LETTERS[c]}${r + 1}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const Grid = memo(GridInner);
