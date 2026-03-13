import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, PlayerRole } from '@shared/types';
import { fire, getWinProbability } from '../api';
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
  const [winProb, setWinProb] = useState<{ player1: number; player2: number } | null>(null);
  const [winProbLoading, setWinProbLoading] = useState(false);
  const [pendingShot, setPendingShot] = useState<{ row: number; col: number } | null>(null);
  const fetchGenRef = useRef(0);

  const isMyTurn = state.currentTurn === playerRole;

  useEffect(() => {
    if (state.phase === 'ended') {
      const p1 = state.winner === 'player1' ? 1 : 0;
      const p2 = state.winner === 'player2' ? 1 : 0;
      setWinProb({ player1: p1, player2: p2 });
      setWinProbLoading(false);
      return;
    }
    if (state.phase !== 'firing') {
      setWinProb(null);
      setWinProbLoading(false);
      return;
    }

    fetchGenRef.current += 1;
    const myGen = fetchGenRef.current;
    setWinProbLoading(true);

    const applyResult = (p: { player1: number; player2: number }) => {
      if (myGen !== fetchGenRef.current) return;
      const p1 = typeof p.player1 === 'number' ? p.player1 : 0.5;
      const p2 = typeof p.player2 === 'number' ? p.player2 : 0.5;
      setWinProb({ player1: p1, player2: p2 });
    };
    const doneLoading = () => {
      if (myGen === fetchGenRef.current) setWinProbLoading(false);
    };

    getWinProbability(gameId, playerRole, 80)
      .then(applyResult)
      .catch(() => {
        if (myGen !== fetchGenRef.current) return;
        setTimeout(() => {
          if (fetchGenRef.current !== myGen) return;
          fetchGenRef.current += 1;
          const retryGen = fetchGenRef.current;
          getWinProbability(gameId, playerRole, 80)
            .then((p) => {
              if (retryGen !== fetchGenRef.current) return;
              setWinProb({ player1: p.player1, player2: p.player2 });
            })
            .catch(() => {})
            .finally(() => {
              if (retryGen === fetchGenRef.current) setWinProbLoading(false);
            });
        }, 1500);
      })
      .finally(doneLoading);
  }, [
    gameId,
    playerRole,
    state.phase,
    state.winner,
    state.updatedAt,
    state.player1Shots?.length,
    state.player2Shots?.length,
  ]);

  const myWinPct = winProb
    ? Math.round((playerRole === 'player1' ? winProb.player1 : winProb.player2) * 100)
    : null;
  const oppWinPct = winProb
    ? Math.round((playerRole === 'player1' ? winProb.player2 : winProb.player1) * 100)
    : null;
  const myBoard = playerRole === 'player1' ? state.player1Board : state.player2Board;
  const oppBoard = playerRole === 'player1' ? state.player2Board : state.player1Board;
  const myShots = (playerRole === 'player1' ? state.player1Shots : state.player2Shots) ?? [];

  const handleFire = useCallback(
    async (row: number, col: number) => {
      if (!isMyTurn || firing) return;
      const alreadyShot = myShots.some((s) => s.row === row && s.col === col);
      if (alreadyShot) return;
      setPendingShot({ row, col });
      setFiring(true);
      try {
        const result = await fire(gameId, playerRole, row, col);
        setPendingShot(null);
        setLastResult({
          hit: result.hit,
          sunkShipName: result.sunkShipName,
          gameOver: result.gameOver,
        });
        if (result.state) onStateChange(result.state);
      } catch (e) {
        setPendingShot(null);
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
        {(state.phase === 'firing' || state.phase === 'ended') && (
          <div className={`firing__win-prob ${winProbLoading && winProb ? 'firing__win-prob--updating' : ''}`}>
            <span className="firing__win-prob-you">You: {myWinPct ?? '—'}%</span>
            <span className="firing__win-prob-bar">
              <span
                className="firing__win-prob-fill"
                style={{ width: `${myWinPct ?? 50}%` }}
              />
            </span>
            <span className="firing__win-prob-opp">Opponent: {oppWinPct ?? '—'}%</span>
          </div>
        )}
      </header>
      <div className={`firing__feedback-wrap ${lastResult ? 'firing__feedback-wrap--visible' : ''}`}>
        {lastResult && (
          <div className={`firing__feedback firing__feedback--${lastResult.hit ? 'hit' : 'miss'}`}>
            {lastResult.hit ? 'Hit!' : 'Miss'}
            {lastResult.sunkShipName && ` — ${lastResult.sunkShipName} sunk!`}
            {lastResult.gameOver && ' You win!'}
          </div>
        )}
      </div>
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
            pendingShot={pendingShot}
          />
        </section>
      </div>
    </main>
  );
}
