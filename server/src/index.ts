import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import {
  createGame,
  getGame,
  getFullGame,
  submitPlacements,
  fire,
  getStateForPlayer,
} from './gameManager.js';
import { redis } from './storage.js';
import { getAIShot } from './ai.js';
import type { PlayerRole, AIStrategyId } from './shared/types.js';
import { runMonteCarloGames } from './simMonteCarlo.js';
import { getWinProbability } from './winProbability.js';

const app = express();
const httpServer = createServer(app);

const pubClient = redis.duplicate();
const subClient = redis.duplicate();
const io = new Server(httpServer, { path: '/socket.io', cors: { origin: '*' } });
io.adapter(createAdapter(pubClient, subClient));

app.use(cors());
app.use(express.json());

app.post('/api/games', async (req, res) => {
  const mode = req.body?.mode === 'multiplayer' ? 'multiplayer' : 'ai';
  const state = await createGame(mode);
  res.json({ gameId: state.gameId });
});

app.get('/api/games/:gameId/win-probability', async (req, res) => {
  const { gameId } = req.params;
  const n = Math.min(500, Math.max(50, Number(req.query.n) || 150));
  try {
    const full = await getFullGame(gameId);
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

app.get('/api/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const player = (req.query.player as PlayerRole) || 'player1';
  const state = await getGame(gameId, player);
  if (!state) return res.status(404).send('Game not found');
  res.json(state);
});

app.post('/api/games/:gameId/join', async (req, res) => {
  const { gameId } = req.params;
  const full = await getFullGame(gameId);
  if (!full) return res.status(404).send('Game not found');
  if (full.mode !== 'multiplayer') return res.status(400).send('Not a multiplayer game');
  res.json({ player: 'player2' });
});

app.post('/api/games/:gameId/placements', async (req, res) => {
  const { gameId } = req.params;
  const { player, placements } = req.body;
  if (!player || !Array.isArray(placements)) return res.status(400).send('Invalid body');
  const state = await submitPlacements(gameId, player, placements);
  if (!state) return res.status(400).send('Invalid game or placements');
  broadcastGameUpdated(gameId);
  res.json({ ok: true });
});

app.post('/api/games/:gameId/fire', async (req, res) => {
  const { gameId } = req.params;
  const { player, row, col } = req.body;
  if (player === undefined || row === undefined || col === undefined)
    return res.status(400).send('Invalid body');
  let out = await fire(gameId, player, row, col);
  if (!out) return res.status(400).send('Invalid shot or turn');
  let { result, state } = out;

  while (state.mode === 'ai' && state.phase === 'firing' && state.currentTurn === 'player2') {
    const aiShot = getAIShot(state);
    if (!aiShot) break;
    const aiOut = await fire(gameId, 'player2', aiShot.row, aiShot.col);
    if (!aiOut) break;
    state = aiOut.state;
  }

  broadcastGameUpdated(gameId);
  res.json({ ...result, state: getStateForPlayer(state, player) });
});

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
