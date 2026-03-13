import { useState, useEffect } from 'react';
import { Menu } from './components/Menu';
import { Game } from './components/Game';
import type { GameMode } from '@shared/types';
import type { PlayerRole } from '@shared/types';
import { loadGame, saveGame, clearGame } from './storage';

export type Screen = 'menu' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole>('player1');

  useEffect(() => {
    const stored = loadGame();
    if (stored?.gameId) {
      setGameId(stored.gameId);
      setMode(stored.mode);
      setPlayerRole(stored.playerRole);
      setScreen('game');
    }
  }, []);

  const startGame = (selectedMode: GameMode, id: string, role: PlayerRole = 'player1') => {
    setMode(selectedMode);
    setGameId(id);
    setPlayerRole(role);
    setScreen('game');
    saveGame({ gameId: id, mode: selectedMode, playerRole: role });
  };

  const goToMenu = () => {
    setScreen('menu');
    setMode(null);
    setGameId(null);
    setPlayerRole('player1');
    clearGame();
  };

  return (
    <div className="app">
      {screen === 'menu' && (
        <Menu onStartGame={startGame} />
      )}
      {screen === 'game' && mode && gameId && (
        <Game
          mode={mode}
          gameId={gameId}
          playerRole={playerRole}
          onBackToMenu={goToMenu}
          onRematch={async (selectedMode) => {
            const { createGame } = await import('./api');
            const { gameId: newId } = await createGame(selectedMode);
            startGame(selectedMode, newId, 'player1');
          }}
        />
      )}
    </div>
  );
}

export default App;
