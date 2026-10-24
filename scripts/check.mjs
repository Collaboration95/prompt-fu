import { readdir, readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
let checked = 0;
async function walk(dir) {
  for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { await walk(relative); continue; }
    const file = resolve(root, relative), ext = extname(file);
    if (ext === '.js' || ext === '.mjs') {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${relative}`);
      checked++;
    } else if (ext === '.html') {
      const html = await readFile(file, 'utf8');
      for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
        if (/\bsrc\s*=/.test(match[1])) continue;
        new Script(match[2], { filename: `${relative}:inline-${index + 1}` });
        checked++;
      }
    }
  }
}
for (const dir of ['game', 'scripts', 'test']) await walk(dir);
console.log(`Syntax checks passed (${checked} scripts, including inline browser code).`);
