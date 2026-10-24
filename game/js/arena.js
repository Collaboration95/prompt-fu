// Arena: seeded generation + rendering. Owner: arena agent.
// API: COLS, ROWS, T, WALL_H, grid (0 floor, >0 solid), spawns, powerSpots, decor, genArena(seed), drawFloor(g), drawBlock(x, y, kind), drawDecor(d). THEME is defined in core.js.
// Solid kinds: 1 stone wall, 2 big rock, 3 crate, 4 hedge block, 5 prop (jar, or lantern post if THEME.decor==='lanterns'),
//              7 centrepiece collision cell (draws nothing), 8 centrepiece (fountain/pond, drawn once), 9 standing stone.
// THEME fields: grass grass2 sand wall wallSide rock tree tree2 decor(trees|lanterns|crates|bamboo) + optional bush outside trunk crate jar water flowers night.
const COLS = 27, ROWS = 17, T = 56, WALL_H = 22;
// Kind 6 = walkable bush tile (hides fighters; rustles). Also exports inBush(x,y), rustleAt(x,y), updateLife(dt,fighters,rangs), drawLife(g).
const BG = ['#1e9b3c', '#2fb84d', '#5fd36b'], rustle = new Map();
let birds = [], flies = [], cat = null, leaves = [], lifeT = 0;
let grid, spawns, powerSpots, decor, arenaStyle, centreStyle, FD, floorCv, floorKey;
const OFF = 400, FS = 1.5;

// ---------- colour helpers ----------
const _cx = document.createElement('canvas').getContext('2d'), _memo = new Map();
function _rgb(c) { _cx.fillStyle = '#000'; _cx.fillStyle = c; const s = _cx.fillStyle; if (s[0] === '#') { const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; } return s.match(/[\d.]+/g).slice(0, 3).map(Number); }
function mix(a, b, t) { const k = a + '|' + b + '|' + t; let r = _memo.get(k); if (r) return r; const A = _rgb(a), B = _rgb(b); r = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); _memo.set(k, r); return r; }
const dark = (c, t) => mix(c, '#1a1430', t), lite = (c, t) => mix(c, '#ffffff', t);
const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
function PAL() {
  const t = THEME, grass = t.grass || '#bfe39a';
  return { grass, grass2: t.grass2 || dark(grass, .06), sand: t.sand || '#f3e6ad', wall: t.wall || '#a6a8e8', wallSide: t.wallSide || '#7d7fca', rock: t.rock || '#9ea2dc',
    tree: t.tree || '#f3a64c', tree2: t.tree2 || '#e2803b', bush: t.bush || mix(grass, '#2f9a52', .75), outside: t.outside || mix(grass, '#2c8a5a', .45),
    trunk: t.trunk || '#8a6a52', crate: t.crate || '#dba561', jar: t.jar || t.tree2 || '#e2803b', water: t.water || '#7fd6f2', night: !!t.night, mode: t.decor || 'trees',
    bushCols: (BG.splice(0, 3, ...(t.bushCols || ['#1e9b3c', '#2fb84d', '#5fd36b'])), 0), flowers: t.flowers || ['#ffffff', '#ffd86b', '#ff9bb8', '#c4b0ff'] };
}

