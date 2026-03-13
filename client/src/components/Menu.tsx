import { useState } from 'react';
import type { GameMode } from '@shared/types';
import { createGame, joinGame, runMonteCarlo } from '../api';
import './Menu.css';

interface MenuProps {
  onStartGame: (mode: GameMode, gameId: string, playerRole?: 'player1' | 'player2') => void;
}

export function Menu({ onStartGame }: MenuProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [multiplayerSub, setMultiplayerSub] = useState<'idle' | 'choose' | 'create' | 'join'>('idle');
  const [joinId, setJoinId] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<{
    games: number;
    p1Strategy: string;
    p2Strategy: string;
    wins: { player1: number; player2: number; ties: number };
    averageMoves: number;
    maxMoves: number;
  } | null>(null);
  const [simGames, setSimGames] = useState(500);
  const [simP1, setSimP1] = useState<'random' | 'hunt' | 'parity' | 'probability'>('parity');
  const [simP2, setSimP2] = useState<'random' | 'hunt' | 'parity' | 'probability'>('hunt');

  const handleStartAi = async () => {
    setError(null);
    setLoading('ai');
    try {
      const { gameId } = await createGame('ai');
      onStartGame('ai', gameId, 'player1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game');
    } finally {
      setLoading(null);
    }
  };

  const handleCreateMultiplayer = async () => {
    setError(null);
    setLoading('create');
    try {
      const { gameId } = await createGame('multiplayer');
      onStartGame('multiplayer', gameId, 'player1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setLoading(null);
    }
  };

  const handleJoinMultiplayer = async () => {
    const id = joinId.trim();
    if (!id) {
      setError('Enter a game ID');
      return;
    }
    setError(null);
    setLoading('join');
    try {
      await joinGame(id);
      onStartGame('multiplayer', id, 'player2');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot join game');
    } finally {
      setLoading(null);
    }
  };

  const handleRunMonteCarlo = async () => {
    setSimError(null);
    setSimLoading(true);
    setSimResult(null);
    try {
      const result = await runMonteCarlo(simGames, simP1, simP2);
      setSimResult(result);
    } catch (e) {
      setSimError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <main className="menu">
      <div className="menu__card">
        <h1 className="menu__title">Battleship</h1>
        <p className="menu__subtitle">Select game mode</p>
        <div className="menu__actions">
          <button
            className="menu__btn menu__btn--primary"
            onClick={handleStartAi}
            disabled={loading !== null}
          >
            {loading === 'ai' ? 'Starting…' : 'vs. AI'}
          </button>
          <button
            className="menu__btn menu__btn--secondary"
            onClick={() => setMultiplayerSub('choose')}
          >
            vs. Human
          </button>
        </div>

        {multiplayerSub === 'choose' && (
          <div className="menu__multi">
            <button
              type="button"
              className="menu__link"
              onClick={() => setMultiplayerSub('create')}
            >
              Create game
            </button>
            <button
              type="button"
              className="menu__link"
              onClick={() => setMultiplayerSub('join')}
            >
              Join game
            </button>
          </div>
        )}
        {multiplayerSub === 'create' && (
          <div className="menu__multi">
            <button
              className="menu__btn menu__btn--primary"
              onClick={handleCreateMultiplayer}
              disabled={loading !== null}
            >
              {loading === 'create' ? 'Creating…' : 'Create game'}
            </button>
            <button type="button" className="menu__link" onClick={() => setMultiplayerSub('choose')}>
              Back
            </button>
          </div>
        )}
        {multiplayerSub === 'join' && (
          <div className="menu__join">
            <input
              type="text"
              className="menu__input"
              placeholder="Paste game ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
            />
            <button
              className="menu__btn menu__btn--primary"
              onClick={handleJoinMultiplayer}
              disabled={loading !== null || !joinId.trim()}
            >
              {loading === 'join' ? 'Joining…' : 'Join'}
            </button>
            <button type="button" className="menu__link" onClick={() => setMultiplayerSub('choose')}>
              Back
            </button>
          </div>
        )}

        {error && <p className="menu__error">{error}</p>}
        <p className="menu__hint">
          Multiplayer: create a game and share the game ID with the other player. Open this URL in another window and join with that ID.
        </p>

        <section className="menu__sim">
          <h2 className="menu__sim-title">Monte Carlo AI vs AI</h2>
          <p className="menu__sim-desc">
            Run simulated games between two AI strategies and see win rates and average game length.
          </p>
          <div className="menu__sim-controls">
            <label className="menu__sim-field">
              P1 strategy
              <select
                value={simP1}
                onChange={(e) => setSimP1(e.target.value as typeof simP1)}
              >
                <option value="random">random</option>
                <option value="hunt">hunt</option>
                <option value="parity">parity</option>
                <option value="probability">probability</option>
              </select>
            </label>
            <label className="menu__sim-field">
              P2 strategy
              <select
                value={simP2}
                onChange={(e) => setSimP2(e.target.value as typeof simP2)}
              >
                <option value="random">random</option>
                <option value="hunt">hunt</option>
                <option value="parity">parity</option>
                <option value="probability">probability</option>
              </select>
            </label>
            <label className="menu__sim-field">
              Games
              <input
                type="number"
                min={10}
                max={5000}
                value={simGames}
                onChange={(e) => setSimGames(Number(e.target.value) || 0)}
              />
            </label>
            <button
              type="button"
              className="menu__btn menu__btn--secondary menu__sim-btn"
              onClick={handleRunMonteCarlo}
              disabled={simLoading || simGames <= 0}
            >
              {simLoading ? 'Simulating…' : 'Run simulation'}
            </button>
          </div>
          {simError && <p className="menu__error menu__sim-error">{simError}</p>}
          {simResult && (
            <div className="menu__sim-result">
              <p className="menu__sim-meta">
                {simResult.games} games – P1: <strong>{simResult.p1Strategy}</strong>, P2:{' '}
                <strong>{simResult.p2Strategy}</strong>
              </p>
              <ul className="menu__sim-list">
                <li>
                  Wins – P1: {simResult.wins.player1}, P2: {simResult.wins.player2}, ties:{' '}
                  {simResult.wins.ties}
                </li>
                <li>Average moves: {simResult.averageMoves.toFixed(1)}</li>
                <li>Max moves: {simResult.maxMoves}</li>
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
