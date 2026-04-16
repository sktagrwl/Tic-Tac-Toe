# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Goal
Production-ready server-authoritative multiplayer Tic-Tac-Toe. All game logic lives on the server (Nakama Go plugin). The client only sends moves and renders state received from the server.

**Rule**: No game logic on the client. Client validates nothing — it only sends moves and renders the state the server broadcasts.

---

## Commands

All frontend commands run from `client/`:

```bash
pnpm dev        # dev server at localhost:5173
pnpm build      # type-check + production build → client/dist/
pnpm lint       # ESLint
pnpm preview    # serve production build locally
```

Start the full local backend (Nakama + CockroachDB):
```bash
docker compose up   # from project root
```

The `plugin-builder` service compiles the Go plugin before Nakama starts (`condition: service_completed_successfully`). On first run this downloads images and may take a few minutes.

Build the Go plugin manually (must be Linux shared library):
```bash
# From server/ — requires CGO and Linux target (use Docker on Mac)
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -buildmode=plugin -o backend.so .
```

> The plugin output is `backend.so` (not `tictactoe.so`). The `server/` directory is mounted into Nakama at `/nakama/data/modules`.

---

## Architecture

```
Browser (React 19)
  Pages (React Router v7) ↔ Zustand Stores ↔ Services (Nakama SDK wrappers)
                                                    ↕  HTTP REST + WebSocket
Nakama 3.25.0
  Go Plugin: authoritative match handler + RPC functions
  Built-in:  Storage Engine
                                                    ↕  SQL
CockroachDB (schema managed by Nakama — no direct SQL from app code)
```

---

## Key Design Decisions

### Go ↔ TypeScript contract
These two files must stay in sync — any change to one requires a change to the other:
- `server/match/opcodes.go` ↔ `client/src/types/nakama.ts`
- `server/match/state.go` ↔ `client/src/types/game.ts`

**WinLine**: Go sends `[3]int` with `[-1,-1,-1]` for no winner (never `null`). TypeScript `WinLine = [number, number, number] | null`. The gameStore's `applyStateUpdate` must convert `[-1,-1,-1]` → `null` before storing, or Board.tsx's `winLine ? new Set(winLine)` check will always be truthy.

**Winner**: Go `Winner string` sends `""` for no winner, `"draw"` for a draw, or the winning userId. TypeScript `winner: string | null` in gameStore — `applyStateUpdate` converts `""` → `null`.

### Socket lifecycle
`useNakamaSocket` (`hooks/useNakamaSocket.ts`) manages a **module-level singleton socket** — one connection for the entire app lifetime, shared across pages. It sets `isConnected = false` on both disconnect and connection failure, allowing reconnection. `matchService.ts` uses `waitForSocket()` (awaits the in-flight connect promise) before joining a match.

### Session persistence
`authStore` persists only `sessionToken` + `refreshToken` to localStorage (key: `ttt_auth`). On rehydration, `onRehydrateStorage` calls `Session.restore(token, refreshToken)` to reconstruct a real Nakama `Session` object — plain objects don't have the SDK methods the client needs.

### Match flow
1. LobbyPage calls `findMatch(session)` → RPC `find_match` → always creates a new match and returns its ID
2. Creator shares the match ID; joiner pastes it in "Join a Room"
3. Both navigate to `/game/:matchId`
4. GamePage calls `joinMatch(matchId)` → `socket.joinMatch()` via `waitForSocket()`
5. All game state flows from server via `socket.onmatchdata` → `useNakamaSocket` → `applyStateUpdate` → `gameStore`
6. Moves: `sendMove` → `socket.sendMatchState(matchId, OpCode.MOVE, payload)`

---

## File Map

### Server (Go) — `server/`
| File | Purpose |
|------|---------|
| `main.go` | `InitModule` — registers match handler + `find_match` RPC |
| `match/opcodes.go` | Op-code and error-code integer constants |
| `match/state.go` | `MatchState` struct, `CheckWinner()`, `IsBoardFull()`, `SymbolForUser()`, `OtherPlayerID()` |
| `match/handler.go` | The 7 Nakama match lifecycle methods (MatchInit → MatchTerminate) |
| `rpc/matchmake.go` | `RpcFindMatch` — creates a new match and returns `{"matchId": "..."}` |

