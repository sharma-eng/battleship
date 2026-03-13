# Battleship

A full-stack Battleship game with **vs. AI** and **vs. Human (real-time multiplayer)**. Built with React (TypeScript), Express, Socket.io, and Redis.

## Features

- **Rules-correct gameplay**: 10×10 grid, five ships (Carrier-5, Battleship-4, Cruiser-3, Submarine-3, Destroyer-2), placement validation, hit/miss/sunk feedback, win detection.
- **Ship placement**: Place all ships with rotation; validation before confirm.
- **Firing phase**: Your fleet (with incoming hits) and your shots (hit/miss/sunk on opponent grid), with clear feedback after each shot.
- **vs. AI**: AI places ships randomly; AI firing uses **smart targeting** (probes adjacent cells after a hit) instead of purely random.
- **vs. Human**: Two players in separate browser windows; real-time updates via Socket.io (no manual refresh). Create game → share Game ID → other player joins with that ID.
- **Persistence**: Game state survives page refresh (stored in Redis on the server + `localStorage` for game ID and player role). Each game records moves, outcome, and timestamps and shows a summary at game over.
- **Win probability**: During the firing phase, the UI shows an estimated win probability for each player based on Monte Carlo playouts from the current state.
- **AI vs AI Monte Carlo**: Run large batches of simulated games between different AI strategies (parity, hunt, random, probability) to compare win rates and move counts.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express
- **Real-time**: Socket.io with Redis adapter (for multi-instance scaling)
- **Storage**:
  - **Game state**: Redis (`game:{gameId}` keys, TTL 24h)
  - **Client session**: `localStorage` (gameId, mode, playerRole)

## Project structure

- **`client/`** – Vite + React app
  - `src/App.tsx` – top-level app; switches between menu and game, restores last game from local storage
  - `src/components/Menu.tsx` – mode selection (vs AI / vs Human), create/join game, Monte Carlo controls
  - `src/components/Game.tsx` – loads game state, wires Socket.io, renders `PlacementPhase`, `FiringPhase`, or `GameOver` depending on `state.phase`
  - `src/components/PlacementPhase.tsx` – ship placement UI and submission
  - `src/components/FiringPhase.tsx` – firing UI, win probability display, calls `fire` API
  - `src/components/Grid.tsx` – reusable 10×10 grid (placement/firing)
  - `src/hooks/useSocket.ts` – Socket.io client for multiplayer (`gameUpdated` events)
  - `src/api.ts` – HTTP API client (create game, join, get state, placements, fire, win probability, Monte Carlo sim)
  - `src/config.ts` – `API_BASE` and `SOCKET_URL` (dev vs prod via `VITE_API_URL`)
- **`server/`** – Express + Socket.io + Redis
  - `src/index.ts` – HTTP and Socket.io server, REST routes, `gameUpdated` broadcast, Redis Socket.io adapter
  - `src/gameManager.ts` – core game rules and state transitions (createGame, submitPlacements, fire, getStateForPlayer)
  - `src/storage.ts` – Redis-backed persistence (`getGameState`, `setGameState`, `deleteGameState`)
  - `src/ai.ts` – in-game AI target selection
  - `src/simMonteCarlo.ts` – AI vs AI Monte Carlo simulation
  - `src/strategies.ts` – AI strategies for simulation (random, hunt, parity, probability)
  - `src/winProbability.ts` – win-probability estimation via random playouts
  - `src/shared/*` – server-side copy of shared types/constants/game logic
- **`shared/`** – shared logic used by the client (and mirrored on the server)
  - `types.ts` – `GameState`, `Board`, `ShipPlacement`, ship specs, etc.
  - `constants.ts` – grid size and coordinate letters
  - `gameLogic.ts` – core board operations (placements, shots, win detection)

## Running locally

```bash
# Install root deps (concurrently)
npm install

# Install client and server deps
cd client && npm install && cd ..
cd server && npm install && cd ..

# Start a local Redis (or point REDIS_URL at a hosted Redis)
# Example with Docker:
# docker run -p 6379:6379 redis

# Create a server/.env for local dev (not needed in production)
cd server
echo "REDIS_URL=redis://localhost:6379" > .env
cd ..

# Run both (client on :5173, server on :3001)
npm run dev
```

