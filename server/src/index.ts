import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  initStorage,
  createGame,
  getGame,
  submitPlacements,
  fire,
  getStateForPlayer,
  getGamesMap,
} from './gameManager.js';
import { getAIShot } from './ai.js';
import type { PlayerRole, AIStrategyId } from './shared/types.js';
import { runMonteCarloGames } from './simMonteCarlo.js';
import { getWinProbability } from './winProbability.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { path: '/socket.io', cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

await initStorage();

// REST: create game
app.post('/api/games', (req, res) => {
  const mode = req.body?.mode === 'multiplayer' ? 'multiplayer' : 'ai';
  const state = createGame(mode);
  res.json({ gameId: state.gameId });
});

// REST: win probability from current state (Monte Carlo playouts) — must be before generic :gameId
app.get('/api/games/:gameId/win-probability', (req, res) => {
  const { gameId } = req.params;
  const n = Math.min(500, Math.max(50, Number(req.query.n) || 150));
  try {
    const full = getGamesMap()[gameId];
    if (!full) {
      console.warn('[win-probability] game not found:', gameId);
      return res.status(404).send('Game not found');
    }
    if (full.phase !== 'firing') {
      return res.json({ player1: 0.5, player2: 0.5 });
    }
    const { player1, player2 } = getWinProbability(full, n);
    res.json({ player1, player2 });
  } catch (err) {
    console.error('win-probability error:', err);
    res.json({ player1: 0.5, player2: 0.5 });
  }
});

// REST: get game (player optional; default player1 for backward compat)
app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  const player = (req.query.player as PlayerRole) || 'player1';
  const state = getGame(gameId, player);
  if (!state) return res.status(404).send('Game not found');
  res.json(state);
});

// REST: join multiplayer game (assign player2)
app.post('/api/games/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const full = getGamesMap()[gameId];
  if (!full) return res.status(404).send('Game not found');
  if (full.mode !== 'multiplayer') return res.status(400).send('Not a multiplayer game');
  // If player2 has already placed, they already joined
  const alreadyJoined = full.player2ShipsPlaced.length > 0;
  if (alreadyJoined) return res.json({ player: 'player2' });
  res.json({ player: 'player2' });
});

// REST: submit placements
app.post('/api/games/:gameId/placements', (req, res) => {
  const { gameId } = req.params;
  const { player, placements } = req.body;
  if (!player || !Array.isArray(placements)) return res.status(400).send('Invalid body');
  const state = submitPlacements(gameId, player, placements);
  if (!state) return res.status(400).send('Invalid game or placements');
  broadcastGameUpdated(gameId);
  res.json({ ok: true });
});

// REST: fire
app.post('/api/games/:gameId/fire', (req, res) => {
  const { gameId } = req.params;
  const { player, row, col } = req.body;
  if (player === undefined || row === undefined || col === undefined)
    return res.status(400).send('Invalid body');
  let out = fire(gameId, player, row, col);
  if (!out) return res.status(400).send('Invalid shot or turn');
  let { result, state } = out;

  // AI turn (if mode is ai and it's now player2's turn) — run in same request so client gets one update
  while (state.mode === 'ai' && state.phase === 'firing' && state.currentTurn === 'player2') {
    const aiShot = getAIShot(state);
    if (!aiShot) break;
    const aiOut = fire(gameId, 'player2', aiShot.row, aiShot.col);
    if (!aiOut) break;
    state = aiOut.state;
  }

  broadcastGameUpdated(gameId);

  res.json({ ...result, state: getStateForPlayer(state, player) });
});

// REST: simulation spike – Monte Carlo outcomes for AI vs AI strategies
app.post('/api/sim/monte-carlo', (req, res) => {
  const body = req.body ?? {};
  const games = Number(body.games ?? 500);
  const p1 = (body.p1Strategy as AIStrategyId) ?? 'parity';
  const p2 = (body.p2Strategy as AIStrategyId) ?? 'hunt';

  const result = runMonteCarloGames({ games, p1Strategy: p1, p2Strategy: p2 });
  res.json(result);
});

function broadcastGameUpdated(gameId: string) {
  io.to(gameId).emit('gameUpdated', { gameId });
}

io.on('connection', (socket) => {
  socket.on('joinGame', (gameId: string) => {
    socket.join(gameId);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
