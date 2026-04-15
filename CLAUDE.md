# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Goal
Production-ready server-authoritative multiplayer Tic-Tac-Toe. All game logic lives on the server (Nakama Go plugin). The client only sends moves and renders state received from the server.

**Current status**: Phase 1 in progress. Auth (email/password) and the core match handler are implemented. The lobby, game page, stats, and most client services/hooks are not yet built.

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

Build the Go plugin (must be Linux shared library):
```bash
# From server/ — requires CGO and Linux target (use Docker on Mac)
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -buildmode=plugin -o tictactoe.so .
```

---

## Architecture

```
Browser (React 19)
  Pages (React Router v7) ↔ Zustand Stores ↔ Services (Nakama SDK wrappers)
                                                    ↕  HTTP REST + WebSocket
Nakama 3.25.0
  Go Plugin: authoritative match handler + RPC functions
  Built-in:  Matchmaker, Storage Engine
                                                    ↕  SQL
CockroachDB (schema managed by Nakama — no direct SQL from app code)
```

**Rule**: No game logic on the client. Client validates nothing — it only sends moves and renders the state the server broadcasts.

---

## File Map

Files marked *(planned)* do not exist yet — they are the next things to build.

### Server (Go) — `server/`
| File | Purpose |
|------|---------|
| `main.go` | `InitModule` — registers match handler + all RPCs |
| `match/opcodes.go` | All op-code and error-code integer constants |
| `match/state.go` | `MatchState` struct (`Board [9]string`), `CheckWinner()`, `IsBoardFull()`, helpers |
| `match/handler.go` | The 7 Nakama match interface methods (MatchInit → MatchTerminate) |
| `rpc/matchmake.go` | `RpcFindMatch` — creates or returns a match ID |
| `rpc/stats.go` | *(planned)* `RpcGetPlayerStats` — reads from Nakama Storage |
| `storage/player_stats.go` | *(planned)* `ReadStats`, `WriteStats`, `IncrementAfterGame` |

### Client (TypeScript) — `client/src/`
| Path | Purpose |
|------|---------|
| `types/game.ts` | `CellValue`, `Board`, `MatchPhase`, `MatchState`, `PlayerStats` |
| `types/nakama.ts` | `OpCode` consts + message payload types (mirrors Go op-codes) |
| `services/nakamaClient.ts` | Singleton `nakamaClient` (REST `Client`); socket creation is *(planned)* |
| `services/authService.ts` | `registerEmail()`, `loginEmail()`, `authenticateGoogle()` |
| `services/matchService.ts` | *(planned)* `createMatch`, `joinMatch`, `leaveMatch`, `sendMove`, `findMatch` |
| `services/statsService.ts` | *(planned)* `getStats()` |
| `stores/authStore.ts` | Session, userId, username, email, isAuthenticated — persisted to localStorage (key: `ttt_auth`) |
| `stores/gameStore.ts` | *(planned)* Board, phase, players, winner — NOT persisted (server owns state) |
| `stores/statsStore.ts` | *(planned)* Wins/losses/draws/streak — NOT persisted (always fetch fresh) |
| `hooks/useNakamaSocket.ts` | *(planned)* Connect socket, wire `onmatchdata` → `gameStore` |
| `hooks/useMatchmaking.ts` | *(planned)* Create/join/auto-matchmake + loading state |
| `hooks/useGameActions.ts` | *(planned)* `sendMove`, `leaveMatch` convenience wrappers |
| `components/ui/` | *(planned)* Button, Modal, Spinner, StatusBadge |
| `components/game/` | *(planned)* Board, Cell, PlayerBar, GameStatus, WinnerOverlay |
| `components/lobby/` | *(planned)* LobbyActions, JoinRoomModal |
| `pages/SplashPage.tsx` | Email/password login + register form; redirects to /lobby on success |
| `pages/LobbyPage.tsx` | *(planned)* Quick Match / Create Room / Join by ID |
| `pages/GamePage.tsx` | *(planned)* Live game, reads gameStore |
| `pages/StatsPage.tsx` | *(planned)* Personal stats display |
| `utils/boardUtils.ts` | *(planned)* Client-side `checkWinner` (display only, not authoritative) |
| `utils/constants.ts` | *(planned)* `BOARD_SIZE`, Nakama collection names |

