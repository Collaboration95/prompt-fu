// Fighters: specs + drawing. Owner: characters agent. API: DEFAULT_FIGHTERS, drawFighter(g, f, x, y, s, opts), drawWeapon(g, kind, color, x, y, rot, s)
// Boomerang-Fu style food fighters, all hand-drawn with Canvas 2D. Feet at (0,0); ~44w x 50h at s=1.
const DEFAULT_FIGHTERS = [
  { name: 'Vock', archetype: 'avocado', body: { shape: 'egg', color: '#9cc94a', shade: '#4f8f2a', belly: { shape: 'circle', color: '#8a5a3a' } }, top: { kind: 'none' }, face: { eyes: 'happy', blush: false }, accent: { kind: 'none' }, weapon: { kind: 'boomerang', color: '#d9a05b' }, catchphrase: 'Pit happens.' },
  { name: 'Donny', archetype: 'donut', body: { shape: 'round', color: '#e8b36a', shade: '#c98d45', belly: { shape: 'none' } }, top: { kind: 'none' }, face: { eyes: 'dot', blush: false }, accent: { kind: 'spots', color: '#ff7ab6' }, weapon: { kind: 'star', color: '#ffd23f' }, catchphrase: 'Glazed and confused.' },
  { name: 'Shari', archetype: 'sushi', body: { shape: 'round', color: '#2f3640', shade: '#1d222a', belly: { shape: 'none' } }, top: { kind: 'none' }, face: { eyes: 'dot', blush: false }, accent: { kind: 'none' }, weapon: { kind: 'chopsticks', color: '#a0643c' }, catchphrase: 'Roll with it.' },
  { name: 'Greg', archetype: 'eggplant', body: { shape: 'egg', color: '#8a4fb8', shade: '#5e2f8a', belly: { shape: 'none' } }, top: { kind: 'leaf', color: '#7ac24a' }, face: { eyes: 'dot', blush: false }, accent: { kind: 'none' }, weapon: { kind: 'slipper', color: '#5fb3ff' }, catchphrase: 'Plant-based pain.' },
];

