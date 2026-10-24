// Host-side networking for Prompt Fu. window.NET
(() => {
  const cb = { join: [], input: [], leave: [], fighter: [] };
  let ws, room = '', wsUrl = '', wantOpen = false, url = null;
  const qp = new URLSearchParams(location.search);
  const defaultWs = () => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const emit = (k, ...a) => cb[k].forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  const qrReady = new Promise(res => {
    if (window.qrcode) return res();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = res; s.onerror = res; document.head.appendChild(s);
  });
  function open() {
    ws = new WebSocket(`${wsUrl}?room=${encodeURIComponent(room)}&role=host`);
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      const id = m.from;
      if (m.type === 'join') emit('join', id, m.name || 'Player');
      else if (m.type === 'input') emit('input', id, { mx: +m.mx || 0, my: +m.my || 0, throw: !!m.throw, dash: !!m.dash });
      else if (m.type === 'leave') emit('leave', id);
      else if (m.type === 'fighter') emit('fighter', id, String(m.prompt || ''));
    };
    ws.onclose = () => { if (wantOpen) setTimeout(open, 1000); };
  }
  window.NET = {
    connect(wsU, roomCode) {
      room = String(roomCode).toUpperCase();
      wsUrl = wsU || qp.get('ws') || defaultWs();
      wantOpen = true; open();
      const base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
      url = `${base}phone.html?room=${encodeURIComponent(room)}&ws=${encodeURIComponent(wsUrl)}`;
      return url;
    },
    get phoneUrl() { return url; },
    onJoin: f => cb.join.push(f), onInput: f => cb.input.push(f),
    onLeave: f => cb.leave.push(f), onFighterPrompt: f => cb.fighter.push(f),
    send(to, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(to == null ? msg : { ...msg, to })); },
    // Returns a canvas immediately; QR is drawn once the lib has loaded. Defaults to phoneUrl.
    qrCanvas(u, size = 220) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      qrReady.then(() => {
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
        if (!window.qrcode) { g.fillStyle = '#2b2350'; g.font = '12px sans-serif'; g.fillText('QR unavailable', 10, size / 2); return; }
        const q = window.qrcode(0, 'M'); q.addData(u || url); q.make();
        const n = q.getModuleCount(), cell = Math.floor(size / (n + 4)), off = Math.floor((size - cell * n) / 2);
        g.fillStyle = '#2b2350';
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
      });
      return c;
    },
  };
})();
