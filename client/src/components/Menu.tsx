import { useState } from 'react';
import type { GameMode } from '@shared/types';
import { createGame, joinGame } from '../api';
import './Menu.css';

interface MenuProps {
  onStartGame: (mode: GameMode, gameId: string, playerRole?: 'player1' | 'player2') => void;
}

export function Menu({ onStartGame }: MenuProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [multiplayerSub, setMultiplayerSub] = useState<'idle' | 'choose' | 'create' | 'join'>('idle');
  const [joinId, setJoinId] = useState('');

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
      </div>
    </main>
  );
}