// ---------- tiny helpers ----------
const INK = '#1b1630';
function _ell(g, x, y, rx, ry, c, rot) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 7); g.fill(); }
function _rr(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
// cel-shaded fill: shade underneath, main colour shifted up-left leaves a darker band on right/bottom, plus soft highlight
function _cel(g, path, main, shade, hl) {
  g.save(); g.beginPath(); path(); g.fillStyle = shade; g.fill(); g.clip();
  g.save(); g.translate(-4.5, -2); g.beginPath(); path(); g.fillStyle = main; g.fill(); g.restore();
  if (hl !== false) { g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath(); g.ellipse(-10, -34, 3, 6.5, .35, 0, 7); g.fill(); g.beginPath(); g.arc(-6, -41, 1.6, 0, 7); g.fill(); }
  g.restore();
}
function _clip(g, path, fn) { g.save(); g.beginPath(); path(); g.clip(); fn(); g.restore(); }
function _dark(c, k) { // darken a #rrggbb colour
  const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return '#444'; const n = parseInt(m[1], 16);
  const r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255; k = k == null ? .72 : k;
  return `rgb(${r * k | 0},${gg * k | 0},${b * k | 0})`;
}

// ---------- faces ----------
function _eye(g, x, y, r, style, blink, spec) {
  if (blink) { g.strokeStyle = style === 'ring' ? INK : '#fff'; g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r * .8, y + 1); g.lineTo(x + r * .8, y + 1); g.stroke(); return; }
  if (style === 'happy') { g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.arc(x, y + r * .5, r * .8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
  if (style === 'ring') { _ell(g, x, y, r, r, '#fff'); g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); _ell(g, x + (x < 0 ? 1 : -1) * .6, y + 1, r * .5, r * .5, INK); _ell(g, x - 1, y - 0.5, r * .17, r * .17, '#fff'); return; }
  if (style === 'white') { _ell(g, x, y, r, r * 1.05, '#fff'); _ell(g, x + (x < 0 ? 1 : -1) * .8, y + .8, r * .58, r * .68, INK); _ell(g, x - 1, y - 1, r * .2, r * .2, '#fff'); return; }
  _ell(g, x, y, r * .98, r * 1.1, INK);
  _ell(g, x - r * .3, y - r * .38, r * .36, r * .36, '#fff');
  _ell(g, x + r * .35, y + r * .4, r * .15, r * .15, 'rgba(255,255,255,.85)');
}
function _mouth(g, kind, x, y, w) {
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 1.8;
  if (kind === 'open') { g.beginPath(); g.moveTo(x - w, y - 1); g.quadraticCurveTo(x, y + 1, x + w, y - 1); g.quadraticCurveTo(x + w * .6, y + 7, x, y + 7); g.quadraticCurveTo(x - w * .6, y + 7, x - w, y - 1); g.fillStyle = '#5a1a2c'; g.fill(); g.save(); g.clip(); _ell(g, x, y + 7, w * .6, 3, '#ff6f8f'); g.restore(); }
  else if (kind === 'grin') { g.beginPath(); g.roundRect(x - w, y - 2, w * 2, 6, 2); g.fillStyle = '#fff'; g.fill(); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x, y + 4); g.moveTo(x - w / 2, y - 2); g.lineTo(x - w / 2, y + 4); g.moveTo(x + w / 2, y - 2); g.lineTo(x + w / 2, y + 4); g.stroke(); }
  else if (kind === 'flat') { g.beginPath(); g.moveTo(x - w * .7, y + 1); g.lineTo(x + w * .7, y + 1); g.stroke(); }
  else if (kind === 'frown') { g.beginPath(); g.arc(x, y + 5, w * .8, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
  else if (kind === 'wavy') { g.beginPath(); g.moveTo(x - w, y + 1); for (let i = 1; i <= 4; i++) g.lineTo(x - w + i * w / 2, y + (i % 2 ? 4 : 0)); g.stroke(); }
  else if (kind === 'o') { _ell(g, x, y + 2, 2.6, 3.2, '#5a1a2c'); }
  else if (kind === 'tongue') { g.beginPath(); g.arc(x, y - 1, w * .8, .15, Math.PI - .15); g.stroke(); _ell(g, x + 1, y + 4.6, 2.3, 2.8, '#ff6f8f'); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 1, y + 4.6, 2.3, 2.8, 0, 0, 7); g.stroke(); }
  else if (kind === 'cat') { g.beginPath(); g.arc(x - w * .45, y, w * .5, .1, Math.PI - .1); g.arc(x + w * .45, y, w * .5, .1, Math.PI - .1); g.stroke(); }
  else { g.beginPath(); g.arc(x, y - 1.5, w * .8, .2, Math.PI - .2); g.stroke(); } // smile
}

// ---------- archetypes ----------
// each: c=[main,shade,hands], eye={y,dx,r,style}, mouth, hand=[x,y], feet(bool), draw(g,P)
const _A = {};
_A.eggplant = { c: ['#8a4fb8', '#5e2f8a', '#3a3a8a'], eye: { y: -24, dx: 9, r: 4.6 }, mouth: 'frown', hand: [23, -14], draw(g, P) {
  const path = () => { g.moveTo(-9, -41); g.bezierCurveTo(-4, -45, 4, -45, 9, -41); g.bezierCurveTo(14, -30, 22, -20, 21, -9); g.quadraticCurveTo(20, -4, 13, -4); g.lineTo(-13, -4); g.quadraticCurveTo(-20, -4, -21, -9); g.bezierCurveTo(-22, -20, -14, -30, -9, -41); };
  _cel(g, path, P.c[0], P.c[1]);
  g.fillStyle = '#7ac24a'; g.beginPath(); g.moveTo(-11, -40); g.lineTo(-9, -49); g.lineTo(-4, -44); g.lineTo(0, -53); g.lineTo(4, -44); g.lineTo(9, -49); g.lineTo(11, -40); g.quadraticCurveTo(0, -35, -11, -40); g.fill();
  g.fillStyle = '#4f9a30'; g.beginPath(); g.moveTo(3, -43); g.lineTo(9, -49); g.lineTo(11, -40); g.quadraticCurveTo(7, -38, 3, -39); g.fill(); _ell(g, -4, -45, 1.5, 2.5, 'rgba(255,255,255,.4)', .4);
} };
_A.avocado = { c: ['#a6cf4c', '#4f8f2a', '#3d6e2a'], eye: { y: -17, dx: 6.5, r: 3.6 }, mouth: 'open', hand: [23, -22], draw(g, P) {
  const path = () => { g.moveTo(0, -48); g.bezierCurveTo(12, -48, 13, -36, 19, -26); g.bezierCurveTo(25, -14, 21, -4, 0, -4); g.bezierCurveTo(-21, -4, -25, -14, -19, -26); g.bezierCurveTo(-13, -36, -12, -48, 0, -48); };
  g.save(); g.beginPath(); path(); g.fillStyle = '#3f8a2a'; g.fill(); g.restore();
  g.save(); g.translate(0, -24); g.scale(.82, .84); g.translate(0, 24); _cel(g, path, '#c6e06a', '#9dc24a', false); g.restore();
  _clip(g, path, () => { g.fillStyle = 'rgba(30,70,20,.35)'; g.beginPath(); g.ellipse(12, -20, 8, 24, 0, 0, 7); g.fill(); });
  _ell(g, 0, -17, 12.5, 12, '#6d4128'); _ell(g, -1.5, -18.5, 11, 10.5, '#9a6a45'); _ell(g, -6, -24, 3, 2, 'rgba(255,255,255,.35)', -.5);
} };
_A.banana = { c: ['#ffd93d', '#e0aa1e', '#7a5a3a'], eye: { y: -38, dx: 7, r: 3.6 }, mouth: 'flat', hand: [17, -14], draw(g, P) {
  const body = () => { g.moveTo(-5, -34); g.bezierCurveTo(-21, -30, -18, -12, -10, -5); g.quadraticCurveTo(0, -2, 11, -5); g.bezierCurveTo(18, -14, 18, -28, 8, -36); g.closePath(); };
  _cel(g, body, '#ffd93d', '#e0aa1e', false);
  // cream upper
  const top = () => { g.moveTo(-8, -34); g.bezierCurveTo(-10, -48, -4, -54, 2, -54); g.bezierCurveTo(9, -54, 11, -44, 9, -34); g.quadraticCurveTo(0, -30, -8, -34); };
  _cel(g, top, '#fbf1c8', '#e3d39c', false);
  // peel flaps
  g.fillStyle = '#ffd93d'; g.beginPath(); g.moveTo(-9, -33); g.quadraticCurveTo(-18, -34, -17, -22); g.quadraticCurveTo(-12, -28, -5, -28); g.fill();
  g.fillStyle = '#f2c22a'; g.beginPath(); g.moveTo(10, -33); g.quadraticCurveTo(19, -34, 17, -22); g.quadraticCurveTo(13, -28, 6, -28); g.fill();
  _ell(g, -9, -18, 2, 7, 'rgba(255,255,255,.4)', .2);
} };
_A.milk = { c: ['#4fa3e8', '#2f78c4', '#2f5fa8'], eye: { y: -20, dx: 8, r: 4 }, mouth: 'cat', hand: [19, -14], draw(g, P) {
  _rr(g, -6, -50, 12, 6, 2, '#2f6ad0'); _rr(g, -6, -50, 8, 3, 1.5, '#5b95ec');
  const roof = () => { g.moveTo(-17, -36); g.lineTo(-9, -46); g.lineTo(9, -46); g.lineTo(17, -36); g.closePath(); };
  g.fillStyle = '#8cc4f4'; g.beginPath(); roof(); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-17, -36); g.lineTo(-9, -46); g.lineTo(-4, -46); g.lineTo(-8, -36); g.fill();
  const box = () => { g.roundRect(-17, -37, 34, 33, 4); };
  _cel(g, box, '#4fa3e8', '#2f78c4', false);
  _rr(g, -12.5, -33, 24, 24, 6, '#f1f9ff'); _rr(g, 2, -33, 9.5, 24, 5, '#cfe8fb');
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-17, -37); g.quadraticCurveTo(-12, -30, -9, -37); g.fill(); g.beginPath(); g.moveTo(6, -37); g.quadraticCurveTo(10, -31, 14, -37); g.fill();
} };
_A.watermelon = { c: ['#ff4f5e', '#d12f45', '#2f6e3a'], eye: { y: -22, dx: 10, r: 4.6 }, mouth: 'flat', hand: [22, -10], draw(g, P) {
  const path = () => { g.moveTo(0, -48); g.quadraticCurveTo(4, -48, 8, -42); g.lineTo(23, -16); g.quadraticCurveTo(27, -8, 18, -5); g.lineTo(-18, -5); g.quadraticCurveTo(-27, -8, -23, -16); g.lineTo(-8, -42); g.quadraticCurveTo(-4, -48, 0, -48); };
  _cel(g, path, '#ff4f5e', '#d12f45', false);
  _clip(g, path, () => { g.fillStyle = '#2f9a45'; g.fillRect(-30, -13, 60, 14); g.fillStyle = '#b7e58a'; g.beginPath(); g.moveTo(-30, -14); g.quadraticCurveTo(0, -9, 30, -14); g.lineTo(30, -11); g.quadraticCurveTo(0, -6, -30, -11); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(8, -13, 20, 14); });
  g.fillStyle = INK; [[-5, -38], [6, -34], [-14, -28], [15, -26], [0, -29]].forEach(([a, b]) => { g.beginPath(); g.ellipse(a, b, 1.3, 2.2, .3, 0, 7); g.fill(); });
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-4, -44, 1.5, 3, .2, 0, 7); g.fill();
} };
_A.donut = { c: ['#eab36b', '#c98d45', '#caa060'], eye: { y: -14, dx: 10, r: 4.2 }, mouth: 'wavy', hand: [24, -11], draw(g, P) {
  const ring = () => { g.arc(0, -24, 22, 0, 7); };
  _cel(g, ring, '#f0bf7a', '#c98d45', false);
  // icing with drips
  _clip(g, ring, () => {
    g.fillStyle = '#c9487f'; g.beginPath(); g.moveTo(-26, -52); g.lineTo(-26, -22); g.quadraticCurveTo(-24, -14, -18, -22); g.quadraticCurveTo(-14, -28, -10, -24); g.quadraticCurveTo(-7, -19, -2, -23); g.quadraticCurveTo(3, -26, 6, -23); g.quadraticCurveTo(9, -18, 14, -22); g.quadraticCurveTo(18, -26, 21, -20); g.quadraticCurveTo(25, -14, 27, -24); g.lineTo(27, -52); g.fill();
    g.save(); g.translate(-3, -2); g.fillStyle = '#ff7ab6'; g.beginPath(); g.moveTo(-26, -52); g.lineTo(-26, -22); g.quadraticCurveTo(-24, -14, -18, -22); g.quadraticCurveTo(-14, -28, -10, -24); g.quadraticCurveTo(-7, -19, -2, -23); g.quadraticCurveTo(3, -26, 6, -23); g.quadraticCurveTo(9, -18, 14, -22); g.quadraticCurveTo(18, -26, 21, -20); g.quadraticCurveTo(25, -14, 27, -24); g.lineTo(27, -52); g.fill(); g.restore();
  });
  [['#fff', -14, -40, .5], ['#ffe14a', 14, -39, -.6], ['#6fe0ff', 13, -26, .9], ['#fff', -17, -29, -.4], ['#a6ff7a', -2, -45, 1]].forEach(([c, x, y, r]) => { g.strokeStyle = c; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - Math.cos(r) * 2, y - Math.sin(r) * 2); g.lineTo(x + Math.cos(r) * 2, y + Math.sin(r) * 2); g.stroke(); });
  // hole
  _ell(g, 0, -30, 9.5, 8.5, '#d9a15c'); _ell(g, 0, -29, 8.5, 7.5, '#f7efe0'); _ell(g, 0, -32, 8.5, 5, '#e5dccb');
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-12, -40, 2, 4, .6, 0, 7); g.fill();
} };
_A.coffee = { c: ['#f7f1e2', '#d8cfb6', '#9a9486'], eye: { y: -22, dx: 8.5, r: 5.5, style: 'ring' }, mouth: 'grin', hand: [18, -8], draw(g, P) {
  g.strokeStyle = '#c9c0a8'; g.lineWidth = 6; g.beginPath(); g.ellipse(17, -24, 7.5, 9, 0, -1.6, 1.6); g.stroke(); g.strokeStyle = '#f3ecd8'; g.lineWidth = 3.5; g.beginPath(); g.ellipse(17, -24, 7.5, 9, 0, -1.6, 1.6); g.stroke();
  const box = () => { g.roundRect(-17, -43, 33, 39, 7); };
  _cel(g, box, '#f7f1e2', '#d8cfb6', false);
  _clip(g, box, () => { g.fillStyle = '#6b4226'; g.fillRect(-20, -45, 40, 6); g.beginPath(); [[-12, 12], [-2, 8], [8, 14]].forEach(([x, l]) => { g.roundRect(x - 2, -42, 4.5, l, 2.2); }); g.fill(); g.fillStyle = '#4a2c18'; g.fillRect(-20, -45, 40, 2); });
  _rr(g, 11, -34, 3, 8, 1.5, '#8fd8f0');
} };
_A.icecream = { c: ['#55d3c4', '#2ba596', '#2f6aa8'], eye: { y: -29, dx: 8, r: 4, style: 'happy' }, mouth: 'smile', hand: [22, -34], feet: false, draw(g, P) {
  _cel(g, () => g.roundRect(-4.5, -15, 9, 14, 3), '#f2c27e', '#c99552', false);
  const path = () => { g.moveTo(-19, -14); g.lineTo(-19, -34); g.quadraticCurveTo(-19, -48, -3, -48); g.lineTo(5, -48); g.quadraticCurveTo(9, -44, 12, -43); g.quadraticCurveTo(10, -39, 15, -37); g.quadraticCurveTo(19, -37, 19, -33); g.lineTo(19, -14); g.quadraticCurveTo(15, -10, 11, -14); g.quadraticCurveTo(7, -9, 3, -14); g.quadraticCurveTo(-3, -9, -7, -14); g.quadraticCurveTo(-12, -9, -15, -13); g.quadraticCurveTo(-18, -12, -19, -14); };
  _cel(g, path, '#55d3c4', '#2ba596', false);
  _clip(g, path, () => { g.fillStyle = '#35b8a8'; g.beginPath(); g.moveTo(-22, -22); g.quadraticCurveTo(-15, -26, -8, -22); g.quadraticCurveTo(0, -27, 8, -22); g.quadraticCurveTo(15, -27, 22, -22); g.lineTo(22, -10); g.lineTo(-22, -10); g.fill(); });
  _ell(g, -11, -40, 3.2, 6, 'rgba(255,255,255,.55)', .5); _ell(g, -6, -46, 1.6, 1.6, 'rgba(255,255,255,.6)');
} };
_A.bread = { c: ['#f6d08b', '#e3a95a', '#9a6a3a'], eye: { y: -23, dx: 9, r: 4.2 }, mouth: 'smile', hand: [21, -11], draw(g, P) {
  const path = () => { g.moveTo(-17, -6); g.lineTo(-18, -30); g.bezierCurveTo(-26, -34, -22, -48, -10, -45); g.bezierCurveTo(-5, -43, 5, -43, 10, -45); g.bezierCurveTo(22, -48, 26, -34, 18, -30); g.lineTo(17, -6); g.quadraticCurveTo(17, -3, 12, -3); g.lineTo(-12, -3); g.quadraticCurveTo(-17, -3, -17, -6); };
  _cel(g, path, '#c98340', '#9a5f2a', false);
  g.save(); g.translate(-1, -24); g.scale(.86, .84); g.translate(0, 24); _cel(g, path, '#fbdc9c', '#eab96a', false); g.restore();
  _ell(g, -10, -40, 2.4, 1.6, 'rgba(255,255,255,.5)', -.3);
} };
_A.bacon = { c: ['#e5503c', '#b02f2a', '#6a3a2a'], eye: { y: -27, dx: 8, r: 3.8 }, mouth: 'grin', hand: [20, -12], draw(g, P) {
  const path = () => { g.moveTo(-14, -47); for (let i = 0; i <= 10; i++) g.lineTo(-14 + Math.sin(i * 1.3) * 2.5 + (i % 2) * 1, -47 + i * 4.3); g.lineTo(-13, -4); g.lineTo(15, -4); for (let i = 10; i >= 0; i--) g.lineTo(16 + Math.sin(i * 1.3 + 2) * 2.5, -47 + i * 4.3); g.closePath(); };
  _cel(g, path, '#d94a38', '#a52a28', false);
  _clip(g, path, () => { g.strokeStyle = '#f6b49c'; g.lineWidth = 5; g.lineCap = 'round'; [-38, -20].forEach(y => { g.beginPath(); g.moveTo(-18, y + 4); g.bezierCurveTo(-6, y - 5, 6, y + 7, 18, y - 3); g.stroke(); }); g.strokeStyle = '#8f2a24'; g.lineWidth = 2; [-30, -12].forEach(y => { g.beginPath(); g.moveTo(-18, y + 2); g.bezierCurveTo(-6, y - 5, 6, y + 5, 18, y - 2); g.stroke(); }); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-9, -38, 1.8, 5, .1, 0, 7); g.fill(); });
} };
_A.carrot = { c: ['#ff8a2a', '#d9601a', '#7a4a2a'], eye: { y: -31, dx: 8, r: 4.6 }, mouth: 'open', hand: [17, -14], draw(g, P) {
  g.fillStyle = '#47a83a'; [[-7, -48, -.5], [7, -48, .5], [0, -50, 0]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y - 4, 4, 8, r, 0, 7); g.fill(); }); _ell(g, 3, -53, 3, 6, '#7ad050', .3);
  const path = () => { g.moveTo(-17, -40); g.quadraticCurveTo(-17, -47, -9, -47); g.lineTo(9, -47); g.quadraticCurveTo(17, -47, 17, -40); g.bezierCurveTo(16, -26, 9, -12, 6, -6); g.quadraticCurveTo(0, -1, -6, -6); g.bezierCurveTo(-9, -12, -16, -26, -17, -40); };
  _cel(g, path, '#ff8a2a', '#d9601a');
  _clip(g, path, () => { g.strokeStyle = '#d9601a'; g.lineWidth = 1.6; g.lineCap = 'round'; [[-14, -22, -7], [14, -16, 8], [-9, -12, -4]].forEach(([x, y, l]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 0 ? 7 : -7), y + (x < 0 ? 1.5 : -1.5)); g.stroke(); }); });
} };
_A.sushi = { c: ['#343c47', '#1d222a', '#16181d'], eye: { y: -20, dx: 9.5, r: 5, style: 'white' }, mouth: 'open', hand: [24, -22], draw(g, P) {
  const side = () => { g.moveTo(-20, -34); g.lineTo(-20, -9); g.quadraticCurveTo(-20, -2, 0, -2); g.quadraticCurveTo(20, -2, 20, -9); g.lineTo(20, -34); g.closePath(); };
  _cel(g, side, '#3b434f', '#1d222a', false);
  _ell(g, -12, -17, 2.4, 9, 'rgba(255,255,255,.12)');
  _ell(g, 0, -34, 20, 9, '#262c35'); _ell(g, 0, -35, 18, 7.6, '#fdfaf0'); _ell(g, 0, -34.5, 18, 6.5, '#f1ead8');
  g.fillStyle = '#e0b8a6'; for (let i = 0; i < 9; i++) { g.fillRect(-12 + i * 3 + (i % 2), -35 + (i * 7 % 5) - 2, 1.5, .8); }
  _ell(g, -6, -38, 8, 4.4, '#ff4f5a'); _ell(g, -7, -39, 6, 2.6, '#ff8a8f'); _ell(g, -4, -37, 5, 1.8, 'rgba(160,20,40,.35)');
  g.fillStyle = '#5fcf52'; g.beginPath(); g.moveTo(5, -36); g.lineTo(9, -46); g.lineTo(11, -37); g.lineTo(14, -44); g.lineTo(15, -35); g.quadraticCurveTo(10, -32, 5, -36); g.fill(); g.fillStyle = '#3fa83a'; g.beginPath(); g.moveTo(11, -37); g.lineTo(14, -44); g.lineTo(15, -35); g.quadraticCurveTo(13, -34, 11, -35); g.fill();
} };
_A.burger = { c: ['#f2a640', '#d98428', '#6a4a30'], eye: { y: -35, dx: 9, r: 4.2 }, mouth: 'smile', hand: [25, -17], draw(g, P) {
  const bot = () => { g.roundRect(-21, -15, 42, 12, [2, 2, 9, 9]); };
  _cel(g, bot, '#f2a640', '#d98428', false);
  const pat = () => { g.roundRect(-23, -23, 46, 9, 4.5); };
  _cel(g, pat, '#6b3f26', '#4a2a18', false);
  g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(-18, -24); g.lineTo(18, -24); g.lineTo(22, -19); g.lineTo(16, -22); g.lineTo(10, -17); g.lineTo(2, -23); g.lineTo(-10, -23); g.fill();
  g.fillStyle = '#6fc24a'; g.beginPath(); g.moveTo(-24, -28); for (let i = 0; i <= 8; i++) g.lineTo(-24 + i * 6, -28 + (i % 2 ? 5 : 0)); g.lineTo(24, -31); g.lineTo(-24, -31); g.fill();
  g.fillStyle = '#ff5a4a'; g.beginPath(); g.roundRect(-19, -29, 10, 3, 1.5); g.fill();
  const top = () => { g.moveTo(-22, -29); g.bezierCurveTo(-26, -52, 26, -52, 22, -29); g.closePath(); };
  _cel(g, top, '#f2a640', '#d98428', false);
  _ell(g, -10, -45, 4, 1.8, 'rgba(255,255,255,.4)', -.3); g.fillStyle = '#ffe9a8'; [[-3, -47], [8, -45], [14, -39], [-16, -39]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 1.6, .9, .4, 0, 7); g.fill(); });
} };
_A.boba = { c: ['#cba8f2', '#9a78d0', '#6a54b0'], eye: { y: -25, dx: 8, r: 3.8, style: 'happy' }, mouth: 'cat', hand: [21, -36], draw(g, P) {
  g.strokeStyle = '#ff5a82'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(2, -40); g.lineTo(8, -56); g.stroke(); g.strokeStyle = '#ff9ab5'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(1, -40); g.lineTo(7, -55); g.stroke();
  const cup = () => { g.moveTo(-17, -40); g.lineTo(17, -40); g.lineTo(13, -9); g.quadraticCurveTo(12, -3, 5, -3); g.lineTo(-5, -3); g.quadraticCurveTo(-12, -3, -13, -9); g.closePath(); };
  _cel(g, cup, '#cba8f2', '#9a78d0', false);
  _clip(g, cup, () => { g.fillStyle = '#8be0d0'; g.fillRect(-20, -42, 40, 8); g.fillStyle = '#6a4a98'; [[-8, -8], [0, -6], [8, -8], [-4, -12], [4, -13], [-11, -13], [11, -13]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); _ell(g, x - 1, y - 1, .9, .9, 'rgba(255,255,255,.4)'); }); });
  _ell(g, 0, -41, 18, 4.5, '#8be0d0'); _ell(g, 0, -41.5, 15, 2.8, '#b5f0e4'); _ell(g, -10, -26, 1.8, 6, 'rgba(255,255,255,.45)', .1);
} };
_A.fries = { c: ['#ff6a2a', '#d4401a', '#d4541a'], eye: { y: -19, dx: 8, r: 3.6, style: 'happy' }, mouth: 'grin', hand: [22, -33], draw(g, P) {
  [[-14, -47, 8], [-6, -52, 8], [2, -49, 8], [10, -53, 8], [-10, -44, 9], [6, -45, 9]].forEach(([x, y, w], i) => { _cel(g, () => g.roundRect(x - 1, y, w, 26, 2), i % 2 ? '#ffd84a' : '#ffe27a', '#f0b429', false); });
  const box = () => { g.moveTo(-17, -33); g.lineTo(17, -33); g.lineTo(14, -6); g.quadraticCurveTo(13, -3, 9, -3); g.lineTo(-9, -3); g.quadraticCurveTo(-13, -3, -14, -6); g.closePath(); };
  _cel(g, box, '#ff6a2a', '#d4401a', false);
  _clip(g, box, () => { g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(-18, -33); g.lineTo(18, -33); g.lineTo(18, -30); g.quadraticCurveTo(0, -26, -18, -30); g.fill(); });
  _ell(g, -11, -20, 1.8, 6, 'rgba(255,255,255,.3)', .1);
} };
_A.hotsauce = { c: ['#e8362f', '#a81e24', '#222'], eye: { y: -15, dx: 7.5, r: 4, style: 'ring' }, mouth: 'flat', hand: [19, -10], draw(g, P) {
  _rr(g, -5, -53, 10, 9, 2, '#26262c'); _rr(g, -5, -53, 4, 9, 2, '#4a4a54');
  const path = () => { g.moveTo(-5, -45); g.lineTo(5, -45); g.lineTo(5, -38); g.bezierCurveTo(5, -33, 16, -33, 16, -26); g.lineTo(16, -8); g.quadraticCurveTo(16, -3, 10, -3); g.lineTo(-10, -3); g.quadraticCurveTo(-16, -3, -16, -8); g.lineTo(-16, -26); g.bezierCurveTo(-16, -33, -5, -33, -5, -38); g.closePath(); };
  _cel(g, path, '#e8362f', '#a81e24', false);
  _ell(g, 0, -28, 8.5, 8.5, '#fff6e6'); _ell(g, 0, -28, 6.5, 6.5, '#e03a3a'); _ell(g, -1, -29, 2.5, 4, '#ff9a8a', .6);
  _ell(g, -11, -22, 1.6, 7, 'rgba(255,255,255,.4)', .05);
} };
_A.pineapple = { c: ['#ffc83a', '#e09a14', '#d9801a'], eye: { y: -21, dx: 7, r: 3.6 }, mouth: 'tongue', hand: [24, -42], draw(g, P) {
  g.fillStyle = '#3f9a38'; [[-10, -42, -.6], [10, -42, .6], [-4, -44, -.2], [4, -44, .2], [0, -46, 0]].forEach(([x, y, r], i) => { g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = i < 2 ? '#3f9a38' : i < 4 ? '#58b848' : '#7ad060'; g.beginPath(); g.moveTo(-4, 2); g.quadraticCurveTo(-3, -8, 0, -13 - (i === 4 ? 3 : 0)); g.quadraticCurveTo(3, -8, 4, 2); g.fill(); g.restore(); });
  const path = () => { g.ellipse(0, -21, 18, 21, 0, 0, 7); };
  _cel(g, path, '#ffc83a', '#e09a14', false);
  _clip(g, path, () => { g.strokeStyle = 'rgba(214,120,20,.7)'; g.lineWidth = 1.4; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(i * 8 - 20, -44); g.lineTo(i * 8 + 20, 2); g.stroke(); g.beginPath(); g.moveTo(i * 8 + 20, -44); g.lineTo(i * 8 - 20, 2); g.stroke(); } });
  _ell(g, -11, -30, 2.4, 6, 'rgba(255,255,255,.35)', .4);
} };
_A.ramen = { c: ['#fbf2e2', '#d9ccb2', '#e8e8f0'], eye: { y: -14, dx: 8, r: 3.6 }, mouth: 'o', hand: [24, -7], hands: '#f1f1f8', draw(g, P) {
  g.fillStyle = '#8a5a30'; g.save(); g.translate(-6, -34); g.rotate(-.12); g.fillRect(-2, -16, 4, 22); g.restore(); g.save(); g.translate(5, -34); g.rotate(.1); g.fillRect(-2, -18, 4, 24); g.restore();
  g.fillStyle = '#6a4220'; g.fillRect(3, -52, 4, 6); g.fillRect(-9, -50, 4, 5);
  const bowl = () => { g.moveTo(-22, -28); g.bezierCurveTo(-21, -6, -10, -3, 0, -3); g.bezierCurveTo(10, -3, 21, -6, 22, -28); g.closePath(); };
  _cel(g, bowl, '#fbf2e2', '#d9ccb2', false);
  _clip(g, bowl, () => { g.fillStyle = '#3f78d0'; g.fillRect(-24, -23, 48, 6); g.fillStyle = '#fbf2e2'; for (let i = -12; i <= 12; i++) g.fillRect(i * 2, -23, 1, 2.5); });
  _ell(g, 0, -28, 22, 6.5, '#efe3c8'); _ell(g, 0, -28.5, 19, 5, '#e8b44a'); g.strokeStyle = '#f7d77a'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, -28.5, 17 - i * 3, 4.3 - i * .7, 0, 0.1, 3.0); g.stroke(); }
  _ell(g, 8, -29, 4, 2.6, '#fff'); _ell(g, 8, -29, 1.6, 1, '#ff7a9a');
} };

