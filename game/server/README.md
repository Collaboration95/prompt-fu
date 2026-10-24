# Prompt Fu server

Run from the repository root with `npm start` or `node game/server/server.mjs`. Requires Node 20+; all server dependencies are Node built-ins.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address; `0.0.0.0` allows LAN connections |
| `PORT` | `8790` | Listener port; `0` chooses a free port for checks |
| `CODEX_BIN` | `codex` | Optional generation CLI executable |

No environment file is loaded automatically. An installed, authenticated Codex CLI enables generation. If it is absent or fails, fighter and arena routes return deterministic specs with `fallback: true`. Awards return `{ "awards": [], "fallback": true }`.

| Route | Method | Purpose |
| --- | --- | --- |
| `/` | GET / HEAD | Host game |
| `/phone.html` | GET / HEAD | Phone controller |
| `/ws?room=CODE&role=host` | WebSocket | Host connection |
| `/ws?room=CODE&role=phone` | WebSocket | Phone connection |
| `/api/fighter` | POST | `{ "prompt": "dumpling ninja" }` → fighter spec |
| `/api/arena` | POST | `{ "prompt": "bamboo garden" }` → arena spec |
| `/api/awards` | POST | `{ "stats": [{ "name": "Toast", "wins": 3 }] }` → awards |

Generation responses include `x-generation-model` and `x-generation-ms` headers. Invalid prompt requests return HTTP 400; unsupported methods return HTTP 405. Dotfiles, server source, and files outside `game/` are not served.

The generator currently uses event-specific model identifiers and CLI options. It filters the child environment, passes prompt text through stdin, bounds captured output, and discards CLI stderr. See [architecture](../../docs/ARCHITECTURE.md) for budgets, concurrency and limitations, and [the contract](../CONTRACT.md) for spec fields.

`run-forever.sh` is an optional macOS helper that uses `caffeinate` and restarts a crashed server. It is not required for local play. Start it only when deliberately supervising your own instance; do not run a second copy on an occupied port.

Run `npm test` for isolated synthetic checks. A passing fallback test does not prove that live AI generation is available.
