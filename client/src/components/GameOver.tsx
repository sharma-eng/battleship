import type { PlayerRole, GameMode } from '@shared/types';
import './GameOver.css';

interface GameOverProps {
  winner: PlayerRole | null;
  playerRole: PlayerRole;
  mode: GameMode;
  onRematch: () => void;
  onMenu: () => void;
}

export function GameOver({ winner, playerRole, onRematch, onMenu }: GameOverProps) {
  const isWinner = winner === playerRole;

  return (
    <main className="game-over">
      <div className="game-over__card">
        <h1 className="game-over__title">
          {winner ? (isWinner ? 'You win!' : 'You lose') : 'Game over'}
        </h1>
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
