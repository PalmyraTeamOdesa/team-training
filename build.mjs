import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({ entryPoints: ['src/vendor.js'], bundle: true, format: 'iife', globalName: 'supabase', minify: true, outfile: `${out}/vendor.js`, target: 'es2020' });

const order = ['config.js', 'core.js', 'fooddb.js', 'num.js', 'plan.js', 'app.js', 'data.js', 'auth.js', 'athlete.js', 'files.js', 'team.js', 'food.js', 'prog.js', 'coach.js', 'sections.js', 'people.js', 'onb.js', 'misc.js'];
const js = order.map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join('src', f), 'utf8')).join('\n');
fs.writeFileSync(`${out}/app.js`, js);
fs.copyFileSync('src/style.css', `${out}/style.css`);
for (const f of fs.readdirSync('public')) fs.cpSync(path.join('public', f), path.join(out, f), { recursive: true });

// hash includes public assets (icons, manifest) so the service-worker cache changes when they do
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]).sort();
const h = crypto.createHash('sha256').update(js + fs.readFileSync('src/style.css') + fs.readFileSync(`${out}/vendor.js`));
for (const f of walk('public')) h.update(f).update(fs.readFileSync(f));
const hash = h.digest('hex').slice(0, 10);
const hasLogo = fs.existsSync('public/icons/logo-256.png');
for (const f of ['index.html', 'sw.js']) {
  const p = path.join(out, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__BUILD__', hash).replaceAll('__HAS_LOGO__', String(hasLogo)));
}
console.log('built', hash, (js.length / 1024).toFixed(0) + ' KB app');
