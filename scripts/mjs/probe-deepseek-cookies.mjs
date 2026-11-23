// scripts/mjs/probe-deepseek-cookies.mjs
/**
 * @name probe-deepseek-cookies
 * @purpose Снимок куки профиля (через cookieTracker) → таблица в stdout + JSON в /tmp/wm-cookie-snapshots/
 * @input argv: [--profile <id>] [--domains deepseek,giga,alice]; env: WM_USER_DATA (default ~/.config/wetothemoon-electron)
 * @output stdout: таблица cookies (src/name/domain/hOnly/secure/hash/expires); файл: /tmp/wm-cookie-snapshots/cookies-<id>-<ts>.json
 * @args { "type": "object", "properties": { "profile": { "type": "string" }, "domains": { "type": "string", "default": "deepseek" } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — реестр не найден / профиль не найден
 * @tool false
 * @example node --import tsx scripts/mjs/probe-deepseek-cookies.mjs --domains deepseek,giga
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USER_DATA = process.env.WM_USER_DATA
  ?? path.join(os.homedir(), '.config', 'wetothemoon-electron');
const REGISTRY = path.join(USER_DATA, 'gateway-profiles.json');
const PROFILES_ROOT = path.join(USER_DATA, 'profiles');

const args = process.argv.slice(2);
const arg = (k, def) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const profileArg = arg('--profile', null);
const domains = arg('--domains', 'deepseek').split(',').map(s => s.trim()).filter(Boolean);

if (!fs.existsSync(REGISTRY)) {
  console.error('❌ Реестр не найден:', REGISTRY);
  process.exit(1);
}
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const profileId = profileArg ?? registry.activeId;
const profile = registry.profiles.find(p => p.id === profileId);
if (!profile) {
  console.error('❌ Профиль не найден:', profileId);
  console.error('   Доступные:', registry.profiles.map(p => `${p.id} (${p.name})`).join(', '));
  process.exit(1);
}

const dir = path.join(PROFILES_ROOT, profile.dirName);
const sourcePaths = {
  profileId: profile.id,
  storagePath: path.join(dir, 'storage.json'),
  cookiesPath: path.join(dir, 'cookies.json'),
  yandexCookiesDb: path.join(dir, 'yandex-profile', 'Default', 'Cookies'),
  chromeCookiesDb: path.join(dir, 'chrome-profile', 'Default', 'Cookies'),
};

const trackerUrl = pathToFileURL(
  path.join(PROJECT_ROOT, 'src', 'main', 'services', 'gateway', 'cookieTracker.ts'),
).href;
const { trackDeepSeekCookies } = await import(trackerUrl);

const snap = await trackDeepSeekCookies(sourcePaths, { domains });

console.log(`\n🍪 Профиль: ${profile.name}  (${profile.id})`);
console.log(`   kind: ${profile.browserKind ?? 'yandex'}  cdpPort: ${profile.cdpPort}  dir: ${profile.dirName}`);
console.log(`   снимок: ${new Date(snap.takenAt).toISOString()}  domains: ${domains.join(', ')}\n`);

if (snap.cookies.length === 0) {
  console.log('   ⚠ Куки не найдены. Проверь пути:');
  console.log('     ' + Object.entries(sourcePaths).filter(([k]) => k !== 'profileId').map(([k, v]) => `${k}: ${fs.existsSync(v) ? '✓' : '✗'} ${v}`).join('\n     '));
} else {
  const cols = [
    ['src', 14], ['name', 28], ['domain', 26],
    ['hOnly', 5], ['secure', 6], ['valueHash', 16], ['expires', 22],
  ];
  const line = (cells) => '  ' + cells.map(([v, w]) => String(v).padEnd(w)).join('  ');
  console.log(line(cols.map(([n, w]) => [n, w])));
  console.log('  ' + '-'.repeat(cols.reduce((s, [, w]) => s + w + 2, 0)));
  for (const c of snap.cookies) {
    const exp = c.expires ? new Date(c.expires).toISOString().slice(0, 19) : '(session)';
    console.log(line([
      [c.source, 14], [c.name, 28], [c.domain, 26],
      [c.httpOnly ? 'yes' : 'no', 5], [c.secure ? 'yes' : 'no', 6],
      [c.valueHash, 16], [exp, 22],
    ]));
  }
}

const outDir = path.join(os.tmpdir(), 'wm-cookie-snapshots');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `cookies-${profile.id}-${Date.now()}.json`);
fs.writeFileSync(outPath, JSON.stringify(snap, null, 2));
console.log(`\n💾 Снимок: ${outPath}`);