const ARCHETYPES = Object.keys(_A);
if (typeof window !== 'undefined') window.ARCHETYPES = ARCHETYPES;
const _ALIASES = { eggplant: /egg ?plant|aubergine/, avocado: /avo/, banana: /banana/, milk: /milk|carton/, watermelon: /melon/, donut: /do(ugh)?nut/, coffee: /coffee|mug|latte|kopi/, icecream: /ice ?cream|popsicle|gelato/, bread: /bread|toast|loaf/, bacon: /bacon/, carrot: /carrot/, sushi: /sushi|nigiri|maki|roll/, burger: /burger|patty/, boba: /boba|bubble|tea/, fries: /fries|fry|chips/, hotsauce: /sauce|chil+i|pepper|sriracha/, pineapple: /pineapple/, ramen: /ramen|noodle|pho|soup/ };
function _resolveArch(sp) {
  if (sp._arch !== undefined) return sp._arch;
  let k = String(sp.archetype || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!_A[k]) { k = null; const txt = String(sp.name || '').toLowerCase(); for (const a in _ALIASES) if (_ALIASES[a].test(txt)) { k = a; break; } }
  return (sp._arch = k);
}

// generic chunky body for unknown/prompted specs, using their colours
function _generic(g, sp, P) {
  const b = sp.body || {}, main = b.color || '#9bc53d', shade = b.shade || _dark(main), sh = b.shape || 'round';
  const path = () => {
    if (sh === 'square') g.roundRect(-19, -42, 38, 38, 11);
    else if (sh === 'tall') g.roundRect(-16, -48, 32, 44, 14);
    else if (sh === 'egg') { g.moveTo(0, -48); g.bezierCurveTo(14, -48, 14, -34, 20, -24); g.bezierCurveTo(24, -12, 18, -4, 0, -4); g.bezierCurveTo(-18, -4, -24, -12, -20, -24); g.bezierCurveTo(-14, -34, -14, -48, 0, -48); }
    else if (sh === 'spiky') { for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = i % 2 ? 19 : 24; g.lineTo(Math.cos(a) * r, -24 + Math.sin(a) * (r * .92)); } g.closePath(); }
    else if (sh === 'blob') g.ellipse(0, -22, 23, 19, 0, 0, 7);
    else g.ellipse(0, -24, 20, 21, 0, 0, 7);
  };
  _cel(g, path, main, shade);
  const bl = b.belly; if (bl && bl.shape && bl.shape !== 'none') { _ell(g, 0, -12, bl.shape === 'circle' ? 10 : 12, bl.shape === 'circle' ? 10 : 8, bl.color || '#f3e7a1'); }
  const ac = sp.accent || {}, ec = ac.color || '#fff';
  g.fillStyle = ec;
  if (ac.kind === 'seeds') [[-12, -34], [10, -36], [-5, -14], [14, -22], [-16, -20]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 1.7, 2.6, .3, 0, 7); g.fill(); });
  if (ac.kind === 'spots') [[-12, -34], [12, -30], [-14, -16], [14, -14]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); });
  if (ac.kind === 'stripes') { g.strokeStyle = ec; g.lineWidth = 3; g.lineCap = 'round'; _clip(g, path, () => [-38, -30, -12, -4].forEach(y => { g.beginPath(); g.moveTo(-22, y); g.lineTo(22, y - 4); g.stroke(); })); }
  const tp = sp.top || {}, tc = tp.color || shade; g.fillStyle = tc;
  const top = sh === 'tall' ? -48 : sh === 'egg' ? -47 : -44;
  if (tp.kind === 'leaf') { g.beginPath(); g.ellipse(-6, top, 8, 4, -.5, 0, 7); g.ellipse(6, top, 8, 4, .5, 0, 7); g.fill(); }
  if (tp.kind === 'stem') { g.fillRect(-2.5, top - 7, 5, 10); }
  if (tp.kind === 'hat') { g.beginPath(); g.roundRect(-20, top - 2, 40, 12, 6); g.fill(); }
  if (tp.kind === 'bun') { g.beginPath(); g.arc(0, top, 7, 0, 7); g.fill(); }
  if (tp.kind === 'ears') [-11, 11].forEach(ex => { g.beginPath(); g.ellipse(ex, top + 2, 5, 9, ex / 30, 0, 7); g.fill(); });
  if (tp.kind === 'spikes') for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 8 - 4, top + 4); g.lineTo(i * 8, top - 6); g.lineTo(i * 8 + 4, top + 4); g.fill(); }
}