// ---------- Arena generation: hand-authored templates (180deg rotational) + seeded mutations ----------
// Template rows 0-7 authored (27 wide), row 8 authored left half (mirrored), rows 9-16 are the 180deg rotation. Keys: # wall, o rock, c crate, h hedge, j prop.
const TEMPLATES = {
  maze: [
    '.......#........#..........',
    '.......#........#...######.',
    '.......#..####..#..........',
    '..####.#..#.........#......',
    '......................#.##.',
    '.##.####....#..#.....#.....',
    '.....#......#..#.....#.##..',
    '.o...#..###.#.......#......',
    '..#......#.........#...#..#'],
  courtyard: [
    '...........................',
    '..........hh......oo.......',
    '..##......hh......oo..##...',
    '..#......................#.',
    '.....oo......#####.....h...',
    '.....oo................h...',
    '..hh........##...##........',
    '..hh..............#........',
    '#.......#.............o.o..'],
  plaza: [
    '.......................#...',
    '...ccc....#####.....#..#...',
    '...ccc..........h...#......',
    '..........o........#..ccc..',
    '.##......ooo.....##....ccc.',
    '.#.....................#...',
    '.#..cc....#.........h......',
    '....cc....#####........oo..',
    '.o.......#.........c.c.....'],
  open: [
    '...........................',
    '..o.......###.......c......',
    '.........#...........##....',
    '.....c.....................',
    '..........o....#####.......',
    '...##...........#......h...',
    '...#..........j....c.......',
    '......h...##...............',
    '.o.........j.......##......']
};
function genArena(seed) {
  seed = String(seed);
  const R = rng(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const CX = Math.floor(COLS / 2), CY = Math.floor(ROWS / 2);
  const sp = [[2, 2], [COLS - 3, 2], [2, ROWS - 3], [COLS - 3, ROWS - 3]];
  const nearSpawn = (x, y) => sp.some(([a, b]) => Math.abs(x - a) <= 2 && Math.abs(y - b) <= 2);
  const inCentre = (x, y) => Math.abs(x - CX) <= 1 && Math.abs(y - CY) <= 1;
  const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const solidK = v => v > 0 && v !== 6;
  const names = Object.keys(TEMPLATES);
  arenaStyle = names[Math.floor(R() * names.length)];
  const half = TEMPLATES[arenaStyle].map(s => s.padEnd(COLS, '.').slice(0, COLS)), rows = half.slice(0, ROWS >> 1);
  const midr = half[ROWS >> 1].slice(0, CX + 1); rows.push(midr + midr.slice(0, CX).split('').reverse().join(''));
  for (let y = (ROWS >> 1) - 1; y >= 0; y--) rows.push(half[y].split('').reverse().join(''));
  const K = { '#': 1, o: 2, c: 3, h: 4, j: 5 };
  rows.forEach((s, y) => [...s].forEach((ch, x) => { if (K[ch] && !inCentre(x, y) && !nearSpawn(x, y)) grid[y][x] = K[ch]; }));
  // mutations (deliberately asymmetric): trim run ends, then add odd props
  const nb = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => inB(x + dx, y + dy) && grid[y + dy][x + dx] === 1).length;
  for (let n = ri(2, 4); n > 0; n--) { const ends = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === 1 && nb(x, y) <= 1) ends.push([x, y]); if (!ends.length) break; const [x, y] = ends[Math.floor(R() * ends.length)]; grid[y][x] = 0; }
  const clearAround = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if (inB(a, b) && (grid[b][a] || inCentre(a, b) || nearSpawn(a, b))) return false; } return true; };
  const place = (cells, kind) => { for (let t = 0; t < 40; t++) { const x = ri(1, COLS - 2), y = ri(1, ROWS - 2); if (cells.every(([dx, dy]) => inB(x + dx, y + dy) && clearAround(x + dx, y + dy))) { cells.forEach(([dx, dy]) => grid[y + dy][x + dx] = kind); return true; } } return false; };
  const line = (n, h) => Array.from({ length: n }, (_, i) => h ? [i, 0] : [0, i]);
  for (let n = ri(2, 4); n > 0; n--) { const w = R(); if (w < .35) place(line(ri(3, 5), R() < .5).concat(R() < .5 ? [[0, 1]] : []), 1); else if (w < .65) place([[0, 0], [1, 0], [0, 1]].slice(0, ri(2, 3)), 3); else if (w < .85) place([[0, 0]], 2); else place([[0, 0]], 5); }
  // centrepiece
  const cs = ['fountain', 'pond', 'henge', 'rock', 'none'][arenaStyle === 'plaza' ? ri(0, 1) : ri(0, 4)];
  centreStyle = cs;
  if (cs === 'fountain' || cs === 'pond') { [[0, 0], [-1, 0], [1, 0], [0, -1]].forEach(([dx, dy]) => grid[CY + dy][CX + dx] = 7); grid[CY + 1][CX] = 8; }
  else if (cs === 'henge') [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => grid[CY + dy][CX + dx] = 9);
  else if (cs === 'rock') grid[CY][CX] = 2;
  // reachability: open a gap (remove a wall tile) instead of filling pockets
  const flood = () => { const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false)), q = [sp[0]]; seen[sp[0][1]][sp[0][0]] = true;
    while (q.length) { const [x, y] = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const a = x + dx, b = y + dy; if (inB(a, b) && !seen[b][a] && !solidK(grid[b][a])) { seen[b][a] = true; q.push([a, b]); } }); } return seen; };
  for (let it = 0; it < 300; it++) {
    const seen = flood(); let pocket = false, opened = false;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!solidK(grid[y][x]) && !seen[y][x]) pocket = true;
    if (!pocket) break;
    outer: for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ([1, 2, 3, 4, 5].includes(grid[y][x])) {
      const ns = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => inB(x + dx, y + dy)).map(([dx, dy]) => [x + dx, y + dy]);
      if (ns.some(([a, b]) => seen[b][a]) && ns.some(([a, b]) => !solidK(grid[b][a]) && !seen[b][a])) { grid[y][x] = 0; opened = true; break outer; } }
    if (!opened) { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!solidK(grid[y][x]) && !seen[y][x]) grid[y][x] = 4; break; }
  }
  spawns = sp.map(([x, y]) => ({ x: (x + .5) * T, y: (y + .5) * T }));
  const pc = [[CX, 2], [CX, ROWS - 3], [5, CY], [COLS - 6, CY], [8, 5], [COLS - 9, ROWS - 6], [COLS - 9, 5], [8, ROWS - 6], [CX - 5, CY - 3], [CX + 5, CY + 3]];
  powerSpots = pc.filter(([x, y]) => grid[y][x] === 0).map(([x, y]) => ({ x: (x + .5) * T, y: (y + .5) * T }));
  const pset = new Set(pc.map(([x, y]) => x + ',' + y));
  // bush lobes (walkable, hide fighters): pattern chosen by seed
  { const B = rng(seed + '~bush'), bi = (a, b) => a + Math.floor(B() * (b - a + 1)), pat = bi(0, 2);
    const keep = (x, y) => inB(x, y) && grid[y][x] === 0 && !nearSpawn(x, y) && !inCentre(x, y) && !pset.has(x + ',' + y);
    const put = (x, y, rot) => { if (keep(x, y)) grid[y][x] = 6; if (rot && keep(COLS - 1 - x, ROWS - 1 - y)) grid[ROWS - 1 - y][COLS - 1 - x] = 6; };
    const rim = rot => { for (let x = 0; x < COLS;) { const len = bi(2, 4), dep = [0, 0, 1, 1, 2][bi(0, 4)]; for (let k = 0; k < len && x < COLS; k++, x++) for (let y = 0; y < dep; y++) put(x, y, rot); }
      for (let y = 0; y < ROWS;) { const len = bi(2, 4), dep = [0, 0, 1, 1, 2][bi(0, 4)]; for (let k = 0; k < len && y < ROWS; k++, y++) for (let x = 0; x < dep; x++) put(x, y, rot); } };
    const blob = (x, y, w, h, rot) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (B() < .85) put(x + dx, y + dy, rot); };
    if (pat === 0) rim(true); else if (pat === 1) { rim(false); blob(bi(6, COLS - 9), bi(1, 2), 3, 2, false); } else for (let n = bi(4, 6); n > 0; n--) blob(bi(1, COLS - 4), bi(0, ROWS - 3), bi(2, 4), bi(1, 3), B() < .4);
    for (let n = bi(1, 2); n > 0; n--) blob(bi(4, COLS - 6), bi(3, ROWS - 5), bi(2, 3), bi(1, 2), false); }

  // ----- cosmetic data (separate rng so layout stays stable) -----
  const F = rng(seed + '~floor'), W = COLS * T, H = ROWS * T;
  const solidAt = (x, y) => { const a = Math.floor(x / T), b = Math.floor(y / T); return grid[b] && grid[b][a] > 0; };
  FD = { outBlobs: [], blobs: [], sand: [], tufts: [], flowers: [], paving: [], bushes: [], plaza: cs !== 'none' };
  for (let i = 0; i < 70; i++) FD.outBlobs.push({ x: -OFF + F() * (W + 2 * OFF), y: -OFF + F() * (H + 2 * OFF), r: 30 + F() * 90, k: F() < .5 ? 0 : 1 });
  for (let i = 0; i < 45; i++) FD.blobs.push({ x: F() * W, y: F() * H, r: 40 + F() * 90, k: F() < .55 ? 0 : 1 });
  for (let i = 0; i < 6; i++) { const x = 40 + F() * (W - 80), y = 40 + F() * (H - 80), parts = []; for (let k = 0; k < 4; k++) parts.push([(F() - .5) * 70, (F() - .5) * 40, 28 + F() * 34, 18 + F() * 20]); const pb = []; for (let k = 0; k < 6; k++) pb.push([(F() - .5) * 90, (F() - .5) * 50, 1.5 + F() * 2]); FD.sand.push({ x, y, parts, pb }); }
  for (let i = 0; i < 130; i++) { const x = 12 + F() * (W - 24), y = 12 + F() * (H - 24); if (!solidAt(x, y)) FD.tufts.push({ x, y, s: .7 + F() * .6, k: F() < .3 }); }
  for (let i = 0; i < 55; i++) { const x = 16 + F() * (W - 32), y = 16 + F() * (H - 32); if (!solidAt(x, y)) FD.flowers.push({ x, y, c: Math.floor(F() * 4), n: 1 + Math.floor(F() * 3) }); }
  const mid = { x: W / 2, y: H / 2 };
  const stepTiles = (dx, dy, from, to) => { for (let d = from; d < to; d += 40) { const x = mid.x + dx * d + (F() - .5) * 6, y = mid.y + dy * d + (F() - .5) * 6; if (!solidAt(x, y) && x > 14 && y > 14 && x < W - 14 && y < H - 14) FD.paving.push({ x, y, w: 22 + F() * 6, h: 15 + F() * 5, r: (F() - .5) * .3 }); } };
  stepTiles(1, 0, 130, W / 2); stepTiles(-1, 0, 130, W / 2); stepTiles(0, 1, 110, H / 2); stepTiles(0, -1, 110, H / 2);
  // bush border: two staggered layers, sorted back to front
  const bs = 38, add = (x, y, r, back) => FD.bushes.push({ x: x + (F() - .5) * 6, y: y + (F() - .5) * 6, r: r * (.9 + F() * .2), back, fl: F() < .22, v: F() });
  for (let x = -20; x <= W + 20; x += bs) { add(x, -26, 30, 0); add(x + bs / 2, -48, 33, 1); add(x, H + 26, 30, 0); add(x + bs / 2, H + 46, 33, 1); }
  for (let y = 10; y <= H - 10; y += bs) { add(-26, y, 30, 0); add(-48, y + bs / 2, 33, 1); add(W + 26, y, 30, 0); add(W + 48, y + bs / 2, 33, 1); }
  FD.bushes.sort((a, b) => a.y - b.y || b.back - a.back);
  // outside trees / rocks / props, kept clear of the arena
  decor = [];
  for (let i = 0; i < 46; i++) {
    const side = Math.floor(F() * 4), t = F(), d = 85 + F() * 70;
    let x, y;
    if (side < 2) { x = -90 + t * (W + 180); y = side === 0 ? -d : H + d - 10; } else { y = -60 + t * (H + 120); x = side === 2 ? -d - 10 : W + d + 10; }
    decor.push({ x, y, kind: F() < .68 ? 'tree' : 'rock', s: .85 + F() * .5, v: F() });
  }
  floorKey = null; rustle.clear(); leaves = []; initLife(seed);
}

