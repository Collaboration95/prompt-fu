# Architecture

The game has three runtime pieces: a host browser, phone browsers, and one Node server. The hosted Site adds a small iframe shell.

## Gameplay and rooms

`game/index.html` owns the simulation. The host creates a room code and connects to `/ws?room=CODE&role=host`. Phones connect to the same room with `role=phone`. The server assigns phone identifiers and forwards their messages with a server-supplied `from` field.

Phones send movement and button state roughly every 50 milliseconds. The host sends fighter specs, round changes, wins, and feedback. A `to` field targets a particular phone; otherwise host messages are broadcast within the room. The server does not simulate or adjudicate the game.

Rooms are stored in a process-local map and removed when their last connection leaves. Closing the host stops authoritative gameplay. The room code is a routing identifier, not an authentication credential.

## Generation

`POST /api/fighter` and `POST /api/arena` accept `{ "prompt": "..." }`. Prompts are bounded to 2,000 characters and request bodies to 8 KB. Generated objects are rebuilt from permitted fields and bounded strings; invalid colors and enums fall back to defaults.

The adapter runs Codex in a fresh temporary working directory, with a filtered environment and read-only sandbox options. It tries two fixed event model identifiers within a shared 40-second budget. Missing executables, timeouts, malformed output, and excess concurrency return deterministic SHA-256-derived specs. At most two generation requests run simultaneously.

`POST /api/awards` accepts match statistics and has a shorter seven-second budget. Its fallback response has an empty awards list; the host already has local award text.

The server does not require an API key in source or browser code. The optional CLI uses the operator's existing authentication. This is not a multi-tenant inference service: authentication, abuse prevention and usage controls remain future work.

## Hosting

The Node process serves `game/` and accepts WebSocket upgrades on the same port. Its default bind address is loopback. `HOST` and `PORT` control the listener; use a reachable LAN address for phone play.

The hosted shell reads `/api/config`, converts the configured WebSocket address to the backend origin, and embeds its game page. The `sites-shell/` directory contains that shell and Worker source for reference. The Worker expects an injected `assets` table and hosted environment bindings; it is not a standalone build or deploy target in this repository.

The operator's frozen deployment directory and local deployment credentials are excluded from the public repository. Repository publication does not change the live Site or backend process.
