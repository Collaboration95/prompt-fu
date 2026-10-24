import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fallbackSpec, sanitizeSpec, parseSpec } from '../game/server/server.mjs';

let child, base, port;
before(async () => {
  // An ephemeral port and absent CLI isolate checks from the live game and AI account.
  child = spawn(process.execPath, [new URL('../game/server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CODEX_BIN: '/nonexistent/prompt-fu-test-codex' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start')), 5000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); port = Number(match[1]); resolve(match[0]); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Test server exited: ${code}`)); });
  });
});
after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  await exited;
  clearTimeout(timer);
});
const post = (route, body) => fetch(base + route, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('fallback generation is deterministic and varies with the prompt', () => {
  for (const kind of ['fighter', 'arena']) {
    const spec = fallbackSpec(kind, 'dumpling ninja');
    assert.deepEqual(spec, fallbackSpec(kind, 'dumpling ninja'));
    assert.notDeepEqual(spec, fallbackSpec(kind, 'sleepy toast'));
    assert.equal(spec.fallback, true);
  }
});
test('model output is rebuilt from permitted fields with bounded text', () => {
  const defaults = fallbackSpec('fighter', 'toast');
  const spec = sanitizeSpec('fighter', {
    name: 'n'.repeat(100), body: { shape: 'script', color: '#ABCDEF', shade: 'url(secret)' },
    face: { eyes: 'unknown', blush: 'false' }, catchphrase: 'one two three four five six seven',
    unexpected: 'discard me',
  }, defaults);
  assert.equal(spec.name.length, 48);
  assert.equal(spec.body.shape, defaults.body.shape);
  assert.equal(spec.body.color, '#abcdef');
  assert.equal(spec.body.shade, defaults.body.shade);
  assert.equal(spec.face.blush, defaults.face.blush);
  assert.equal(spec.catchphrase, 'one two three four five six');
  assert.equal('unexpected' in spec, false);
  for (const value of [null, [], 'text', 1]) assert.throws(() => sanitizeSpec('fighter', value, defaults));
});
test('arena output clamps colors, decor and seed length', () => {
  const defaults = fallbackSpec('arena', 'garden');
  const spec = sanitizeSpec('arena', { grass: 'red', decor: 'invalid', seed: 'x'.repeat(200) }, defaults);
  assert.equal(spec.grass, defaults.grass);
  assert.equal(spec.decor, defaults.decor);
  assert.equal(spec.seed.length, 64);
});
test('parser accepts CLI JSON and fences, and rejects broken JSON', () => {
  assert.deepEqual(parseSpec('```json\n{"name":"Toast"}\n```'), { name: 'Toast' });
  assert.deepEqual(parseSpec('Result: {"name":"Toast"}'), { name: 'Toast' });
  assert.throws(() => parseSpec('not json'));
});
test('host and phone assets are served with expected types', async () => {
  for (const route of ['/', '/phone.html', '/js/core.js']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), route.endsWith('.js') ? /javascript/ : /html/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((await response.text()).length > 100);
  }
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
test('server source and local files cannot be fetched', async () => {
  for (const route of ['/server/server.mjs', '/.env', '/.git/config', '/%2eenv', '/..%2fpackage.json']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});
test('invalid generation requests fail without invoking AI', async () => {
  for (const body of [{}, null, { prompt: '' }, { prompt: ' ' }, { prompt: 4 }, { prompt: 'a'.repeat(2001) }]) {
    assert.equal((await post('/api/fighter', body)).status, 400);
  }
  assert.equal((await fetch(base + '/api/fighter')).status, 405);
  assert.equal((await post('/api/awards', { stats: [] })).status, 400);
  assert.equal((await fetch(base + '/api/arena', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await post('/api/arena', { prompt: 'a'.repeat(9000) })).status, 400);
});
test('missing CLI returns usable fighter, arena and awards fallbacks', async () => {
  for (const kind of ['fighter', 'arena']) {
    const response = await post(`/api/${kind}`, { prompt: 'dumpling ninja' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-generation-model'), 'fallback');
    assert.deepEqual(await response.json(), fallbackSpec(kind, 'dumpling ninja'));
  }
  const awards = await post('/api/awards', { stats: [{ name: 'Toast', wins: 3 }] });
  assert.deepEqual(await awards.json(), { awards: [], fallback: true });
});

// Minimal browser-style masked text client, so Node 20 needs no WebSocket dependency.
function connect(role, room = 'TEST') {
  const socket = createConnection({ host: '127.0.0.1', port });
  let buffer = Buffer.alloc(0), upgraded = false, received = 0;
  const inbox = [], waiters = [];
  socket.on('error', () => {});
  socket.on('connect', () => socket.write(
    `GET /ws?room=${room}&role=${role} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\n\r\n`));
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!upgraded) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      assert.match(buffer.subarray(0, end).toString(), /^HTTP\/1.1 101 /);
      buffer = buffer.subarray(end + 4); upgraded = true;
    }
    while (buffer.length >= 2) {
      let length = buffer[1] & 127, offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      if (buffer.length < offset + length) return;
      const message = JSON.parse(buffer.subarray(offset, offset + length).toString());
      received++;
      buffer = buffer.subarray(offset + length);
      const pending = waiters.shift();
      if (pending) pending(message); else inbox.push(message);
    }
  });
  return {
    close: () => socket.destroy(),
    next: () => inbox.length ? Promise.resolve(inbox.shift()) : new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WebSocket ${role} timed out after ${received} messages`)), 3000);
      waiters.push(message => { clearTimeout(timer); resolve(message); });
    }),
    send(message) {
      const data = Buffer.from(JSON.stringify(message)), mask = randomBytes(4);
      const head = data.length < 126 ? Buffer.from([0x81, 0x80 | data.length]) : Buffer.from([0x81, 0xfe, data.length >> 8, data.length & 255]);
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      socket.write(Buffer.concat([head, mask, data]));
    },
  };
}
test('room relay routes two phone inputs and targeted host replies', async t => {
  const host = connect('host');
  t.after(() => host.close());
  assert.equal((await host.next()).type, 'hello');
  const first = connect('phone'), second = connect('phone');
  t.after(() => { first.close(); second.close(); });
  const a = await first.next(), b = await second.next();
  assert.equal(a.host, true);
  assert.notEqual(a.id, b.id);
  first.send({ type: 'join', name: 'Toast', from: 'spoofed' });
  assert.deepEqual(await host.next(), { type: 'join', name: 'Toast', from: a.id });
  second.send({ type: 'input', mx: 1, throw: true });
  assert.deepEqual(await host.next(), { type: 'input', mx: 1, throw: true, from: b.id });
  host.send({ to: b.id, type: 'state', msg: 'ready' });
  assert.deepEqual(await second.next(), { type: 'state', msg: 'ready' });
  host.send({ type: 'round', n: 2 });
  assert.deepEqual(await first.next(), { type: 'round', n: 2 });
  assert.deepEqual(await second.next(), { type: 'round', n: 2 });
  first.close();
  assert.deepEqual(await host.next(), { type: 'leave', from: a.id });
  host.close();
  assert.deepEqual(await second.next(), { type: 'host', online: false });
});