// ---------- fighter ----------
function drawFighter(g, f, x, y, s, opts = {}) {
  const sp = f.spec || f, sq = opts.squash || 0, face = opts.face || 1, step = opts.step || 0;
  const key = _resolveArch(sp), A = key ? _A[key] : null;
  const b = sp.body || {}, fc = sp.face || {};
  const main = A ? A.c[0] : (b.color || '#9bc53d'), shade = A ? A.c[1] : (b.shade || _dark(main));
  const P = { c: A ? A.c : [main, shade, _dark(shade, .6)] };
  g.save(); g.translate(x, y); g.scale(s * (1 + sq * .12) * face, s * (1 - sq * .12));
  // ground shadow
  g.fillStyle = 'rgba(70,70,90,.2)'; g.beginPath(); g.ellipse(0, 1, 21, 6, 0, 0, 7); g.fill();
  const walking = Math.abs(opts.step || 0) > 0, bob = walking ? -Math.abs(Math.sin(step)) * 1.8 : 0;
  const handCol = (A && A.hands) || P.c[2], footCol = A ? _dark(P.c[2] === '#16181d' || P.c[2] === '#222' ? '#555555' : P.c[2], .7) : _dark(shade, .6);
  // feet
  if (!A || A.feet !== false) [-1, 1].forEach((d, i) => { const lift = walking ? Math.max(0, Math.sin(step + i * Math.PI)) * 3 : 0; _rr(g, d * 9 - 4.5, -5 - lift, 9, 6, 2.5, footCol); });
  g.translate(0, bob);
  // body
  if (A) A.draw(g, P); else _generic(g, sp, P);
  // face
  let e = A ? A.eye : { y: b.shape === 'tall' ? -28 : -22, dx: 8.5, r: 4.4 };
  let style = e.style, mouth = A ? A.mouth : 'smile';
  if (!A) { if (fc.eyes === 'happy') style = 'happy'; if (fc.eyes === 'sleepy') mouth = 'flat'; if (fc.eyes === 'angry') mouth = 'frown'; else if (fc.eyes !== 'sleepy') mouth = fc.eyes === 'happy' ? 'open' : 'tongue'; }
  const bl = !!opts.blink;
  const mood = opts.mood; if (mood === 'scared') { style = 'white'; mouth = 'o'; } else if (mood === 'happy') { style = 'happy'; mouth = 'open'; }
  const er = mood === 'scared' ? e.r * 1.3 : e.r;
  [-1, 1].forEach(d => _eye(g, d * e.dx, e.y, er, style, mood ? false : (bl || (!A && fc.eyes === 'sleepy')), sp));
  if (mood === 'scared') _ell(g, e.dx + 9, e.y - e.r - 2, 1.8, 2.8, '#8fd8ff');
  if (!A && fc.eyes === 'angry' && !mood) { g.strokeStyle = INK; g.lineWidth = 2.4; g.lineCap = 'round'; [-1, 1].forEach(d => { g.beginPath(); g.moveTo(d * e.dx - d * 5, e.y - e.r - 3 - 2 * 0); g.lineTo(d * e.dx + d * 4, e.y - e.r + 0); g.stroke(); }); }
  if (A && key === 'donut') { /* donny's squiggle mouth sits between eyes */ }
  _mouth(g, mouth, 0, e.y + e.r * .6 + 1, key === 'coffee' ? 5 : mouth === 'grin' ? 3 : 3.6);
  if (!A && fc.blush) { g.fillStyle = 'rgba(255,110,160,.5)'; [-1, 1].forEach(d => { g.beginPath(); g.ellipse(d * (e.dx + 4), e.y + e.r + 2, 3.4, 2, 0, 0, 7); g.fill(); }); }
  // hands: dark floating stubby blocks at the sides, swinging
  const hp = A ? A.hand : [b.shape === 'square' ? 22 : 23, -16];
  [-1, 1].forEach((d, i) => {
    const sw = walking ? Math.sin(step + i * Math.PI) * 3 : Math.sin((opts.t || 0) * 2 + i) * 0;
    const hx = d * hp[0], hy = hp[1] + sw;
    g.save(); g.translate(hx, hy); g.rotate(d * .12);
    _rr(g, -4.5, -4.5, 9, 9, 3, handCol); _rr(g, -4.5, -4.5, 5, 4, 2, 'rgba(255,255,255,.18)'); g.restore();
  });
  g.restore();
}