### Client (TypeScript) — `client/src/`
| Path | Purpose |
|------|---------|
| `types/game.ts` | `CellValue`, `Board`, `MatchPhase`, `MatchState`, `PlayerStats` |
| `types/nakama.ts` | `OpCode` consts + payload types (must mirror Go op-codes) |
| `services/nakamaClient.ts` | Singleton `nakamaClient` REST client; socket created via `nakamaClient.createSocket()` |
| `services/authService.ts` | `registerEmail()`, `loginEmail()`, `authenticateGoogle()` |
| `services/matchService.ts` | `findMatch`, `joinMatch`, `leaveMatch`, `sendMove` |
| `stores/authStore.ts` | Session, userId, username, email, isAuthenticated — persisted to localStorage |
| `stores/gameStore.ts` | Board, phase, players, winner, winLine — NOT persisted; server is source of truth |
| `hooks/useNakamaSocket.ts` | App-level socket singleton; routes `onmatchdata` → `gameStore` |
| `components/game/Board.tsx` | 3×3 grid; highlights winning cells from `winLine` |
| `components/game/Cell.tsx` | Individual cell button |
| `components/game/GameStatus.tsx` | Turn/winner/draw status message |
| `pages/SplashPage.tsx` | Email/password login + register form → redirects to /lobby |
| `pages/LobbyPage.tsx` | Create room (shows shareable match ID) or join by match ID |
| `pages/GamePage.tsx` | Live game; joins match on mount, leaves on unmount |
| `pages/ProfilePage.tsx` | Update username via `nakamaClient.updateAccount()`, sign out |

---

## Data Models

### Op-codes — must be identical in Go (`match/opcodes.go`) and TypeScript (`types/nakama.ts`)
```
1 = MOVE (client→server)    2 = STATE_UPDATE (server→client)
3 = GAME_OVER               4 = PLAYER_JOIN    5 = PLAYER_LEAVE
99 = ERROR
```

### Match State Machine
```
WAITING (0–1 players)
  → 2nd player joins → PLAYING (X always goes first)
     → valid move, no winner  → advance turn → PLAYING
     → valid move, winner     → FINISHED → broadcast GAME_OVER
     → board full, no winner  → FINISHED (draw) → broadcast GAME_OVER
     → player disconnects     → opponent wins by forfeit → FINISHED → broadcast GAME_OVER
```

**MatchLoop move validation order** (reject early with OpError):
1. `phase == playing`
2. `msg.UserID == currentTurn`
3. `position 0–8 and board[pos] == ""`

---

## Router Structure
```
/               → SplashPage     (public; email/password login + register)
/lobby          → LobbyPage      (RequireAuth guard)
/game/:matchId  → GamePage       (RequireAuth guard)
/stats          → StatsPage      (placeholder, RequireAuth guard)
/profile        → ProfilePage    (RequireAuth guard)
*               → redirect to /
```

---

## Critical Nakama SDK Rules
1. `nakamaClient` (REST) ≠ Socket (WebSocket). The socket is created via `nakamaClient.createSocket()` and must be connected after auth before joining any match.
2. `socket.onmatchdata` is the **only** inbound real-time channel. Route by `data.op_code`.
3. Decode match data: `JSON.parse(new TextDecoder().decode(data.data))`
4. Always get a match ID from the `find_match` RPC — never create matches directly from the UI.
5. Go plugin must compile as a Linux shared library (`backend.so`). Use the Docker `plugin-builder` service on Mac.
6. Auth uses email/password via `nakamaClient.authenticateEmail()`. Google OAuth is also wired up (`authenticateGoogle`).

---

## Deployment
| Layer | Target | Notes |
|-------|--------|-------|
| Frontend | Vercel / Netlify | Build: `cd client && pnpm build`, output: `client/dist` |
| Nakama | Fly.io / Railway | nakama:3.25.0 image + compiled `backend.so` baked in |
| Database | CockroachDB Serverless | Free tier, managed by Nakama (no schema work needed) |

Production env vars (set in Vercel dashboard, not in repo):
`VITE_NAKAMA_HOST`, `VITE_NAKAMA_PORT=443`, `VITE_NAKAMA_SSL=true`, `VITE_NAKAMA_SERVER_KEY`, `VITE_GOOGLE_CLIENT_ID`

---

## Phased Roadmap
| Phase | Goal | Status |
|-------|------|--------|
| 1 | Two players auth → join match → play → see winner | In progress |
| 2 | Matchmaking (Quick Match) + persistent player stats | Planned |
| 3 | Disconnect handling + forfeit + client reconnect | Planned |
| 4 | Timer mode (30s/turn, auto-forfeit, countdown UI) | Planned |
| 5 | Cloud deployment (Fly.io + Vercel) | Planned |