// ---------- shared drawing bits ----------
function lobe(c, x, y, r, col) { c.fillStyle = dark(col, .22); c.beginPath(); c.arc(x, y + r * .12, r, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y - r * .04, r * .93, 0, 7); c.fill(); c.fillStyle = lite(col, .22); c.beginPath(); c.ellipse(x - r * .2, y - r * .38, r * .55, r * .36, -.3, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(x - r * .38, y - r * .55, r * .2, r * .11, -.5, 0, 7); c.fill(); }
function flower(c, x, y, col, s) { c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 2.6 * s, 2 * s, 0, 7); c.fill(); } c.fillStyle = '#ffb627'; c.beginPath(); c.arc(x, y, 1.6 * s, 0, 7); c.fill(); }
const shadow = (c, x, y, rx, ry, a = .16) => { c.fillStyle = `rgba(30,35,70,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };

function buildFloor() {
  const p = PAL(), W = COLS * T, H = ROWS * T;
  floorCv = floorCv || document.createElement('canvas'); floorCv.width = (W + 2 * OFF) * FS; floorCv.height = (H + 2 * OFF) * FS;
  const c = floorCv.getContext('2d'); c.setTransform(FS, 0, 0, FS, OFF * FS, OFF * FS);
  c.fillStyle = p.outside; c.fillRect(-OFF, -OFF, W + 2 * OFF, H + 2 * OFF);
  c.globalAlpha = .35; FD.outBlobs.forEach(b => { c.fillStyle = b.k ? lite(p.outside, .08) : dark(p.outside, .1); c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); }); c.globalAlpha = 1;
  c.fillStyle = dark(p.grass, .15); c.beginPath(); c.roundRect(-14, -8, W + 28, H + 28, 34); c.fill(); // soft edge shadow
  c.fillStyle = p.grass; c.beginPath(); c.roundRect(-14, -14, W + 28, H + 28, 34); c.fill();
  c.save(); c.beginPath(); c.roundRect(-14, -14, W + 28, H + 28, 34); c.clip();
  c.globalAlpha = .45; FD.blobs.forEach(b => { c.fillStyle = b.k ? lite(p.grass, .13) : p.grass2; c.beginPath(); c.ellipse(b.x, b.y, b.r, b.r * .75, 0, 0, 7); c.fill(); }); c.globalAlpha = 1;
  // sand patches
  FD.sand.forEach(s => { c.fillStyle = dark(p.sand, .06); s.parts.forEach(([dx, dy, rx, ry]) => { c.beginPath(); c.ellipse(s.x + dx, s.y + dy + 3, rx, ry, 0, 0, 7); c.fill(); }); c.fillStyle = p.sand; s.parts.forEach(([dx, dy, rx, ry]) => { c.beginPath(); c.ellipse(s.x + dx, s.y + dy, rx, ry, 0, 0, 7); c.fill(); }); c.fillStyle = dark(p.sand, .14); s.pb.forEach(([dx, dy, r]) => { c.beginPath(); c.ellipse(s.x + dx, s.y + dy, r * 1.4, r, 0, 0, 7); c.fill(); }); });
  // plaza around the centrepiece
  if (FD.plaza) { const cx = W / 2, cy = H / 2, st = mix(p.sand, p.rock, .3); c.fillStyle = dark(st, .1); c.beginPath(); c.ellipse(cx, cy + 4, 128, 118, 0, 0, 7); c.fill(); c.save(); c.beginPath(); c.ellipse(cx, cy, 126, 114, 0, 0, 7); c.clip(); c.fillStyle = st; c.fillRect(cx - 130, cy - 120, 260, 240);
    for (let gy = -5; gy <= 5; gy++) for (let gx = -6; gx <= 6; gx++) { const x = cx + gx * 22 + (gy & 1) * 11, y = cy + gy * 21; c.fillStyle = hh(gx, gy) < .5 ? lite(st, .1) : dark(st, .05); c.beginPath(); c.roundRect(x - 10, y - 9, 20, 18, 5); c.fill(); } c.restore(); }
  FD.paving.forEach(t => { c.save(); c.translate(t.x, t.y); c.rotate(t.r); c.fillStyle = dark(p.sand, .2); c.beginPath(); c.roundRect(-t.w / 2, -t.h / 2 + 3, t.w, t.h, 6); c.fill(); c.fillStyle = mix(p.sand, p.rock, .25); c.beginPath(); c.roundRect(-t.w / 2, -t.h / 2, t.w, t.h, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.roundRect(-t.w / 2 + 3, -t.h / 2 + 2, t.w * .5, 3, 1.5); c.fill(); c.restore(); });
  // tufts + flowers
  c.lineCap = 'round'; FD.tufts.forEach(t => { c.strokeStyle = t.k ? lite(p.grass, .25) : dark(p.grass, .16); c.lineWidth = 2.4 * t.s; c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(t.x + i * 4 * t.s, t.y); c.lineTo(t.x + i * 7 * t.s, t.y - 9 * t.s + Math.abs(i) * 3); } c.stroke(); });
  FD.flowers.forEach(f => { for (let i = 0; i < f.n; i++) flower(c, f.x + i * 9, f.y + (i % 2) * 5, p.flowers[(f.c + i) % p.flowers.length], 1); });
  c.setLineDash([14, 10]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.roundRect(10, 10, W - 20, H - 20, 20); c.stroke(); c.setLineDash([]);
  c.restore();
  // chunky bush border
  FD.bushes.forEach(b => { const col = b.back ? BG[0] : BG[1], r = b.r; shadow(c, b.x + 3, b.y + r * .75, r * 1.2, r * .5, .22);
    lobe(c, b.x - r * .5, b.y + r * .1, r * .72, col); lobe(c, b.x + r * .5, b.y + r * .1, r * .72, col); lobe(c, b.x, b.y - r * .28, r * .8, col);
    if (b.fl) { flower(c, b.x - r * .2, b.y - r * .1, p.flowers[Math.floor(b.v * 4) % p.flowers.length], 1.2); flower(c, b.x + r * .4, b.y + r * .25, p.flowers[Math.floor(b.v * 7) % p.flowers.length], .9); }
    c.fillStyle = lite(col, .3); [[.1, -.55], [-.4, -.15], [.55, -.1]].forEach(([dx, dy]) => { c.beginPath(); c.ellipse(b.x + dx * r, b.y + dy * r, 3, 2, 0, 0, 7); c.fill(); }); });
}

function drawFloor(g) {
  const key = JSON.stringify(THEME);
  if (!floorCv || key !== floorKey) { buildFloor(); floorKey = key; }
  g.drawImage(floorCv, -OFF, -OFF, COLS * T + 2 * OFF, ROWS * T + 2 * OFF);
}

// ---------- blocks ----------
const same = (x, y, k) => grid[y] && grid[y][x] === k;
function slab(x, y, kind, p) {
  const px = x * T, py = y * T, hedge = kind === 4;
  const u = same(x, y - 1, kind), d = same(x, y + 1, kind), l = same(x - 1, y, kind), r = same(x + 1, y, kind);
  const top = hedge ? p.bush : p.wall, side = hedge ? dark(p.bush, .3) : p.wallSide;
  const x0 = px + (l ? 0 : 2), x1 = px + T - (r ? 0 : 2), y0 = py - WALL_H + (u ? 2 : 4), y1 = py + T - WALL_H + (d ? 4 : -2);
  g.fillStyle = 'rgba(30,35,70,.15)'; g.beginPath(); g.roundRect(px + 5, py + 6, T, T - 2, 10); g.fill();
  if (!d) { g.fillStyle = side; g.beginPath(); g.roundRect(x0, py + T - WALL_H - 6, x1 - x0, WALL_H + 6, [0, 0, 9, 9]); g.fill();
    if (!hedge) { g.strokeStyle = 'rgba(0,0,20,.12)'; g.lineWidth = 2; g.beginPath(); for (let bx = x0 + 14 + (y & 1) * 10; bx < x1 - 6; bx += 28) { g.moveTo(bx, py + T - WALL_H); g.lineTo(bx, py + T - 6); } g.moveTo(x0 + 4, py + T - WALL_H / 2 - 2); g.lineTo(x1 - 4, py + T - WALL_H / 2 - 2); g.stroke(); } }
  g.fillStyle = hedge ? dark(top, .12) : dark(top, .1); g.beginPath(); g.roundRect(x0, y0 + 3, x1 - x0, y1 - y0, [u || l ? 2 : 10, u || r ? 2 : 10, d || r ? 2 : 10, d || l ? 2 : 10]); g.fill();
  g.fillStyle = top; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, [u || l ? 2 : 10, u || r ? 2 : 10, d || r ? 2 : 10, d || l ? 2 : 10]); g.fill();
  if (hedge) { for (let ly = y0 + 10; ly < y1 - 4; ly += 16) for (let lx = x0 + 10; lx < x1 - 6; lx += 15) { const j = hh(lx + x, ly + y); lobe(g, lx + j * 4, ly + (j - .5) * 5, 9, j < .5 ? top : lite(top, .08)); if (j > .85) flower(g, lx + 3, ly, p.flowers[Math.floor(j * 40) % p.flowers.length], .8); } }
  else { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.roundRect(x0 + 6, y0 + 5, Math.max(8, (x1 - x0) - 22), 6, 3); g.fill(); const j = hh(x, y); if (j < .35) { g.strokeStyle = 'rgba(0,0,40,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 14 + j * 20, y0 + 16); g.lineTo(px + 22 + j * 20, y0 + 24); g.lineTo(px + 19 + j * 20, y0 + 29); g.stroke(); } }
}
function rockBlock(x, y, p) {
  const px = x * T, py = y * T, j = hh(x, y), cx = px + T / 2;
  shadow(g, cx + 6, py + T - 6, T * .62, 13, .2);
  g.fillStyle = dark(p.rock, .2); g.beginPath(); g.roundRect(px - 3 + j * 4, py - 10, T + 6 - j * 4, T + 6, 20); g.fill();
  g.fillStyle = p.rock; g.beginPath(); g.roundRect(px - 3, py - WALL_H - 15, T + 5 + j * 3, T - 2, [22, 24, 14, 16]); g.fill();
  g.fillStyle = lite(p.rock, .22); g.beginPath(); g.ellipse(px + 18, py - WALL_H - 3, 14, 8, -.3, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,40,.13)'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 6, py - WALL_H + 2); g.lineTo(cx + 2, py + 6); g.lineTo(cx + 9, py + 14); g.stroke();
  g.fillStyle = p.bush; g.beginPath(); g.ellipse(cx + 12 - j * 10, py - WALL_H - 14, 9, 4.5, 0, 0, 7); g.fill(); g.fillStyle = lite(p.bush, .25); g.beginPath(); g.ellipse(cx + 10 - j * 10, py - WALL_H - 16, 4, 2, 0, 0, 7); g.fill();
}
function crateBlock(x, y, p) {
  const px = x * T, py = y * T, base = p.crate, front = dark(base, .2), tw = T - 8;
  shadow(g, px + T / 2 + 5, py + T - 5, T * .55, 12, .2);
  g.fillStyle = front; g.beginPath(); g.roundRect(px + 4, py + T - WALL_H - 4, tw, WALL_H + 0, [0, 0, 6, 6]); g.fill();
  g.strokeStyle = dark(base, .4); g.lineWidth = 2.5; g.beginPath(); g.moveTo(px + 9, py + T - WALL_H); g.lineTo(px + T - 9, py + T - 6); g.moveTo(px + T - 9, py + T - WALL_H); g.lineTo(px + 9, py + T - 6); g.stroke();
  g.fillStyle = base; g.beginPath(); g.roundRect(px + 4, py - WALL_H + 8, tw, T - 8, 7); g.fill();
  g.strokeStyle = dark(base, .22); g.lineWidth = 2; g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(px + 4 + tw * i / 4, py - WALL_H + 10); g.lineTo(px + 4 + tw * i / 4, py + T - WALL_H - 2); } g.stroke();
  g.strokeStyle = dark(base, .45); g.lineWidth = 3; g.beginPath(); g.roundRect(px + 6, py - WALL_H + 10, tw - 4, T - 12, 6); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.roundRect(px + 12, py - WALL_H + 13, tw - 20, 4, 2); g.fill();
}
function propBlock(x, y, p) {
  const px = x * T, py = y * T, cx = px + T / 2, by = py + T - 6, now = performance.now();
  shadow(g, cx + 4, by, 20, 8, .2);
  if (p.mode === 'lanterns') { // stone lantern post
    g.fillStyle = p.wallSide; g.beginPath(); g.roundRect(cx - 14, by - 10, 28, 12, 5); g.fill(); g.fillStyle = dark(p.wallSide, .1); g.fillRect(cx - 4, by - 40, 8, 32);
    const fl = .75 + Math.sin(now / 130 + x * 3 + y) * .12 + Math.sin(now / 53 + y) * .06;
    const gl = g.createRadialGradient(cx, by - 52, 2, cx, by - 52, 56); gl.addColorStop(0, `rgba(255,200,90,${.5 * fl})`); gl.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gl; g.beginPath(); g.arc(cx, by - 52, 56, 0, 7); g.fill();
    g.fillStyle = '#d93b3b'; g.beginPath(); g.ellipse(cx, by - 52, 15, 18, 0, 0, 7); g.fill(); g.fillStyle = `rgba(255,214,110,${fl})`; g.beginPath(); g.ellipse(cx, by - 52, 10, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#3b2b4f'; g.beginPath(); g.roundRect(cx - 11, by - 72, 22, 6, 3); g.fill(); g.fillRect(cx - 11, by - 36, 22, 5); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(cx - 6, by - 58, 3, 5, 0, 0, 7); g.fill();
  } else { // breakable-looking jar
    const col = p.jar; g.fillStyle = dark(col, .2); g.beginPath(); g.ellipse(cx, by - 18, 21, 22, 0, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(cx, by - 20, 20, 21, 0, 0, 7); g.fill();
    g.fillStyle = dark(col, .2); g.beginPath(); g.roundRect(cx - 9, by - 50, 18, 12, 4); g.fill(); g.fillStyle = lite(col, .2); g.beginPath(); g.ellipse(cx, by - 50, 13, 5, 0, 0, 7); g.fill(); g.fillStyle = dark(col, .35); g.beginPath(); g.ellipse(cx, by - 50, 8, 3, 0, 0, 7); g.fill();
    g.strokeStyle = lite(col, .55); g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by - 24, 19, 8, 0, .15, Math.PI - .15); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - 9, by - 28, 4, 8, .4, 0, 7); g.fill();
  }
}
function henge(x, y, p) {
  const px = x * T, py = y * T, cx = px + T / 2, by = py + T - 4, now = performance.now();
  shadow(g, cx + 6, by, 24, 9, .22);
  g.fillStyle = dark(p.wallSide, .05); g.beginPath(); g.roundRect(cx - 17, by - 66, 34, 68, [14, 16, 6, 6]); g.fill(); g.fillStyle = p.rock; g.beginPath(); g.roundRect(cx - 17, by - 68, 30, 60, [14, 14, 4, 4]); g.fill();
  g.fillStyle = lite(p.rock, .22); g.beginPath(); g.ellipse(cx - 6, by - 56, 5, 10, 0, 0, 7); g.fill();
  g.strokeStyle = p.tree; g.globalAlpha = .6 + Math.sin(now / 400 + x + y) * .3; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 3, by - 40); g.lineTo(cx - 3, by - 20); g.moveTo(cx - 8, by - 32); g.lineTo(cx + 3, by - 32); g.stroke(); g.globalAlpha = 1;
}
function fountain(x, y, p) {
  const X = x * T + T / 2, Y = y * T - T / 2 + 6, Rr = T * 1.42, now = performance.now() / 1000, pond = centreStyle === 'pond';
  shadow(g, X + 8, Y + 18, Rr + 10, Rr * .9, .2);
  g.fillStyle = dark(p.wallSide, .05); g.beginPath(); g.arc(X, Y + 16, Rr, 0, 7); g.fill(); g.fillRect(X - Rr, Y, Rr * 2, 16);
  g.fillStyle = p.rock; g.beginPath(); g.arc(X, Y, Rr, 0, 7); g.fill();
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; g.fillStyle = i % 2 ? lite(p.rock, .1) : dark(p.rock, .05); g.beginPath(); g.arc(X + Math.cos(a) * (Rr - 7), Y + Math.sin(a) * (Rr - 7), 9, 0, 7); g.fill(); }
  g.fillStyle = dark(p.water, .25); g.beginPath(); g.arc(X, Y + 3, Rr - 17, 0, 7); g.fill(); g.fillStyle = p.water; g.beginPath(); g.arc(X, Y + 3, Rr - 20, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) { const t = (now * .5 + i / 3) % 1; g.globalAlpha = 1 - t; g.beginPath(); g.ellipse(X, Y + 6, 14 + t * (Rr - 36), (14 + t * (Rr - 36)) * .9, 0, 0, 7); g.stroke(); } g.globalAlpha = 1;
  if (pond) { [[-30, 14, 1], [28, -12, .8], [10, 30, .7]].forEach(([dx, dy, s], i) => { g.fillStyle = '#4fae58'; g.beginPath(); g.ellipse(X + dx, Y + dy + Math.sin(now + i) * 1.5, 15 * s, 12 * s, 0, .4, 6.0); g.lineTo(X + dx, Y + dy); g.fill(); g.fillStyle = '#ff9bd0'; if (i === 0) { g.beginPath(); g.arc(X + dx + 2, Y + dy - 4, 5, 0, 7); g.fill(); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(X + dx + 2, Y + dy - 4, 2, 0, 7); g.fill(); } }); g.fillStyle = p.rock; g.beginPath(); g.ellipse(X - 6, Y - 4, 16, 11, 0, 0, 7); g.fill(); g.fillStyle = lite(p.rock, .22); g.beginPath(); g.ellipse(X - 9, Y - 8, 8, 4, 0, 0, 7); g.fill(); return; }
  g.fillStyle = dark(p.wallSide, .0); g.beginPath(); g.roundRect(X - 10, Y - 38, 20, 40, 5); g.fill(); g.fillStyle = p.rock; g.beginPath(); g.ellipse(X, Y - 38, 22, 11, 0, 0, 7); g.fill(); g.fillStyle = p.water; g.beginPath(); g.ellipse(X, Y - 39, 16, 7, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + now * .6, ex = X + Math.cos(a) * (46 + Math.sin(now * 3 + i) * 3), ey = Y + 6 + Math.sin(a) * 38; g.beginPath(); g.moveTo(X, Y - 44); g.quadraticCurveTo(X + Math.cos(a) * 24, Y - 86 + Math.sin(a) * 6, ex, ey); g.stroke(); }
  g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const t = (now * 1.3 + i * .2) % 1; g.globalAlpha = 1 - t; g.beginPath(); g.arc(X + Math.sin(i * 2.4) * (20 + t * 20), Y - 60 + t * 60, 2.5, 0, 7); g.fill(); } g.globalAlpha = 1;
}
function drawBlock(x, y, kind) {
  const p = PAL();
  if (kind === 1 || kind === 4) slab(x, y, kind, p);
  else if (kind === 2) rockBlock(x, y, p);
  else if (kind === 3) crateBlock(x, y, p);
  else if (kind === 5) propBlock(x, y, p);
  else if (kind === 8) fountain(x, y, p);
  else if (kind === 9) henge(x, y, p);
  else if (kind === 6) bushTile(x, y);
  else if (kind !== 7) slab(x, y, 1, p);
}

// ---------- outside decor ----------
function drawDecor(d) {
  const p = PAL(), now = performance.now(); let mode = d.kind === 'rock' ? 'rock' : p.mode;
  if (mode === 'lanterns' && d.v > .6) mode = 'trees';
  g.save(); g.translate(d.x, d.y); g.scale(d.s, d.s);
  shadow(g, 6, 4, 38, 13, .17);
  if (mode === 'rock') {
    g.fillStyle = dark(p.rock, .2); g.beginPath(); g.roundRect(-30, -30, 60, 36, 15); g.fill(); g.fillStyle = p.rock; g.beginPath(); g.roundRect(-28, -46, 54, 36, [18, 20, 10, 12]); g.fill();
    g.fillStyle = lite(p.rock, .22); g.beginPath(); g.ellipse(-8, -36, 13, 6, -.3, 0, 7); g.fill(); g.fillStyle = dark(p.rock, .2); g.beginPath(); g.roundRect(14, -20, 28, 22, 10); g.fill(); g.fillStyle = p.rock; g.beginPath(); g.roundRect(14, -28, 26, 18, 9); g.fill();
    g.fillStyle = p.bush; g.beginPath(); g.ellipse(10, -45, 9, 4, 0, 0, 7); g.fill();
  } else if (mode === 'desert') {
    const gc = '#5b9a58';
    if (d.v < .5) { // saguaro
      [[-18, -28, -52], [18, -36, -58]].forEach(([ax, ay, ty]) => { g.strokeStyle = dark(gc, .2); g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, ay); g.lineTo(ax, ay); g.lineTo(ax, ty); g.stroke(); g.strokeStyle = gc; g.lineWidth = 8; g.beginPath(); g.moveTo(0, ay); g.lineTo(ax, ay); g.lineTo(ax, ty); g.stroke(); });
      g.strokeStyle = dark(gc, .2); g.lineWidth = 17; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -78); g.stroke(); g.strokeStyle = gc; g.lineWidth = 13; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -78); g.stroke();
      g.strokeStyle = lite(gc, .3); g.lineWidth = 2; g.beginPath(); g.moveTo(-3, -4); g.lineTo(-3, -74); g.stroke();
      g.fillStyle = '#ff9bb8'; g.beginPath(); g.arc(0, -84, 4, 0, 7); g.fill();
    } else { // palm
      const sw = Math.sin(now / 1200 + d.x) * 3; g.strokeStyle = dark(p.trunk, .15); g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(14 + sw, -50, 8 + sw, -98); g.stroke(); g.strokeStyle = p.trunk; g.lineWidth = 8; g.beginPath(); g.moveTo(-1, 2); g.quadraticCurveTo(12 + sw, -50, 6 + sw, -98); g.stroke();
      g.strokeStyle = dark(p.trunk, .35); g.lineWidth = 2; for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(-2 + k * 1.4, -k * 14); g.lineTo(8 + k * 1.4, -k * 14 - 3); g.stroke(); }
      for (let i = 0; i < 7; i++) { const a = -Math.PI + i * Math.PI / 6 + sw * .01, ex = 8 + sw + Math.cos(a) * 52, ey = -98 + Math.sin(a) * 26 + 22; g.fillStyle = i % 2 ? '#4f9a5b' : '#3a7d4a'; g.beginPath(); g.moveTo(8 + sw, -100); g.quadraticCurveTo(8 + sw + Math.cos(a) * 28, -98 + Math.sin(a) * 44 - 10, ex, ey); g.quadraticCurveTo(8 + sw + Math.cos(a) * 26, -98 + Math.sin(a) * 30 + 6, 8 + sw, -96); g.fill(); }
      g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(4 + sw, -94, 4, 0, 7); g.arc(12 + sw, -93, 4, 0, 7); g.fill();
    }
  } else if (mode === 'lanterns') {
    const fl = .8 + Math.sin(now / 140 + d.x) * .12; g.fillStyle = dark(p.trunk, .1); g.fillRect(-4, -70, 8, 74); g.fillStyle = p.trunk; g.fillRect(-4, -70, 5, 74);
    const gl = g.createRadialGradient(0, -78, 3, 0, -78, 70); gl.addColorStop(0, `rgba(255,200,90,${.55 * fl})`); gl.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, -78, 70, 0, 7); g.fill();
    g.fillStyle = '#d93b3b'; g.beginPath(); g.ellipse(0, -78, 17, 21, 0, 0, 7); g.fill(); g.fillStyle = `rgba(255,214,110,${fl})`; g.beginPath(); g.ellipse(0, -78, 11, 15, 0, 0, 7); g.fill(); g.fillStyle = '#3b2b4f'; g.fillRect(-9, -101, 18, 6); g.fillRect(-9, -57, 18, 5);
    g.strokeStyle = '#ffd86b'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -52); g.lineTo(-8, -40); g.moveTo(8, -52); g.lineTo(8, -40); g.stroke();
  } else if (mode === 'crates') {
    const c1 = p.crate; [[-22, 0, 40], [20, 0, 36], [-2, -34, 34]].forEach(([x, y, s]) => { g.fillStyle = dark(c1, .22); g.beginPath(); g.roundRect(x - s / 2, y - s * .75, s, s * .75, 5); g.fill(); g.fillStyle = c1; g.beginPath(); g.roundRect(x - s / 2, y - s * .95, s, s * .55, 5); g.fill(); g.strokeStyle = dark(c1, .4); g.lineWidth = 2.5; g.beginPath(); g.roundRect(x - s / 2 + 2, y - s * .93, s - 4, s * .5, 4); g.moveTo(x - s / 2 + 4, y - s * .4); g.lineTo(x + s / 2 - 4, y - 6); g.stroke(); });
  } else if (mode === 'bamboo') {
    const n = 4 + Math.floor(d.v * 3); for (let i = 0; i < n; i++) { const bx = (i - n / 2) * 11 + 5, h = 80 + hh(i, d.v * 9) * 60, sw = Math.sin(now / 900 + i + d.x) * 3, col = i % 2 ? '#7fc26b' : '#5fae58'; g.strokeStyle = col; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + sw / 2, -h / 2, bx + sw, -h); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 2, -2); g.quadraticCurveTo(bx - 2 + sw / 2, -h / 2, bx - 2 + sw, -h); g.stroke(); g.strokeStyle = dark(col, .3); g.lineWidth = 2.5; for (let k = 1; k < 5; k++) { const yy = -h * k / 5; g.beginPath(); g.moveTo(bx - 4 + sw * k / 5, yy); g.lineTo(bx + 4 + sw * k / 5, yy); g.stroke(); } [[1, -h + 6], [-1, -h + 22]].forEach(([s, ly]) => { g.fillStyle = '#9ed97a'; g.beginPath(); g.ellipse(bx + sw + s * 12, ly, 13, 4.5, s * -.5, 0, 7); g.fill(); }); }
  } else { // tree
    g.fillStyle = dark(p.trunk, .1); g.beginPath(); g.roundRect(-7, -42, 14, 46, 4); g.fill(); g.fillStyle = p.trunk; g.beginPath(); g.roundRect(-7, -42, 9, 46, 4); g.fill();
    const t1 = p.tree, t2 = p.tree2; [[-24, -52, 24, t2], [24, -52, 24, t2], [0, -88, 27, t2], [-14, -68, 27, t1], [16, -70, 26, t1], [0, -52, 24, t1], [-4, -92, 20, lite(t1, .06)]].forEach(([x, y, r, c]) => lobe(g, x, y + Math.sin(now / 1100 + d.x) * .8, r, c));
  }
  g.restore();
}

// ---------- theme presets (apply with PF.setTheme(preset)) ----------
window.ARENA_PRESETS = [
  { name: 'Autumn Dojo', bushCols: ['#1e9b3c', '#2fb84d', '#5fd36b'], grass: '#bfe39a', grass2: '#b3db8b', sand: '#f3e6ad', wall: '#a6a8e8', wallSide: '#7d7fca', rock: '#9ea2dc', tree: '#f3a64c', tree2: '#e2803b', bush: '#5fb34f', decor: 'trees' },
  { name: 'Desert', grass: '#f2d49b', grass2: '#e8c483', sand: '#e0b878', wall: '#e0a96d', wallSide: '#b97c48', rock: '#c9a77c', tree: '#4f9a5b', tree2: '#3a7d4a', bush: '#8a9a5b', bushCols: ['#7c8c4e', '#98a862', '#b5c27e'], outside: '#dcb77a', trunk: '#a8794a', crate: '#c98f52', jar: '#c4673f', water: '#6cc7e8', flowers: ['#e8734a', '#fff3d6', '#f2c14e'], decor: 'desert' },
  { name: 'Hawker Night', grass: '#6f9a86', grass2: '#628b78', sand: '#d9b77a', wall: '#e0745f', wallSide: '#a8493f', rock: '#9a88ad', tree: '#f2c14e', tree2: '#e0902f', bush: '#2f6b57', outside: '#2b4a46', crate: '#e0a23c', jar: '#d9534f', water: '#6cc7e8', night: true, flowers: ['#ffd86b', '#ff7b6b', '#fff'], decor: 'lanterns' },
  { name: 'Bamboo Garden', grass: '#b5dd8e', grass2: '#a8d481', sand: '#efe4b6', wall: '#a9d3b2', wallSide: '#6aa183', rock: '#a8b8a4', tree: '#7fcf6a', tree2: '#4fae58', bush: '#3f9a52', trunk: '#8a6f4e', crate: '#cfa56a', jar: '#7fb0d9', decor: 'bamboo' },
  { name: 'Candy Land', grass: '#ffd6e8', grass2: '#ffc9e0', sand: '#fff1b8', wall: '#c9a6ff', wallSide: '#9a78e0', rock: '#ffb3d1', tree: '#ff8fc0', tree2: '#7fe0d0', bush: '#ff8fc0', outside: '#f4a6cf', trunk: '#b98be0', crate: '#ffd36b', jar: '#7fe0d0', water: '#a8e6ff', flowers: ['#fff', '#7fe0d0', '#ffd36b', '#c9a6ff'], decor: 'crates' }
];

// ---------- bushes: walkable, hiding, rustling ----------
const inBush = (x, y) => { const a = Math.floor(x / T), b = Math.floor(y / T); return !!grid[b] && grid[b][a] === 6; };
function rustleAt(x, y) {
  const a = Math.floor(x / T), b = Math.floor(y / T); if (!grid[b] || grid[b][a] !== 6) return;
  let r = rustle.get(b * COLS + a); if (!r) rustle.set(b * COLS + a, r = { t: 0 }); if (r.t > .2) return;
  r.t = .4; for (let n = 2 + Math.floor(Math.random() * 3); n > 0; n--) leaves.push({ x: a * T + 8 + Math.random() * (T - 16), y: b * T + 10 + Math.random() * 30, vx: (Math.random() - .5) * 90, vy: -50 - Math.random() * 60, rot: Math.random() * 6, vr: (Math.random() - .5) * 10, life: .7 + Math.random() * .4, c: BG[1 + Math.floor(Math.random() * 2)] });
}
function bushLobe(c, x, y, r, col) {
  c.fillStyle = dark(col, .3); c.beginPath(); c.arc(x, y + r * .14, r, 0, 7); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r * .92, 0, 7); c.fill();
  c.fillStyle = lite(col, .2); c.beginPath(); c.ellipse(x - r * .15, y - r * .4, r * .55, r * .3, -.2, 0, 7); c.fill();
}
function bushTile(x, y) {
  const px = x * T, py = y * T, now = performance.now() / 1000, rs = rustle.get(y * COLS + x), k = rs ? rs.t / .4 : 0, wob = k * Math.sin(now * 45) * 4 * k;
  if (grid[y + 1] && grid[y + 1][x] !== 6) shadow(g, px + T / 2 + 3, py + T - 2, T * .62, 11, .24);
  for (let i = 0; i < 8; i++) {
    const row = i >> 1, col = i & 1, j = hh(x * 3 + i, y * 7 + col), j2 = hh(y * 5 + i, x + 3);
    const lx = px + T * (.22 + .56 * col + (row & 1 ? 0 : .12)) + (j - .5) * 10 + Math.sin(now * 1.4 + x * .7 + row * .9 + col) * 1.6 + wob * (1 - row * .15);
    const ly = py + T * (.1 + row * .27) + (j2 - .5) * 8 + Math.sin(now * 1.1 + y + i) * .8;
    bushLobe(g, lx, ly, 20 + j * 7, [BG[0], BG[1], BG[1], BG[2]][row]);
  }
  g.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 3; i++) { const j = hh(x + i * 9, y * 2 + i); g.beginPath(); g.ellipse(px + 8 + j * (T - 16), py + 6 + hh(i, x + y) * 18, 3, 1.8, 0, 0, 7); g.fill(); }
}

// ---------- ambient life ----------
function initLife(seed) {
  const L = rng(seed + '~life'), W = COLS * T, H = ROWS * T, spots = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === 6 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx] === 0)) spots.push([x * T + T / 2, y * T + 10]);
  const rim = []; for (let i = 0; i < 12; i++) { const s = i % 3; rim.push(s === 0 ? [40 + L() * (W - 80), H + 14] : s === 1 ? [-34, 40 + L() * (H - 80)] : [W + 34, 40 + L() * (H - 80)]); }
  const pick = a => a.splice(Math.floor(L() * a.length), 1)[0];
  birds = []; for (let i = 0; i < 7; i++) { const s = (i < 3 && spots.length) ? pick(spots) : pick(rim); birds.push({ hx: s[0], hy: s[1], x: s[0], y: s[1], alt: 0, st: 'ground', idle: L() * 2, peck: 0, hp: 1, face: L() < .5 ? -1 : 1, kind: i % 2, tx: 0, ty: 0, sx: 0, sy: 0, vx: 0, vy: 0, t: 0 }); }
  flies = [0, 1, 2].map(i => ({ bx: W * (.25 + .25 * i) + (L() - .5) * 100, by: H * (.3 + L() * .4), ph: L() * 9, c: ['#ff8fc0', '#ffd23f', '#7fc8ff'][i] }));
  cat = { x: W * .16, y: -86 };
}
function updateLife(dt, fighters, rangs) {
  lifeT += dt;
  rustle.forEach((r, k) => { r.t -= dt; if (r.t <= 0) rustle.delete(k); });
  leaves.forEach(l => { l.x += l.vx * dt; l.y += l.vy * dt; l.vy += 220 * dt; l.rot += l.vr * dt; l.life -= dt; }); leaves = leaves.filter(l => l.life > 0);
  const W = COLS * T, H = ROWS * T;
  birds.forEach((b, i) => {
    if (b.st === 'ground') {
      const sc = fighters.some(f => f.alive && Math.hypot(f.x - b.x, f.y - b.y) < 90) || rangs.some(r => Math.hypot(r.x - b.x, r.y + 14 - b.y) < 90);
      if (sc) { const f = fighters.find(f => f.alive && Math.hypot(f.x - b.x, f.y - b.y) < 90) || rangs[0] || { x: W / 2, y: H / 2 }; let dx = b.x - f.x, dy = b.y - f.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; if (Math.hypot(b.x - W / 2, b.y - H / 2) < Math.hypot(b.x + dx * 50 - W / 2, b.y + dy * 50 - H / 2)) { /* away from arena centre: fine */ } else { dx = (b.x - W / 2) / (Math.abs(b.x - W / 2) + 1); dy = (b.y - H / 2) / (Math.abs(b.y - H / 2) + 1); }
        const m = Math.hypot(dx, dy) || 1; b.vx = dx / m * 340; b.vy = dy / m * 340 - 80; b.face = b.vx < 0 ? -1 : 1; b.st = 'fly'; b.t = 0; b.hp = 1; return; }
      if (b.hp < 1) { b.hp += dt / .22; const p = Math.min(1, b.hp); b.x = b.sx + (b.tx - b.sx) * p; b.y = b.sy + (b.ty - b.sy) * p; b.alt = Math.sin(Math.PI * p) * 7; if (b.hp >= 1) b.alt = 0; }
      else { b.peck -= dt; b.idle -= dt; if (b.idle <= 0) { if (Math.random() < .55) { b.hp = 0; b.sx = b.x; b.sy = b.y; b.tx = b.hx + (Math.random() - .5) * 70; b.ty = b.hy + (Math.random() - .5) * 8; b.face = b.tx < b.x ? -1 : 1; b.idle = .3 + Math.random() * 1.1; } else { b.peck = .7; b.idle = 1 + Math.random() * 1.2; } } }
    } else if (b.st === 'fly') { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.alt = Math.min(60, b.alt + 150 * dt); if (b.t > 2.2) { b.st = 'away'; b.t = 4 + Math.random() * 5; } }
    else if (b.st === 'away') { b.t -= dt; if (b.t <= 0) { const a = Math.random() * 6.28; b.x = b.hx + Math.cos(a) * 700; b.y = b.hy + Math.sin(a) * 600; b.alt = 60; b.st = 'return'; } }
    else { const dx = b.hx - b.x, dy = b.hy - b.y, d = Math.hypot(dx, dy); b.face = dx < 0 ? -1 : 1; if (d < 8) { b.x = b.hx; b.y = b.hy; b.alt = 0; b.st = 'ground'; b.hp = 1; b.idle = 1; } else { const s = Math.min(d, 300 * dt); b.x += dx / d * s; b.y += dy / d * s; b.alt = Math.min(60, d * .25); } }
  });
}
function drawBird(c, b) {
  const fly = b.st === 'fly' || b.st === 'return', fc = b.face, y = b.y - b.alt, col = b.kind ? '#a0714a' : '#9aa0b8', belly = b.kind ? '#e8d3b0' : '#c9cde0';
  c.fillStyle = 'rgba(43,35,80,.2)'; c.beginPath(); c.ellipse(b.x, b.y + 4, 8 - b.alt * .06, 3, 0, 0, 7); c.fill();
  const dip = b.st === 'ground' && b.peck > 0 ? Math.max(0, Math.sin(b.peck * 20)) * 5 : 0;
  if (!fly) { c.strokeStyle = '#e8945a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(b.x - 2, y); c.lineTo(b.x - 2, y + 5); c.moveTo(b.x + 2, y); c.lineTo(b.x + 2, y + 5); c.stroke(); }
  c.fillStyle = dark(col, .2); c.beginPath(); c.moveTo(b.x - fc * 6, y - 7); c.lineTo(b.x - fc * 14, y - 9); c.lineTo(b.x - fc * 12, y - 3); c.fill();
  c.fillStyle = col; c.beginPath(); c.ellipse(b.x, y - 7, 9, 6.5, 0, 0, 7); c.fill(); c.fillStyle = belly; c.beginPath(); c.ellipse(b.x + fc, y - 4.5, 6, 3.5, 0, 0, 7); c.fill();
  const hx = b.x + fc * 7, hy = y - 12 + dip; c.fillStyle = b.kind ? col : '#7e86a8'; c.beginPath(); c.arc(hx, hy, 4.6, 0, 7); c.fill();
  c.fillStyle = '#ffb54a'; c.beginPath(); c.moveTo(hx + fc * 4, hy - 1); c.lineTo(hx + fc * 8, hy + 1 + dip * .2); c.lineTo(hx + fc * 4, hy + 2); c.fill();
  c.fillStyle = '#222'; c.beginPath(); c.arc(hx + fc * 1.5, hy - 1, 1.1, 0, 7); c.fill();
  const w = fly ? Math.sin(lifeT * 32 + b.hx) : -.3; c.fillStyle = dark(col, .15); c.beginPath(); c.ellipse(b.x - fc * 1, y - 9 - w * 6, 7, 3.5 + Math.abs(w) * 4, -.4 * fc - w * .8, 0, 7); c.fill();
}
function drawLife(c) {
  leaves.forEach(l => { c.save(); c.translate(l.x, l.y); c.rotate(l.rot); c.globalAlpha = Math.min(1, l.life * 3); c.fillStyle = l.c; c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, 7); c.fill(); c.restore(); }); c.globalAlpha = 1;
  if (cat) { const { x, y } = cat, br = Math.sin(lifeT * 1.8) * 1.2;
    c.fillStyle = 'rgba(43,35,80,.2)'; c.beginPath(); c.ellipse(x + 6, y + 16, 46, 11, 0, 0, 7); c.fill();
    const rk = PAL().rock; c.fillStyle = dark(rk, .22); c.beginPath(); c.roundRect(x - 40, y - 12, 80, 30, 16); c.fill(); c.fillStyle = rk; c.beginPath(); c.roundRect(x - 38, y - 22, 76, 30, [18, 20, 10, 12]); c.fill(); c.fillStyle = lite(rk, .22); c.beginPath(); c.ellipse(x - 14, y - 15, 14, 5, -.2, 0, 7); c.fill();
    c.fillStyle = '#f0a050'; c.beginPath(); c.ellipse(x, y - 30 - br * .5, 22, 12 + br * .6, 0, 0, 7); c.fill(); c.fillStyle = '#ffd9a8'; c.beginPath(); c.ellipse(x + 2, y - 26, 12, 5, 0, 0, 7); c.fill();
    c.strokeStyle = '#d68a3c'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 8, y - 38); c.lineTo(x - 5, y - 28); c.moveTo(x + 2, y - 40); c.lineTo(x + 4, y - 29); c.stroke();
    c.strokeStyle = '#f0a050'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 18, y - 26); c.quadraticCurveTo(x + 36, y - 22, x + 24, y - 14); c.stroke();
    c.fillStyle = '#f0a050'; c.beginPath(); c.arc(x - 20, y - 31, 10, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 29, y - 36); c.lineTo(x - 27, y - 48); c.lineTo(x - 20, y - 40); c.moveTo(x - 20, y - 40); c.lineTo(x - 14, y - 48); c.lineTo(x - 11, y - 36); c.fill();
    c.strokeStyle = '#4a2c1a'; c.lineWidth = 1.6; c.beginPath(); c.arc(x - 24, y - 31, 2.6, .2, 2.9); c.arc(x - 16, y - 31, 2.6, .2, 2.9); c.stroke(); c.fillStyle = '#ff8fa0'; c.beginPath(); c.arc(x - 20, y - 28, 1.4, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.strokeStyle = '#2b2350'; c.lineWidth = 2.5; c.font = '700 13px Fredoka'; c.textAlign = 'center'; for (let i = 0; i < 2; i++) { const t = (lifeT * .5 + i / 2) % 1; c.globalAlpha = 1 - t; c.strokeText('z', x - 4 + t * 16 + i * 6, y - 56 - t * 22); c.fillText('z', x - 4 + t * 16 + i * 6, y - 56 - t * 22); } c.globalAlpha = 1; }
  birds.forEach(b => b.st !== 'away' && drawBird(c, b));
  flies.forEach(f => { const x = f.bx + Math.sin(lifeT * .45 + f.ph) * 140 + Math.sin(lifeT * 2 + f.ph) * 8, y = f.by + Math.cos(lifeT * .33 + f.ph * 1.3) * 80 + Math.sin(lifeT * 3 + f.ph) * 8 - 40, w = 2 + Math.abs(Math.sin(lifeT * 14 + f.ph)) * 7;
    c.fillStyle = 'rgba(43,35,80,.14)'; c.beginPath(); c.ellipse(x, y + 44, 5, 2, 0, 0, 7); c.fill();
    c.fillStyle = f.c; c.beginPath(); c.ellipse(x - w * .7, y - 2, w, 5, -.4, 0, 7); c.ellipse(x + w * .7, y - 2, w, 5, .4, 0, 7); c.fill(); c.fillStyle = lite(f.c, .5); c.beginPath(); c.ellipse(x - w * .6, y + 3, w * .7, 3, .4, 0, 7); c.ellipse(x + w * .6, y + 3, w * .7, 3, -.4, 0, 7); c.fill();
    c.fillStyle = '#4a3a5a'; c.beginPath(); c.ellipse(x, y, 1.4, 5, 0, 0, 7); c.fill(); });
}
