# Prompt Fu: generation contract (game ⇄ generator)

The game draws everything in code from these specs. A generator (Codex CLI) turns a player's prompt into one spec.
Unknown fields fall back to defaults, so specs must be plain JSON with no code.

## Fighter spec: `POST /api/fighter {prompt}` → JSON
```json
{
  "name": "Grumpy Durian",
  "body": { "shape": "round|egg|tall|blob|square|spiky", "color": "#9bc53d", "shade": "#6f9a2a",
            "belly": { "shape": "circle|oval|none", "color": "#f3e7a1" } },
  "top": { "kind": "leaf|stem|spikes|hat|bun|ears|none", "color": "#4a8f3a" },
  "face": { "eyes": "dot|happy|angry|sleepy", "blush": true },
  "accent": { "kind": "spots|stripes|seeds|none", "color": "#ffffff" },
  "weapon": { "kind": "boomerang|chopsticks|slipper|star|spoon", "color": "#c98a4b" },
  "catchphrase": "max 6 words"
}
```

## Arena theme spec: `POST /api/arena {prompt}` → JSON
The seed decides the layout deterministically. The theme only skins it.
```json
{ "name": "Hawker Night", "grass": "#bfe39a", "grass2": "#b2db8a", "sand": "#f1e3a6",
  "wall": "#a6a8e8", "wallSide": "#7c7ec9", "rock": "#9b9fd6", "tree": "#f0a24b", "tree2": "#e07b39",
  "decor": "trees|lanterns|crates|bamboo", "seed": "KOPI-42" }
```
