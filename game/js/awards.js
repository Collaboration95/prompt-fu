// Prompt Fu: per-fighter match stats + end-of-match podium with funny awards.
(function () {
  const API = (typeof window.PF_API === 'string' ? window.PF_API : '') + '/api/awards';
  const blank = () => ({ throws: 0, bonks: 0, deaths: 0, dashes: 0, powerups: 0, bush: 0 });
  const st = f => f.st || (f.st = blank());
  const PF = window.PF = {
    stat(f, k, n = 1) { if (f) st(f)[k] += n; },
    bush(f, dt) { if (f && typeof inBush === 'function' && inBush(f.x, f.y)) st(f).bush += dt; },
    reset(fs) { fs.forEach(f => f.st = blank()); },
  };
  const DEFS = [
    { k: 'bush', e: '🌿', t: 'Bush Goblin', sc: v => v / 8, ln: v => `hid ${Math.round(v)} s`, min: 3 },
    { k: 'throws', e: '🪃', t: 'Boomerang Hoarder', sc: v => v / 10, ln: v => `${v} throws` , min: 3 },
    { k: 'dashes', e: '💨', t: 'Dash Addict', sc: v => v / 8, ln: v => `${v} dashes`, min: 2 },
    { k: 'bonks', e: '🔨', t: 'Bonk Machine', sc: v => v / 4, ln: v => `${v} bonks`, min: 2 },
    { k: 'deaths', e: '🎯', t: 'Professional Target', sc: v => v / 4, ln: v => `bonked ${v} times`, min: 2 },
    { k: 'powerups', e: '⚡', t: 'Power-Up Piggy', sc: v => v / 3, ln: v => `${v} power-ups`, min: 1 },
  ];
  function localAwards(list) {
    const pairs = [];
    list.forEach((f, i) => {
      const s = st(f);
      DEFS.forEach((d, j) => { if (s[d.k] >= d.min) pairs.push({ i, j, sc: d.sc(s[d.k]) }); });
      if (s.bonks === 0) pairs.push({ i, j: 'pac', sc: 1.2 });
      if (s.deaths === 0) pairs.push({ i, j: 'unt', sc: 1.1 });
    });
    pairs.sort((a, b) => b.sc - a.sc);
    const out = [], usedF = new Set(), usedA = new Set();
    pairs.forEach(p => { if (usedF.has(p.i) || usedA.has(p.j)) return; usedF.add(p.i); usedA.add(p.j); out[p.i] = p.j === 'pac' ? { e: '😇', t: 'Pacifist', l: '0 bonks. Pure vibes.' } : p.j === 'unt' ? { e: '🛡️', t: 'Untouchable', l: 'never got bonked' } : { e: DEFS[p.j].e, t: DEFS[p.j].t, l: DEFS[p.j].ln(Math.round(st(list[p.i])[DEFS[p.j].k])) }; });
    list.forEach((f, i) => { if (!out[i]) out[i] = { e: '🎖️', t: 'Participation Hero', l: 'showed up, threw stuff' }; });
    return out;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let ov = null, timer = 0, raf = 0;
  function close() { clearTimeout(timer); cancelAnimationFrame(raf); if (ov) ov.remove(); ov = null; }
  function css() {
    if (document.getElementById('pf-css')) return;
    const s = document.createElement('style'); s.id = 'pf-css';
    s.textContent = `#pfPod{position:fixed;inset:0;z-index:9999;background:rgba(43,35,80,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Fredoka,sans-serif;color:#2b2350;overflow:hidden;animation:pfIn .35s ease-out}
@keyframes pfIn{from{opacity:0;transform:scale(1.08)}}
#pfPod h1{font-family:'Titan One',sans-serif;font-weight:400;color:#fff8ec;font-size:44px;margin:0 0 6px;text-shadow:0 4px 0 #ff8a3d}
#pfPod .steps{display:flex;align-items:flex-end;gap:10px;margin:122px 0 14px}
#pfPod .step{width:128px;background:#ff8a3d;border:4px solid #2b2350;border-bottom:none;border-radius:16px 16px 0 0;text-align:center;color:#fff8ec;font-family:'Titan One';position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:6px;box-shadow:0 6px 0 #2b2350}
#pfPod .step canvas{position:absolute;top:-112px;width:110px;height:110px}
#pfPod .step b{font-size:34px;line-height:1}#pfPod .step small{font:700 14px Fredoka;color:#fff8ec}
#pfPod .cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:900px}
#pfPod .card{background:#fff8ec;border:4px solid #2b2350;border-radius:18px;padding:8px 14px;width:200px;box-shadow:0 5px 0 #ff8a3d;animation:pfPop .5s backwards}
@keyframes pfPop{from{transform:translateY(30px) scale(.8);opacity:0}}
#pfPod .card .n{font:700 13px Fredoka;opacity:.7}#pfPod .card .t{font:20px 'Titan One';color:#2b2350;line-height:1.15}
#pfPod .card .l{font:500 14px Fredoka;margin-top:2px}#pfPod canvas.cf{position:absolute;inset:0;pointer-events:none}`;
    document.head.appendChild(s);
  }
  function confetti(cv) {
    const c = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight, cols = ['#ff8a3d', '#fff8ec', '#ffd23f', '#7fd8ff', '#ff6b9d', '#8be28b'];
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 4, r: Math.random() * 6, w: 6 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
    (function tick() { c.clearRect(0, 0, W, H); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += .15; if (p.y > H) { p.y = -10; p.x = Math.random() * W; } c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.w / 2, -3, p.w, 6); c.restore(); }); raf = requestAnimationFrame(tick); })();
  }
  function portrait(f, size) { const c = document.createElement('canvas'); c.width = c.height = size * 2; const g = c.getContext('2d'); g.scale(2, 2); drawFighter(g, { spec: f.spec, i: f.i || 0 }, size / 2, size * .86, size / 60, { face: 1 }); return c; }
  PF.podium = function (fighters, ms = 8000) {
    close(); css();
    const list = fighters.filter(f => !f.empty && f.spec);
    list.forEach(st);
    const rank = list.map((f, i) => i).sort((a, b) => (list[b].wins - list[a].wins) || (st(list[b]).bonks - st(list[a]).bonks) || (st(list[a]).deaths - st(list[b]).deaths));
    const aw = localAwards(list);
    ov = document.createElement('div'); ov.id = 'pfPod';
    ov.innerHTML = '<h1>🏆 PODIUM 🏆</h1><div class="steps"></div><div class="cards"></div>';
    const steps = ov.querySelector('.steps'), cards = ov.querySelector('.cards');
    const top = rank.slice(0, 3), order = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i), hs = [150, 110, 80];
    order.forEach(pos => {
      const f = list[top[pos]], d = document.createElement('div'); d.className = 'step'; d.style.height = hs[pos] + 'px';
      d.appendChild(portrait(f, 110)); d.insertAdjacentHTML('beforeend', `<b>${['🥇', '🥈', '🥉'][pos]}</b><small>${esc(f.spec.name)} · ${f.wins} win${f.wins === 1 ? '' : 's'}</small>`); steps.appendChild(d);
    });
    const nodes = list.map((f, i) => {
      const d = document.createElement('div'); d.className = 'card'; d.style.animationDelay = (.4 + i * .15) + 's';
      d.innerHTML = `<div class="n">${esc(f.spec.name)}</div><div class="t">${aw[i].e} ${esc(aw[i].t)}</div><div class="l">${esc(aw[i].l)}</div>`; cards.appendChild(d); return d;
    });
    const cf = document.createElement('canvas'); cf.className = 'cf'; ov.appendChild(cf); document.body.appendChild(ov); confetti(cf);
    timer = setTimeout(close, ms);
    // Upgrade with AI-written titles if the server answers in time.
    const stats = list.map(f => { const s = st(f); return { name: f.spec.name, wins: f.wins, throws: s.throws, bonks: s.bonks, deaths: s.deaths, dashes: s.dashes, powerups: s.powerups, bushSeconds: Math.round(s.bush) }; });
    const ac = new AbortController(), my = ov, to = setTimeout(() => ac.abort(), 8000);
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stats }), signal: ac.signal })
      .then(r => r.json()).then(j => {
        if (ov !== my || !Array.isArray(j.awards)) return;
        j.awards.forEach(a => { const i = list.findIndex(f => f.spec.name === a.name); if (i < 0 || !a.title) return; nodes[i].innerHTML = `<div class="n">${esc(a.name)}</div><div class="t">${esc(a.emoji || '🎖️')} ${esc(a.title)}</div><div class="l">${esc(a.line || '')}</div>`; });
      }).catch(() => {}).finally(() => clearTimeout(to));
  };
  window.PF_testPodium = function () {
    const base = (typeof fighters !== 'undefined' ? fighters : []).filter(f => f.spec);
    const fake = base.slice(0, 4).map((f, i) => ({ spec: f.spec, i, wins: [3, 2, 1, 0][i], st: [{ throws: 24, bonks: 7, deaths: 2, dashes: 5, powerups: 2, bush: 3 }, { throws: 9, bonks: 3, deaths: 4, dashes: 31, powerups: 0, bush: 12 }, { throws: 12, bonks: 1, deaths: 6, dashes: 3, powerups: 4, bush: 41 }, { throws: 4, bonks: 0, deaths: 7, dashes: 2, powerups: 0, bush: 1 }][i] }));
    PF.podium(fake, 30000);
  };
})();
