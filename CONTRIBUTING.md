# Working on Prompt Fu

Use Node 20+ and run `npm start`. Running the game needs no dependency installation or frontend build step.

Run `npm run check` and `npm test` before committing. The checks cover inline browser scripts, generation validation and fallbacks, static-file boundaries, and a host with two synthetic phone clients. They use a separate ephemeral port and never invoke a real AI service.

Install the optional browser-test dependencies and Chromium once:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

The browser tests start their own ephemeral server with AI disabled, join two touch-enabled phone sessions, send joystick/throw/dash input, and check that player text is not interpreted as HTML. Screenshots are written under ignored `test-results/`.

For gameplay or controller changes, also check a host plus two browser phone sessions. Use a 390 × 844 portrait viewport and an 844 × 390 landscape viewport. Join a room, move the joystick, throw, dash, disconnect, and reconnect. Check the console and capture a screenshot. Browser emulation does not establish physical-device or venue-network behavior.

Keep changes focused. Game code belongs in `game/`; do not edit, rebuild or redeploy the operator's frozen `site/` directory. `sites-shell/` is a reference copy, not a deployment pipeline. Never stop an existing game server to run a check; use `PORT=0` for an isolated test instance.

Keep credentials, deployment state, local research, private remarks, and runtime logs out of commits. Review the staged diff and file list before publishing. Use the authenticated `gh` CLI for GitHub access.

Explain the player-visible change, what you checked, and any remaining limitation in pull requests. Do not report synthetic clients as physical-phone testing.
