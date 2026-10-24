// Shared: seeded RNG + theme. Loaded first.
// ---------- Seeded RNG ----------
function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
function rng(seed) { let a = hash(seed)(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Default theme + fighters (same shape Codex returns, see CONTRACT.md) ----------
let THEME = { name: 'Autumn Dojo', grass: '#bfe39a', grass2: '#b3db8b', sand: '#f3e6ad', wall: '#a6a8e8', wallSide: '#7d7fca', rock: '#9ea2dc', tree: '#f3a64c', tree2: '#e2803b', decor: 'trees' };


// Player prompts, names and generated text must remain text in HTML templates.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
