import { useState, useCallback } from 'react';
import { SHIP_SPECS } from '@shared/types';
import { applyPlacementsToBoard, canPlaceShip } from '@shared/gameLogic';
import type { GameState, ShipPlacement, Orientation, PlayerRole } from '@shared/types';
import { submitPlacements } from '../api';
import { Grid } from './Grid';
import './PlacementPhase.css';

interface PlacementPhaseProps {
  gameId: string;
  mode: GameState['mode'];
  playerRole: PlayerRole;
  state: GameState;
  onPlacementsDone: () => void;
  onBack: () => void;
}

export function PlacementPhase({ gameId, mode, playerRole, state, onPlacementsDone, onBack }: PlacementPhaseProps) {
  const existing = playerRole === 'player1' ? (state.player1ShipsPlaced ?? []) : (state.player2ShipsPlaced ?? []);
  const [placements, setPlacements] = useState<ShipPlacement[]>(existing);
  const [currentIndex, setCurrentIndex] = useState(existing.length);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyPlaced = existing.length >= SHIP_SPECS.length;
  const spec = SHIP_SPECS[currentIndex];
  const board = applyPlacementsToBoard(placements);
  const canConfirm = currentIndex >= SHIP_SPECS.length;

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!spec) return;
      if (canPlaceShip(board, placements, row, col, spec.id, orientation)) {
        setPlacements((prev) => [
          ...prev,
          { shipId: spec.id, row, col, orientation },
        ]);
        setCurrentIndex((i) => i + 1);
      }
    },
    [spec, board, placements, orientation]
  );

  const handleRotate = useCallback(() => {
    setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  const handleUndo = useCallback(() => {
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    setPlacements((prev) => prev.slice(0, -1));
  }, [currentIndex]);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPlacements(gameId, playerRole, placements);
      onPlacementsDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }, [gameId, playerRole, placements, canConfirm, onPlacementsDone]);

  if (mode === 'multiplayer' && alreadyPlaced) {
    return (
      <main className="placement">
        <header className="placement__header">
          <button type="button" className="placement__back" onClick={onBack}>
            ← Menu
          </button>
          <h1 className="placement__title">Waiting for opponent</h1>
          <p className="placement__waiting">
            {playerRole === 'player1'
              ? <>You have placed all ships. Share Game ID <strong>{gameId}</strong> so the other player can join and place their ships.</>
              : <>You have placed all ships. Waiting for the other player to place theirs.</>}
          </p>
        </header>
        <div className="placement__content">
          <div className="placement__board-wrap">
            <p className="placement__waiting-label">Your placement</p>
            <Grid board={board} hideShips={false} interactive={false} />
          </div>
        </div>
        <p className="placement__waiting-hint">The page will update automatically when both players are ready.</p>
      </main>
    );
  }

  return (
    <main className="placement">
      <header className="placement__header">
        <button type="button" className="placement__back" onClick={onBack}>
          ← Menu
        </button>
        <h1 className="placement__title">Place your ships</h1>
        {mode === 'multiplayer' && (
          <p className="placement__game-id">Share this Game ID so the other player can join: <strong>{gameId}</strong></p>
        )}
      </header>
      <div className="placement__content">
        <div className="placement__board-wrap">
          <Grid
            board={board}
            hideShips={false}
            interactive={!!spec}
            onCellClick={handleCellClick}
          />
          {spec && (
            <div className="placement__hint">
              Click a cell to place <strong>{spec.name}</strong> ({spec.length} cells).{' '}
              <button type="button" onClick={handleRotate}>
                Rotate ({orientation})
              </button>
              {placements.length > 0 && (
                <button type="button" onClick={handleUndo}>Undo</button>
              )}
            </div>
          )}
        </div>
        <div className="placement__ships">
          {SHIP_SPECS.map((s, i) => (
            <div
              key={s.id}
              className={`placement__ship ${i < currentIndex ? 'placement__ship--placed' : ''} ${i === currentIndex ? 'placement__ship--current' : ''}`}
            >
              {s.name} ({s.length})
            </div>
          ))}
        </div>
      </div>
      {error && <p className="placement__error">{error}</p>}
      <footer className="placement__footer">
        <button
          className="placement__confirm"
          disabled={!canConfirm || submitting}
          onClick={handleConfirm}
        >
          {submitting ? 'Submitting…' : 'Confirm placement'}
        </button>
      </footer>
    </main>
  );
}
