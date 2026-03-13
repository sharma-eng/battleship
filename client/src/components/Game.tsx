import { useEffect, useState, useCallback, useRef } from 'react';
import type { GameMode, PlayerRole } from '@shared/types';
import { getGame } from '../api';
import { useSocket } from '../hooks/useSocket';
import { PlacementPhase } from './PlacementPhase';
import { FiringPhase } from './FiringPhase';
import { GameOver } from './GameOver';
import type { GameState } from '@shared/types';

interface GameProps {
  mode: GameMode;
  gameId: string;
  playerRole: PlayerRole;
  onBackToMenu: () => void;
  onRematch: (mode: GameMode) => void;
}

export function Game({ mode, gameId, playerRole, onBackToMenu, onRematch }: GameProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastLocalUpdateRef = useRef(0);

  const socket = useSocket(gameId, mode);

  const refreshState = useCallback(async () => {
    try {
      const data = await getGame(gameId, playerRole);
      setState(data as GameState);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [gameId, playerRole]);

  const handleStateChange = useCallback((s: GameState) => {
    lastLocalUpdateRef.current = Date.now();
    setState(s);
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      if (Date.now() - lastLocalUpdateRef.current < 2000) return;
      refreshState();
    };
    socket.on('gameUpdated', handler);
    return () => {
      socket.off('gameUpdated', handler);
    };
  }, [socket, refreshState]);

  if (loading) return <div className="game-loading">Loading game…</div>;
  if (error) return <div className="game-error">{error} <button onClick={onBackToMenu}>Back to menu</button></div>;
  if (!state) return null;

  if (state.phase === 'ended') {
    const movesLog = state.movesLog ?? [];
    const totalMoves = movesLog.length || (state.player1Shots?.length ?? 0) + (state.player2Shots?.length ?? 0);
    return (
      <GameOver
        winner={state.winner}
        playerRole={playerRole}
        mode={mode}
        createdAt={state.createdAt}
        completedAt={state.completedAt ?? state.updatedAt}
        movesLog={movesLog}
        totalMoves={totalMoves}
        onRematch={() => onRematch(mode)}
        onMenu={onBackToMenu}
      />
    );
  }

  if (state.phase === 'placement') {
    return (
      <PlacementPhase
        gameId={gameId}
        mode={mode}
        playerRole={playerRole}
        state={state}
        onPlacementsDone={refreshState}
        onBack={onBackToMenu}
      />
    );
  }

  return (
    <FiringPhase
      gameId={gameId}
      mode={mode}
      playerRole={playerRole}
      state={state}
      onStateChange={handleStateChange}
      onBack={onBackToMenu}
    />
  );
}
