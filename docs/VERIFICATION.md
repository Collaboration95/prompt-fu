# Initial publication checks — 25 October 2026

All runtime checks below used isolated local servers. The existing hosted game and tunnel were not restarted or redeployed.

| Command / check | Result | Evidence boundary |
| --- | --- | --- |
| `npm ci` | Passed; dependency audit reported zero vulnerabilities | Local lockfile installation |
| `npm run check` | Passed; 11 scripts, including inline browser code | Syntax only |
| `npm test` | 9 passed | Synthetic CLI failure, HTTP validation and a real local WebSocket relay |
| `npm run test:browser` | 2 passed | Chromium: one host and two emulated touch phones |

Browser coverage: joining, joystick movement, neutral input after touch release, throw, dash, slot release on disconnect, HTML-like room codes and player/generated names, and portrait/landscape controls. Screenshots in `docs/images/` come from the local browser run.

## Failures encountered and resolved

- The relay disconnect test initially timed out. The server listened for socket close/error but not TCP end. Handling end now clears the phone connection; the same test passes.
- Player-provided names and generated text were inserted into several host HTML templates without escaping. They now render as text, including arena confirmation, fighter previews, HUD, banners, versus cards and room labels. The browser regression passed.
- The collaborative preview timed out twice. Checks continued in standalone Playwright.
- The first Playwright launch ran before its Chromium download finished. After installation, browser tests ran.
- Chromium refused a viewport resize while the phone was fullscreen. The test now exits fullscreen before checking landscape layout.

The original two commits and the staged public snapshot were scanned with `gitleaks` in redacted mode; neither scan reported credentials. The public file list was checked for local paths and machine-specific deployment identifiers. A before/after hash comparison confirmed the frozen deployment directory was unchanged.

The source checkout and its history remain local. Public publication uses a clean checkout containing selected game sources, reference shell files, docs and tests; local research, deployment state and credentials are excluded.

Not established by these checks: physical phones, venue Wi-Fi, production load, live AI generation, or hosted endpoint availability. CI results must be read from the exact GitHub commit; local success does not imply remote CI success.

Next action: test one host plus two physical phones, then work through the [roadmap](ROADMAP.md).
