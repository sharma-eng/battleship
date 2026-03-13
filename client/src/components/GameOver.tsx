import type { PlayerRole, GameMode, HistoryMove } from '@shared/types';
import { COORDINATE_LETTERS } from '@shared/constants';
import './GameOver.css';

interface GameOverProps {
  winner: PlayerRole | null;
  playerRole: PlayerRole;
  mode: GameMode;
  createdAt: number;
  completedAt: number;
  movesLog: HistoryMove[];
  totalMoves: number;
  onRematch: () => void;
  onMenu: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function moveLabel(m: HistoryMove, index: number): string {
  const coord = `${COORDINATE_LETTERS[m.col]}${m.row + 1}`;
  const result = m.hit ? (m.sunkShipId ? 'sunk' : 'hit') : 'miss';
  return `${index + 1}. ${m.player === 'player1' ? 'P1' : 'P2'} ${coord} ${result}`;
}

export function GameOver({ winner, playerRole, mode, createdAt, completedAt, movesLog, totalMoves, onRematch, onMenu }: GameOverProps) {
  const isWinner = winner === playerRole;

  return (
    <main className="game-over">
      <div className="game-over__card">
        <h1 className="game-over__title">
          {winner ? (isWinner ? 'You win!' : 'You lose') : 'Game over'}
        </h1>

        <section className="game-over__history" aria-label="Game history">
          <h2 className="game-over__history-title">Game summary</h2>
          <dl className="game-over__meta">
            <dt>Started</dt>
            <dd>{formatTime(createdAt)}</dd>
            <dt>Ended</dt>
            <dd>{formatTime(completedAt)}</dd>
            <dt>Total moves</dt>
            <dd>{totalMoves}</dd>
            <dt>Mode</dt>
            <dd>{mode === 'ai' ? 'vs AI' : 'vs Human'}</dd>
          </dl>
          {movesLog.length > 0 && (
            <div className="game-over__moves">
              <span className="game-over__moves-label">Moves</span>
              <ol className="game-over__moves-list">
                {movesLog.map((m, i) => (
                  <li key={i}>{moveLabel(m, i)}</li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <div className="game-over__actions">
          <button type="button" className="game-over__btn" onClick={onRematch}>
            Rematch
          </button>
          <button type="button" className="game-over__btn game-over__btn--secondary" onClick={onMenu}>
            Back to menu
          </button>
        </div>
      </div>
    </main>
  );
}
