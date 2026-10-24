import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let server, base;
test.beforeAll(async () => {
  server = spawn(process.execPath, ['game/server/server.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CODEX_BIN: '/nonexistent/prompt-fu-browser-codex' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser test server did not start')), 5000);
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
});
test.afterAll(async () => {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  const timer = setTimeout(() => server.kill('SIGKILL'), 2000);
  await exited;
  clearTimeout(timer);
});

test('one host and two touch phones join, send controls and release slots', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  try {
    const host = await context.newPage();
    host.on('pageerror', error => errors.push(error.message));
    await host.goto(`${base}/?room=BROWSER`);
    await host.locator('#live').click();
    await host.locator('#fight').click();
    await expect.poll(() => host.evaluate(() => state)).toBe('play');
    const phones = [];
    for (const name of ['Toast', '<i>Boba</i>']) {
      const phone = await mobile.newPage();
      phone.on('pageerror', error => errors.push(error.message));
      await phone.goto(`${base}/phone.html?room=BROWSER`);
      await phone.getByPlaceholder('Your name').fill(name);
      await phone.getByRole('button', { name: 'JOIN', exact: true }).tap();
      await expect(phone.locator('#nm')).toHaveText(name);
      phones.push(phone);
    }
    await expect.poll(() => host.evaluate(() => PF.fighters.filter(f => f.net).length)).toBe(2);
    await expect(host.locator('#hud i')).toHaveCount(0);
    const phone = phones[0], session = await mobile.newCDPSession(phone);
    const touch = async (selector, xFraction = .5) => {
      const box = await phone.locator(selector).boundingBox();
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * xFraction, y: box.y + box.height / 2 }] });
    };
    const release = () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch('#stick', .9);
    await expect.poll(() => host.evaluate(() => Object.values(netIn).some(input => input.mx > .5))).toBe(true);
    await release();
    await expect.poll(() => host.evaluate(() => Object.values(netIn).every(input => input.mx === 0))).toBe(true);
    for (const [selector, key] of [['#bt', 'throw'], ['#bd', 'dash']]) {
      await touch(selector);
      await expect.poll(() => host.evaluate(key => Object.values(netIn).some(input => input[key]), key)).toBe(true);
      await release();
    }
    await phone.screenshot({ path: info.outputPath('phone-portrait.png') });
    await phone.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    await phone.setViewportSize({ width: 844, height: 390 });
    for (const selector of ['#stick', '#bt', '#bd']) {
      const box = await phone.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(845);
      expect(box.y + box.height).toBeLessThanOrEqual(391);
    }
    await phone.screenshot({ path: info.outputPath('phone-landscape.png') });
    await host.screenshot({ path: info.outputPath('host.png') });
    await phones[1].close();
    await expect.poll(() => host.evaluate(() => PF.fighters.filter(f => f.net).length)).toBe(1);
    expect(errors).toEqual([]);
  } finally { await mobile.close(); await context.close(); }
});

test('prompt text and room codes stay text throughout host screens', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?room=${encodeURIComponent('<i>ROOM</i>')}`);
  await expect(page.locator('#joinqr i')).toHaveCount(0);
  await page.locator('#mk').click();
  await page.locator('#ap').fill('<i>garden</i>');
  await page.locator('#ago').click();
  await expect(page.locator('#astat b')).toHaveText('<i>garden</i>');
  await expect(page.locator('#astat i')).toHaveCount(0);
  await page.locator('#next').click();
  await page.locator('#fp').fill('<i>toast</i>');
  await page.locator('#fgo').click();
  await expect(page.locator('#pv b')).toHaveText('<i>toast</i>');
  await expect(page.locator('#pv i')).toHaveCount(0);
  await expect(page.locator('#hud i')).toHaveCount(0);
  await page.locator('#fight').click();
  await expect(page.locator('#vsL')).toContainText('<i>toast</i>');
  await expect(page.locator('#vsL i')).toHaveCount(0);
  expect(errors).toEqual([]);
});