// ---------- weapons ----------
function drawWeapon(g, kind, color, x, y, rot, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'star') {
    g.fillStyle = color; g.strokeStyle = _dark(color, .55); g.lineWidth = 1.8; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 5.5 : 12; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-3, -4, 2, 3.5, .6, 0, 7); g.fill();
  } else if (kind === 'chopsticks') {
    [[-3, 0], [2.5, .8]].forEach(([yy, tilt]) => { g.strokeStyle = _dark(color, .6); g.lineWidth = 4; g.beginPath(); g.moveTo(-13, yy); g.lineTo(13, yy + tilt); g.stroke(); g.strokeStyle = color; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-13, yy); g.lineTo(13, yy + tilt); g.stroke(); g.strokeStyle = '#2b2350'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-13, yy); g.lineTo(-9, yy); g.stroke(); });
  } else if (kind === 'slipper') {
    g.fillStyle = color; g.strokeStyle = _dark(color, .55); g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, 0, 13, 7, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(3, 0, 6, 3.4, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-5, -3, 4, 1.6, -.2, 0, 7); g.fill();
  } else if (kind === 'spoon') {
    g.strokeStyle = _dark(color, .6); g.lineWidth = 4.4; g.beginPath(); g.moveTo(-13, 0); g.lineTo(2, 0); g.stroke(); g.strokeStyle = color; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-13, 0); g.lineTo(2, 0); g.stroke();
    g.fillStyle = color; g.strokeStyle = _dark(color, .6); g.lineWidth = 1.8; g.beginPath(); g.ellipse(7, 0, 7, 5, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(5, -1.5, 3, 1.6, 0, 0, 7); g.fill();
  } else {
    // wooden Boomerang-Fu boomerang: fat chunky chevron, pale wood, dark grain band, outlined
    const wood = color || '#d9a05b', dk = _dark(wood, .5);
    const arms = () => { g.beginPath(); g.moveTo(-13, -8); g.quadraticCurveTo(-5, 2, -1, 6); g.quadraticCurveTo(5, 2, 13, -8); };
    g.strokeStyle = dk; g.lineWidth = 10.5; arms(); g.stroke();
    g.strokeStyle = wood; g.lineWidth = 7; arms(); g.stroke();
    g.strokeStyle = _dark(wood, .82); g.lineWidth = 2.4; g.beginPath(); g.moveTo(-1, 3); g.quadraticCurveTo(4, 1, 11, -6); g.stroke();
    g.strokeStyle = 'rgba(255,240,200,.65)'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-11, -8.5); g.quadraticCurveTo(-5, -1, -1.5, 2); g.stroke();
    g.strokeStyle = '#c44a3a'; g.lineWidth = 7; [[-9.4, -6.2, -7.6, -4.6], [9.4, -6.2, 7.6, -4.6]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  }
  g.restore();
}
