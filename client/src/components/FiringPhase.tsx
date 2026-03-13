import { useState, useCallback } from 'react';
import type { GameState, PlayerRole } from '@shared/types';
import { fire } from '../api';
import { Grid } from './Grid';
import './FiringPhase.css';

interface FiringPhaseProps {
  gameId: string;
  mode: GameState['mode'];
  playerRole: PlayerRole;
  state: GameState;
  onStateChange: (s: GameState) => void;
  onBack: () => void;
}

export function FiringPhase({ gameId, mode, playerRole, state, onStateChange, onBack }: FiringPhaseProps) {
  const [lastResult, setLastResult] = useState<{ hit: boolean; sunkShipName?: string; gameOver?: boolean } | null>(null);
  const [firing, setFiring] = useState(false);

  const isMyTurn = state.currentTurn === playerRole;
  const myBoard = playerRole === 'player1' ? state.player1Board : state.player2Board;
  const oppBoard = playerRole === 'player1' ? state.player2Board : state.player1Board;
  const myShots = (playerRole === 'player1' ? state.player1Shots : state.player2Shots) ?? [];

  const handleFire = useCallback(
    async (row: number, col: number) => {
      if (!isMyTurn || firing) return;
      const alreadyShot = myShots.some((s) => s.row === row && s.col === col);
      if (alreadyShot) return;
      setFiring(true);
      setLastResult(null);
      try {
        const result = await fire(gameId, playerRole, row, col);
        setLastResult({
          hit: result.hit,
          sunkShipName: result.sunkShipName,
          gameOver: result.gameOver,
        });
        if (result.state) onStateChange(result.state);
      } catch (e) {
        setLastResult({ hit: false, gameOver: false });
      } finally {
        setFiring(false);
      }
    },
    [gameId, playerRole, isMyTurn, firing, myShots, onStateChange]
  );

  return (
    <main className="firing">
      <header className="firing__header">
        <button type="button" className="firing__back" onClick={onBack}>
          ← Menu
        </button>
        <h1 className="firing__title">
          {state.phase === 'ended' ? 'Game over' : isMyTurn ? 'Your turn — choose a target' : "Opponent's turn"}
        </h1>
        {mode === 'multiplayer' && (
          <p className="firing__game-id">Game ID: {gameId.slice(0, 8)}… (share with opponent to join)</p>
        )}
      </header>
      {lastResult && (
        <div className={`firing__feedback firing__feedback--${lastResult.hit ? 'hit' : 'miss'}`}>
          {lastResult.hit ? 'Hit!' : 'Miss'}
          {lastResult.sunkShipName && ` — ${lastResult.sunkShipName} sunk!`}
          {lastResult.gameOver && ' You win!'}
        </div>
      )}
      <div className="firing__grids">
        <section className="firing__panel">
          <h2>Your fleet</h2>
          <Grid board={myBoard} hideShips={false} />
        </section>
        <section className="firing__panel">
          <h2>Your shots</h2>
          <Grid
            board={oppBoard}
            hideShips={true}
            shots={myShots}
            interactive={isMyTurn && !firing}
            onCellClick={handleFire}
          />
        </section>
      </div>
    </main>
  );
}
