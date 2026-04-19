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

### Match flow (Room Codes)
1. LobbyPage → `find_match` RPC → server creates match + 5-char alphanumeric code → returns `{code}`
2. Creator sees code and can share it; room appears in Browse Rooms until second player joins
3. Joiner enters code in "Join by Code" or clicks a room in Browse Rooms → `join_by_code` RPC resolves code → matchId
4. Both navigate to `/game/:code` (URL carries the short code, not the raw matchId)
5. GamePage calls `joinMatch(code)` → `join_by_code` RPC to get matchId → `socket.joinMatch(matchId)` via `waitForSocket()`
6. `MatchJoin` (first player): sets match label to `"open"` + writes room host record for discovery
7. `MatchJoin` (second player): clears label to `""` (removes from Browse Rooms) + deletes host record
8. All game state flows from server via `socket.onmatchdata` → `useNakamaSocket` → `applyStateUpdate` → `gameStore`
9. Moves: `sendMove` → `socket.sendMatchState(matchId, OpCode.MOVE, payload)`
10. On game over: server calls `UpdateMatchStats()` — updates `player_stats` and writes a `game_history` entry for both players

---

## File Map

### Server (Go) — `server/`
| File | Purpose |
|------|---------|
| `main.go` | `InitModule` — registers match handler + all RPC functions |
| `match/opcodes.go` | Op-code and error-code integer constants |
| `match/state.go` | `MatchState` struct, `CheckWinner()`, `IsBoardFull()`, `SymbolForUser()`, `OtherPlayerID()` |
| `match/handler.go` | The 7 Nakama match lifecycle methods (MatchInit → MatchTerminate) |
| `rpc/matchmake.go` | `RpcFindMatch`, `RpcQuickMatch`, `RpcJoinByCode`, `RpcListRooms` |
| `rpc/get_game_history.go` | `RpcGetGameHistory` — paginated game history for the current user |
| `storage/player_stats.go` | `PlayerStats` read/write; `UpdateMatchStats()` called after every game |
| `storage/game_history.go` | `GameHistoryEntry` write + read helpers; reverse-timestamp keying |
| `storage/room_codes.go` | 5-char code generation; bidirectional code↔matchId storage with retry |
| `storage/room_host.go` | Host record write/delete used by Browse Rooms discovery |

### Client (TypeScript) — `client/src/`
| Path | Purpose |
|------|---------|
| `types/game.ts` | `CellValue`, `Board`, `MatchPhase`, `MatchState`, `PlayerStats`, `GameHistoryEntry` |
| `types/nakama.ts` | `OpCode` consts + payload types (must mirror Go op-codes) |
| `services/nakamaClient.ts` | Singleton `nakamaClient` REST client; socket created via `nakamaClient.createSocket()` |
| `services/authService.ts` | `registerEmail()`, `loginEmail()`, `authenticateGoogle()` |
| `services/matchService.ts` | `findMatch`, `joinMatch`, `leaveMatch`, `sendMove`, `joinByCode` |
| `services/statsService.ts` | `getStats()`, `getGameHistory({cursor, limit})` RPC wrappers |
| `stores/authStore.ts` | Session, userId, username, email, isAuthenticated — persisted to localStorage |
| `stores/gameStore.ts` | Board, phase, players, winner, winLine — NOT persisted; server is source of truth |
| `stores/statsStore.ts` | Aggregate stats + game history entries + pagination cursor |
| `hooks/useNakamaSocket.ts` | App-level socket singleton; routes `onmatchdata` → `gameStore` |
| `components/Navbar.tsx` | Top bar: logo/back button on left, user avatar dropdown (Stats, Profile, Sign Out) on right |
| `components/game/Board.tsx` | 3×3 grid; highlights winning cells from `winLine` |
| `components/game/Cell.tsx` | Individual cell button |
| `components/game/GameStatus.tsx` | Turn/winner/draw status message |
| `pages/SplashPage.tsx` | Email/password login + register form → redirects to /lobby |
| `pages/LobbyPage.tsx` | Create Room (5-char code), Join by Code, Browse Rooms (open rooms with host stats hover), Quick Match |
| `pages/GamePage.tsx` | Live game; resolves code → matchId on mount, leaves on unmount |
| `pages/StatsPage.tsx` | Left: aggregate stats + win rate bar; Right: paginated game history |
| `pages/ProfilePage.tsx` | Update username via `nakamaClient.updateAccount()`, sign out |

---

## Data Models

### Op-codes — must be identical in Go (`match/opcodes.go`) and TypeScript (`types/nakama.ts`)
```
1 = MOVE (client→server)    2 = STATE_UPDATE (server→client)
3 = GAME_OVER               4 = PLAYER_JOIN    5 = PLAYER_LEAVE
6 = REMATCH                 7 = REMATCH_REQUEST
8 = REMATCH_DECLINE         99 = ERROR
```

Rematch flow: client sends `REMATCH_REQUEST` (7) → server relays to opponent. Opponent sends `REMATCH` (6) to accept (server creates new match, broadcasts code to both) or `REMATCH_DECLINE` (8) to decline. If both send `REMATCH_REQUEST` simultaneously it is treated as mutual accept.

### Nakama Storage Collections
| Collection | Key | Owner | Purpose |
|------------|-----|-------|---------|
| `player_stats` | `stats` | user | Wins, losses, draws, streaks, totalGames |
| `game_history` | reverse-timestamp | user | Per-game result entries (newest first) |
| `room_codes` | 5-char code | system | code → matchId lookup |
| `room_match_codes` | matchId | system | matchId → code reverse lookup (for rematch) |
| `room_hosts` | matchId | system | hostId + hostName; deleted when game starts or host leaves |

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
/               → LobbyPage      (public; shows lobby UI or prompts sign-in)
/login          → SplashPage     (public; email/password login + register)
/lobby          → LobbyPage      (RequireAuth guard)
/game/:code     → GamePage       (RequireAuth; :code is the 5-char room code)
/stats          → StatsPage      (RequireAuth)
/profile        → ProfilePage    (RequireAuth)
*               → redirect to /
```

## RPC Endpoints
| RPC | Payload | Returns | Purpose |
|-----|---------|---------|---------|
| `find_match` | — | `{code}` | Create private room with 5-char code |
| `quick_match` | — | `{matchId}` | Find or create a public quick-match room |
| `join_by_code` | `{code}` | `{matchId}` | Resolve a room code to a match ID |
| `list_rooms` | — | `[{code, hostName, hostId, stats}]` | All open private rooms for Browse Rooms |
| `get_stats` | — | `PlayerStats` | Aggregate stats for the current user |
| `get_game_history` | `{cursor, limit}` | `{entries, cursor, hasMore}` | Paginated game history (default limit 10, max 50) |

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
| 1 | Two players auth → join match → play → see winner | Complete |
| 2 | Room codes, Quick Match, persistent stats + game history, Browse Rooms, rematch flow | Complete |
| 3 | Disconnect handling + forfeit + client reconnect | Planned |
| 4 | Timer mode (30s/turn, auto-forfeit, countdown UI) | Planned |
| 5 | Cloud deployment (Fly.io + Vercel) | Planned |
