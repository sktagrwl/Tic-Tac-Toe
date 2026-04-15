# Tic Tac Toe

A multiplayer tic-tac-toe game built with React and [Nakama](https://heroiclabs.com/nakama/) as the game server.

## Prerequisites

- [pnpm](https://pnpm.io/) — install via `npm install -g pnpm`
- A running [Nakama server](https://heroiclabs.com/docs/nakama/getting-started/install/) (Docker recommended)

## Setup

```bash
cd client
pnpm install
```

Create a `client/.env` file with your Nakama server values:

```env
VITE_NAKAMA_HOST=
VITE_NAKAMA_PORT=
VITE_NAKAMA_SERVER_KEY=
VITE_NAKAMA_SSL=
```

See [Environment Variables](#environment-variables) below for what each value should be.

```bash
pnpm dev
```

The app runs at `http://localhost:5173`.

## Environment Variables

All `VITE_` variables are **bundled into the frontend build** and visible to anyone who inspects the browser bundle — treat them accordingly.

| Variable | Description | Safe to commit? |
|---|---|---|
| `VITE_NAKAMA_HOST` | Nakama server hostname or IP | Yes (non-prod) |
| `VITE_NAKAMA_PORT` | Nakama HTTP port (typically `7350`) | Yes |
| `VITE_NAKAMA_SSL` | `true` for HTTPS/WSS, `false` for local | Yes |
| `VITE_NAKAMA_SERVER_KEY` | Client key configured on your Nakama server | **No** — keep out of version control |

> `VITE_NAKAMA_SERVER_KEY` ships to every browser, but exposing a production key publicly lets anyone register accounts on your server. Use a strong, unique value in production.

## Building for Production

```bash
pnpm build      # outputs to client/dist/
pnpm preview    # serve the production build locally
```
