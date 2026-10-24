# Game artwork

These PNGs come from Prompt Fu's existing Canvas renderer. They retain the game's original characters, proportions, colors and expressions.

- `vock`, `donny`, `shari`, `greg`: the four default fighter specs in [`game/js/characters.js`](../../game/js/characters.js), captured in their idle and happy poses.
- `boomerang`: the existing weapon renderer in the same file.
- `arena-*`: the game canvas using the Desert, Autumn Dojo and Candy Land presets with the `SNACK-42` seed. Presets and layout generation live in [`game/js/arena.js`](../../game/js/arena.js).

The screenshots under `../images/` show the local game and controller. The architecture graphic and slide previews come from editable HTML. After changing that HTML, run `node scripts/render-showcase.mjs` from the repository root with Playwright and Chromium installed to refresh the previews.

The README follows the presentation structure of [Common Grounds Makeathon](https://github.com/Collaboration95/common-grounds-makeathon). Its characters and venue artwork are not included here.
