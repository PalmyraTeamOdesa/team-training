import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({ entryPoints: ['src/vendor.js'], bundle: true, format: 'iife', globalName: 'supabase', minify: true, outfile: `${out}/vendor.js`, target: 'es2020' });

const order = ['config.js', 'core.js', 'fooddb.js', 'num.js', 'plan.js', 'app.js', 'data.js', 'auth.js', 'athlete.js', 'files.js', 'team.js', 'food.js', 'prog.js', 'coach.js', 'sections.js', 'onb.js', 'misc.js'];
const js = order.map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join('src', f), 'utf8')).join('\n');
fs.writeFileSync(`${out}/app.js`, js);
fs.copyFileSync('src/style.css', `${out}/style.css`);
for (const f of fs.readdirSync('public')) fs.cpSync(path.join('public', f), path.join(out, f), { recursive: true });

const hash = crypto.createHash('sha256').update(js + fs.readFileSync('src/style.css') + fs.readFileSync(`${out}/vendor.js`)).digest('hex').slice(0, 10);
for (const f of ['index.html', 'sw.js']) {
  const p = path.join(out, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__BUILD__', hash));
}
console.log('built', hash, (js.length / 1024).toFixed(0) + ' KB app');