Open `http://localhost:5173` (or the Vite port it prints). For multiplayer, open a second window and use “Join game” with the Game ID shown to the creator.

## Build & production

```bash
# Build client and server
npm run build

# Start the compiled server (from the repo root)
cd server
npm start   # runs: node dist/index.js
```

The server reads:

- `PORT` (default `3001`)
- `REDIS_URL` (required in production)

In production you typically:

- Serve the built client (`client/dist`) from a static host (e.g. Vercel).
- Run the server separately (e.g. on Railway, Fly.io, Render).
- Point the client at the server using `VITE_API_URL` (see below).

## Deployment: Vercel (frontend) + Railway (backend + Redis)

Vercel does **not** run long-lived Node servers or WebSockets; Railway does. The recommended setup:

- **Backend**: Express + Socket.io + Redis on Railway
- **Frontend**: Static Vite build on Vercel

### 1. Deploy the backend on Railway

1. Push your repo to GitHub.
2. On `railway.app`, create:
   - A **Redis** service.
   - A **Node** service pointing at the `server` directory.
3. In the Node service:
   - Set **Root Directory** to `server`.
   - Use the default build (`npm install && npm run build`).
   - **Start Command**: `npm start` (which runs `node dist/index.js`).
   - Add an environment variable `REDIS_URL` pointing at the internal Redis connection string.
4. Deploy and copy the public URL (e.g. `https://battleship-xxxx.up.railway.app`), **no trailing slash**.

### 2. Deploy the frontend to Vercel

1. On `vercel.com`, import the same GitHub repo.
2. Set **Root Directory** to `client`.
3. **Build Command**: `npm run build`. **Output Directory**: `dist`.
4. Add environment variable `VITE_API_URL` = your Railway backend URL (step 4 above).
5. Deploy. The client will use that URL for:
   - `GET/POST` under `/api`
   - Socket.io at `/socket.io`

| Where        | Deploy    | Config                          |
|-------------|-----------|----------------------------------|
| **Vercel**  | `client`  | `VITE_API_URL` = backend URL     |
| **Railway** | `server`  | `REDIS_URL`, optional `PORT`     |

## Game history and anti-cheat

- **On each game**: `createdAt`, `updatedAt`, optional `completedAt`, and `movesLog` (chronological list of shots: player, row, col, hit, sunkShipId) plus `winner`. These live inside the `GameState` in Redis.
- **Displayed at game-over**: The Game Over screen shows a summary (started/ended time, total moves, mode, and the full moves list).
- **Cheat prevention**:
  - Server never sends opponent ship positions to the client. Each player sees only an “opponent view” (hit/miss/sunk from their own shots).
  - The server enforces turn order (`currentTurn`) and rejects duplicate shots.
  - one other thing to consider is that a player may use a script to bypass the turn recording latency.
  - Ship placements are fully validated server-side (correct ships, no overlaps, in-bounds).

## Scaling and performance

- **Redis-backed state** allows you to run multiple server instances behind a load balancer (Socket.io uses the Redis adapter to broadcast between instances).
- **Game complexity**: Grid is O(G²); shot and placement checks are O(ship length). For much larger boards you can switch to sparse sets for ships and shots to keep memory proportional to actual activity.
- **Monte Carlo endpoints** are CPU-bound; if you need to push them to very high `n` or traffic, you can move them to a separate worker service.

## API

- `POST /api/games` — body: `{ "mode": "ai" | "multiplayer" }` → `{ "gameId" }`
- `POST /api/games/:gameId/join` — join multiplayer game → `{ "player": "player2" }`
- `GET /api/games/:gameId?player=player1|player2` — get game state (player-specific view)
- `POST /api/games/:gameId/placements` — body: `{ "player", "placements" }` → `{ "ok": true }`
- `POST /api/games/:gameId/fire` — body: `{ "player", "row", "col" }` → `{ "hit", "sunkShipName?", "gameOver?", "state" }`
- `GET /api/games/:gameId/win-probability?n=150` — estimated win probability from the current state
- `POST /api/sim/monte-carlo` — body: `{ "games"?, "p1Strategy"?, "p2Strategy"? }` → simulation stats (AI vs AI)