---

## Data Models

### TypeScript `types/game.ts`
```typescript
export type CellValue = 'X' | 'O' | '';
export type Board = [CellValue, CellValue, CellValue,
                     CellValue, CellValue, CellValue,
                     CellValue, CellValue, CellValue]; // flat index 0–8
export type WinLine = [number, number, number] | null;
export type MatchPhase = 'waiting' | 'playing' | 'finished';

export interface MatchPlayer {
  userId: string; username: string;
  symbol: 'X' | 'O'; presence: boolean;
}
export interface MatchState {
  board: Board; phase: MatchPhase; currentTurn: string;
  players: MatchPlayer[]; winner: string | null;
  winLine: WinLine; moveCount: number;
}
export interface PlayerStats {
  userId: string; wins: number; losses: number; draws: number;
  winStreak: number; bestWinStreak: number; totalGames: number;
}
```

### Op-codes — must be identical in Go (`match/opcodes.go`) and TypeScript (`types/nakama.ts`)
```
1 = MOVE (client→server)    2 = STATE_UPDATE (server→client)
3 = GAME_OVER               4 = PLAYER_JOIN    5 = PLAYER_LEAVE
99 = ERROR
```

---

## Match State Machine
```
WAITING (0–1 players)
  → 2nd player joins → PLAYING (X always goes first)
     → valid move, no winner  → advance turn → PLAYING
     → valid move, winner     → FINISHED → persist stats
     → board full, no winner  → FINISHED (draw) → persist stats
     → player disconnects     → opponent wins by forfeit → FINISHED → persist stats
```

**MatchLoop move validation order** (reject early with OpError):
1. `phase == playing`
2. `msg.UserID == currentTurn`
3. `position 0–8 and board[pos] == ""`

---

## Router Structure
```
/               → SplashPage      (email/password login + register form, redirects to /lobby on success)
/lobby          → LobbyPage       (RequireAuth guard)
/game/:matchId  → GamePage        (RequireAuth guard)
/stats          → StatsPage       (RequireAuth guard)
*               → redirect to /
```

---

## Zustand Stores
- **authStore** — persisted to localStorage (key: `ttt_auth`); persists `session` (token + refresh_token only via `partialize`), `userId`, `username`, `email`, `isAuthenticated`
- **gameStore** — *(planned)* NOT persisted; server is the source of truth; reconnect re-syncs from server
- **statsStore** — *(planned)* NOT persisted; always fetch fresh after each game

---

## Critical Nakama SDK Rules
1. `Client` (REST) ≠ `Socket` (WebSocket). `nakamaClient` in `nakamaClient.ts` is the REST client. Socket must be created separately after auth before joining any match.
2. `socket.onmatchdata` is the **only** inbound real-time channel. Route by `data.op_code`.
3. Decode match data: `JSON.parse(new TextDecoder().decode(data.data))`
4. Always get a match ID from the `find_match` RPC — never call `socket.createMatch()` directly from the UI.
5. Go plugin must compile as a Linux shared library. Use Docker when building on Mac.
6. Auth uses email/password via `nakamaClient.authenticateEmail()`. Google OAuth is also supported. There is no device auth.

---

## Deployment
| Layer | Target | Notes |
|-------|--------|-------|
| Frontend | Vercel / Netlify | Build: `cd client && pnpm build`, output: `client/dist` |
| Nakama | Fly.io / Railway | nakama:3.25.0 image + compiled `tictactoe.so` baked in |
| Database | CockroachDB Serverless | Free tier, managed by Nakama (no schema work needed) |

Production env vars (set in Vercel dashboard, not in repo):
`VITE_NAKAMA_HOST`, `VITE_NAKAMA_PORT=443`, `VITE_NAKAMA_SSL=true`, `VITE_NAKAMA_SERVER_KEY`

---

## Phased Roadmap
| Phase | Goal |
|-------|------|
| 1 | Two players auth → join match → play → see winner (end-to-end working game) |
| 2 | Matchmaking (Quick Match) + persistent player stats |
| 3 | Disconnect handling + forfeit + client reconnect |
| 4 | Timer mode (30s/turn, auto-forfeit, countdown UI) |
| 5 | Cloud deployment (Fly.io + Vercel) |
