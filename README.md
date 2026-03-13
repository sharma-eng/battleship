# Battleship

A full-stack Battleship game with **vs. AI** and **vs. Human (real-time multiplayer)**. Built with React (TypeScript), Express, and Socket.io.

## Features

- **Rules-correct gameplay**: 10×10 grid, five ships (Carrier-5, Battleship-4, Cruiser-3, Submarine-3, Destroyer-2), placement validation, hit/miss/sunk feedback, win detection.
- **Ship placement**: Place all ships with rotation; validation before confirm.
- **Firing phase**: Your fleet (with incoming hits) and your shots (hit/miss/sunk on opponent grid), with clear feedback after each shot.
- **vs. AI**: AI places ships randomly; AI firing uses **smart targeting** (probes adjacent cells after a hit) instead of purely random.
- **vs. Human**: Two players in separate browser windows; real-time updates via Socket.io (no manual refresh). Create game → share Game ID → other player joins with that ID.
- **Persistence**: Game state survives page refresh (stored on server + `localStorage` for game ID and player role). Completed games are recorded (moves, outcome, timestamps) and can be queried via `/api/history`.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Storage**: Local file-based JSON (`server/data/`) for games and history — no external DB. Easy to swap to SQLite or PostgreSQL later.

## Running locally

```bash
# Install root deps (concurrently)
npm install

# Install client and server deps
cd client && npm install && cd ..
cd server && npm install && cd ..

# Run both (client on :5173, server on :3001)
npm run dev
```

Open http://localhost:5173. For multiplayer, open a second window and use “Join game” with the Game ID shown to the creator.

## Build & production

```bash
npm run build
# Serve client build (e.g. from client/dist) and run server:
cd server && npm start
```

Set `PORT` for the server (default 3001). In production, serve the client with the same host as the API or set Vite proxy / env so `/api` and `/socket.io` point to the server.

## Deployment: Vercel (frontend) + Railway (backend)

Vercel does **not** run long-lived servers or WebSockets. For **vs Human** (Socket.io) to work:

- The client’s API base and Socket.io path match the deployed server URL.
- **Backend** (Express + Socket.io) on Railway, Render, or Fly.io.

### 1. Deploy the backend (e.g. Railway)

1. Push your repo to GitHub.
2. Go to [railway.app](https://railway.app), sign in, **New Project** → **Deploy from GitHub** → select your repo.
3. Set **Root Directory** to `server`.
4. **Settings** → **Start Command**: `npx tsx src/index.ts`.
5. Deploy and copy the public URL (e.g. `https://battleship-xxxx.up.railway.app`). No trailing slash.

### 2. Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com), sign in, **Add New** → **Project** → import the same GitHub repo.
2. **Root Directory**: set to `client`.
3. **Build Command**: `npm run build`. **Output Directory**: `dist`.
4. **Environment Variables**: add `VITE_API_URL` = your backend URL from step 1.
5. Deploy. The client uses that URL for `/api` and Socket.io, so vs Human and all features work.

| Where       | Deploy   | Config                          |
|------------|----------|----------------------------------|
| **Vercel** | `client` | `VITE_API_URL` = backend URL     |
| **Railway**| `server` | Use generated public URL         |

## Persistence and storage choice

- **In-game state**: Kept in memory and persisted to `server/data/games.json` so games survive server restarts and refreshes.
- **History**: Completed games are appended to `server/data/history.json` (gameId, mode, winner, move count, timestamps). Query with `GET /api/history`.
- **Why file-based**: Simple, no DB setup, suitable for single-instance deployment. For scale, replace the storage layer in `server/src/storage.ts` with SQLite or a remote DB.

## Cheating and prevention

- **Opponent board**: Server never sends ship positions to the client. Each player only receives a “view” of the opponent grid (hit/miss/sunk from their own shots) via `getStateForPlayer`.
- **Turn and shot validity**: Only the current player can fire; server checks `currentTurn` and rejects duplicate shots.
- **Placements**: Server validates placement count and overlap in `validatePlacements`; no client-only placement trust.

## Scaling (huge board)

- **Complexity**: Grid is O(G²) in size; shot and placement checks are O(ship length). For a huge board, use sparse structures (e.g. a Set of ship cells and a Set of shot cells) instead of a full 2D array so memory and lookups stay proportional to ships and shots.

## API

- `POST /api/games` — body: `{ "mode": "ai" | "multiplayer" }` → `{ "gameId" }`
- `POST /api/games/:gameId/join` — join multiplayer game → `{ "player": "player2" }`
- `GET /api/games/:gameId?player=player1|player2` — get game state (player-specific view)
- `POST /api/games/:gameId/placements` — body: `{ "player", "placements" }` → `{ "ok": true }`
- `POST /api/games/:gameId/fire` — body: `{ "player", "row", "col" }` → `{ "hit", "sunkShipName?", "gameOver?", "state" }`
- `GET /api/history` — list completed games (moves, outcome, timestamps)

