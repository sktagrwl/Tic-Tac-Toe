# OXO — Real-Time Multiplayer Tic Tac Toe

A production-grade multiplayer Tic Tac Toe game with server-authoritative game logic, room codes, real-time WebSocket play, player stats, and game history.

**Stack:** React 19 + Zustand · Nakama game server · Supabase (PostgreSQL) · Vercel (frontend) · Railway (backend)

---

## Features

- **Room codes** — create a 5-character room and share the code with a friend
- **Browse Rooms** — see open rooms and join with one click
- **Quick Match** — auto-pair with any available player
- **Real-time play** — moves sync instantly over WebSocket; no polling
- **Rematch** — both players can request a rematch after a game ends
- **Forfeit on disconnect** — opponent wins automatically if you leave mid-game
- **Stats & history** — win/loss/draw totals, win streaks, and a paginated game history
- **Google OAuth + email/password** auth

---

## Architecture

```
Browser (React + Zustand)
       │  HTTP REST + WebSocket (WSS)
       ▼
Nakama Game Server  (Railway)
  ├── Go plugin: all game logic, matchmaking, room codes
  └── Built-in storage, sessions, leaderboards
       │  PostgreSQL
       ▼
Supabase  (managed Postgres 17)
```

All game logic runs server-side in the Go plugin. The client only sends moves and renders what the server broadcasts — no client-side validation.

---

## Local Development

### Prerequisites

- [Docker](https://www.docker.com/) — runs Nakama locally
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- [Go 1.23+](https://go.dev/) — only needed if modifying the server plugin

### 1. Start the backend

```bash
docker compose up   # from project root
```

The `plugin-builder` service compiles the Go plugin before Nakama starts. First run downloads images and may take a few minutes. Nakama will be available at `http://localhost:7350`.

### 2. Install and start the frontend

```bash
cd client
pnpm install
pnpm dev          # http://localhost:5173
```

### 3. Environment variables

Create `client/.env`:

```env
VITE_NAKAMA_HOST=localhost
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
VITE_GOOGLE_CLIENT_ID=        # optional for local dev
```

### Frontend commands

```bash
pnpm dev        # dev server
pnpm build      # type-check + production build → client/dist/
pnpm lint       # ESLint
pnpm preview    # serve production build locally
```

### Building the Go plugin manually

The plugin must compile as a Linux shared library (even on Mac — Docker handles this):

```bash
# From server/
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -buildmode=plugin -o backend.so .
```

The `server/` directory mounts into Nakama at `/nakama/data/modules`.

---

## Deployment

### 1. Supabase (Database)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Settings → Database → Connection String** and copy the **Session Pooler** URI (port 5432):
   ```
   postgresql://postgres.<PROJECT_REF>:<PASSWORD>@<POOLER_HOST>:5432/postgres
   ```
   > Use Session Pooler specifically — Transaction Pooler resets connections between transactions which breaks Nakama, and the Direct Connection uses IPv6 which Railway cannot resolve.
3. Nakama creates all required tables automatically on first boot. No schema setup needed.

### 2. Railway (Nakama server)

1. Create a project at [railway.app](https://railway.app) and deploy the Nakama Docker image.
2. Set these environment variables:

   | Variable | Value |
   |----------|-------|
   | `NAKAMA_DATABASE_ADDRESS` | Session Pooler URI from Supabase (with `?sslmode=require` appended) |
   | `NAKAMA_SERVER_KEY` | A strong random key |
   | `PORT` | `7350` |

3. Enable **Public Networking** under Settings → Networking. Railway assigns a domain like `your-app.up.railway.app`.

4. Confirm startup in deploy logs — Nakama will log successful DB migration and plugin load.

### 3. Vercel (Frontend)

1. Import the repository at [vercel.com](https://vercel.com). The `vercel.json` at the project root handles the build config.
2. Set these environment variables:

   | Variable | Value |
   |----------|-------|
   | `VITE_NAKAMA_HOST` | Your Railway domain (e.g. `your-app.up.railway.app`) |
   | `VITE_NAKAMA_PORT` | `443` |
   | `VITE_NAKAMA_SSL` | `true` |
   | `VITE_NAKAMA_SERVER_KEY` | Same key as `NAKAMA_SERVER_KEY` on Railway |
   | `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth 2.0 Client ID |

### 4. Google OAuth

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add your Vercel domain to **Authorized JavaScript Origins** (no trailing slash, `https://`).
4. The same Client ID goes into:
   - Vercel env var `VITE_GOOGLE_CLIENT_ID`
   - `nakama-config.yml` → `social.google.client_id`

> **`origin_mismatch` error?** The domain in your browser doesn't match the Authorized Origins list. Double-check the exact URL (no trailing slash) and wait up to 5 minutes for Google's changes to propagate. Test in incognito.

---

## Project Structure

```
├── client/               # React frontend (Vite + TypeScript)
│   └── src/
│       ├── pages/        # SplashPage, LobbyPage, GamePage, StatsPage, ProfilePage
│       ├── components/   # Navbar, Board, Cell, GameStatus
│       ├── stores/       # Zustand: authStore, gameStore, statsStore
│       ├── services/     # Nakama SDK wrappers: auth, match, stats
│       ├── hooks/        # useNakamaSocket — singleton WebSocket manager
│       └── types/        # Shared types mirroring Go structs
│
├── server/               # Go plugin (Nakama authoritative match handler)
│   ├── main.go           # Plugin entry — registers match handler + RPCs
│   ├── match/            # Game state, op-codes, match lifecycle
│   ├── rpc/              # matchmake, join_by_code, list_rooms, game_history
│   └── storage/          # player_stats, game_history, room_codes, room_host
│
├── docker-compose.yml    # Local dev: Nakama + plugin builder
└── nakama-config.yml     # Nakama config (Google OAuth client ID)
```

---

## How It Works

### Match flow

1. Player A clicks **Create Room** → server generates a 5-char code and creates a match
2. Player A shares the code; the room appears in Browse Rooms
3. Player B enters the code (or clicks the room) → server resolves code → matchId
4. Both navigate to `/game/:code` and connect via WebSocket
5. Server broadcasts all state changes; client only renders what it receives
6. On game end, stats are updated server-side for both players

### Server-authoritative design

Move validation order (server rejects early if any check fails):
1. Game phase is `PLAYING`
2. Sender is the current turn's player
3. Cell index is 0–8 and currently empty

### Go ↔ TypeScript contract

These two file pairs must stay in sync when adding new op-codes or state fields:
- `server/match/opcodes.go` ↔ `client/src/types/nakama.ts`
- `server/match/state.go` ↔ `client/src/types/game.ts`

---

## Security Notes

- Set a strong `NAKAMA_SERVER_KEY` on Railway (not `defaultkey`).
- Reset your Supabase database password if it was ever shared or committed.
- Change the Nakama console default credentials (`admin` / `password`) after first deploy.
- Keep `VITE_NAKAMA_SERVER_KEY` consistent with the Railway value — it's bundled into the browser build.
- Remove unused domains from Google OAuth Authorized Origins.
