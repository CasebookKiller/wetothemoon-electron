// scripts/mjs/migrate-profile-browser.mjs
/**
 * @name migrate-profile-browser
 * @purpose Переключение профиля Gateway между yandex и chrome (browserKind/chromeCdpPort) + бэкап gateway-profiles.json
 * @input argv: --to {chrome|yandex} (обязателен), --id <profileId> (default "default"), --dry-run
 * @output изменение ~/.config/wetothemoon-electron/gateway-profiles.json + .bak-<ts>; stdout: before/after
 * @args { "type": "object", "properties": { "to": { "enum": ["chrome", "yandex"] }, "id": { "type": "string", "default": "default" }, "dryRun": { "type": "boolean", "default": false } }, "required": ["to"] }
 * @result null
 * @exit 0 — успех / --help / --dry-run
 * @exit 1 — нет --to / --to не из {chrome,yandex} / реестр не найден / профиль не найден
 * @tool false
 * @example node scripts/mjs/migrate-profile-browser.mjs --to chrome --id p_xxx --dry-run
 */
// Переводит профиль Gateway между yandex и chrome.
// Использование:
//   node scripts/mjs/migrate-profile-browser.mjs --to chrome --dry-run
//   node scripts/mjs/migrate-profile-browser.mjs --to chrome
//   node scripts/mjs/migrate-profile-browser.mjs --to chrome --id p_xxx
//   node scripts/mjs/migrate-profile-browser.mjs --to yandex
// Делает бэкап gateway-profiles.json перед записью.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const out = { to: null, id: 'default', dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to') out.to = argv[++i];
    else if (a === '--id') out.id = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.to || !['yandex', 'chrome'].includes(args.to)) {
  console.log('Использование:');
  console.log('  node scripts/migrate-profile-browser.mjs --to chrome [--id <id>] [--dry-run]');
  console.log('  node scripts/migrate-profile-browser.mjs --to yandex [--id <id>] [--dry-run]');
  process.exit(args.help ? 0 : 1);
}

const USER_DATA = path.join(os.homedir(), '.config/wetothemoon-electron');
const REGISTRY  = path.join(USER_DATA, 'gateway-profiles.json');
if (!fs.existsSync(REGISTRY)) { console.error('❌ нет', REGISTRY); process.exit(1); }

const j = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const target = (j.profiles || []).find(p => p.id === args.id);
if (!target) {
  console.error('❌ профиль не найден:', args.id);
  console.error('   доступные:', (j.profiles || []).map(p => p.id).join(', '));
  process.exit(1);
}

const before = {
  id: target.id, name: target.name,
  browserKind: target.browserKind ?? '(нет = yandex)',
  cdpPort: target.cdpPort,
  chromeCdpPort: target.chromeCdpPort ?? '(нет)',
};
const after = { ...before };
if (args.to === 'chrome') {
  after.browserKind = 'chrome';
  after.chromeCdpPort = target.cdpPort + 100;
} else {
  after.browserKind = 'yandex';
  after.chromeCdpPort = '(удалить)';
}

console.log('📋 Профиль:', target.id, '(' + target.name + ')');
console.log('   было:  ', before);
console.log('   станет:', after);

if (args.dryRun) { console.log('\n🔍 --dry-run: файл не изменён.'); process.exit(0); }

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakPath = REGISTRY + '.bak-' + ts;
fs.copyFileSync(REGISTRY, bakPath);
console.log('\n💾 бэкап:', bakPath);

if (args.to === 'chrome') {
  target.browserKind = 'chrome';
  target.chromeCdpPort = target.cdpPort + 100;
} else {
  target.browserKind = 'yandex';
  delete target.chromeCdpPort;
}
fs.writeFileSync(REGISTRY, JSON.stringify(j, null, 2));
console.log('✅ записано');

if (args.to === 'chrome') {
  const chromeDir = path.join(USER_DATA, 'profiles', target.dirName, 'chrome-profile');
  const isEmpty = !fs.existsSync(chromeDir) || fs.readdirSync(chromeDir).length === 0;
  console.log('\n➡  Профиль', target.id, '→ Chrome (patchright).');
  console.log('   При следующем `npm start` в UI Gateway выберите "' + target.name + '".');
  console.log('   Откроется Chrome с профилем:');
  console.log('   ' + chromeDir);
  if (isEmpty) {
    console.log('\n   ⚠️  Профиль ПУСТОЙ — DeepSeek покажет /sign_in.');
    console.log('       Войдите руками (email/пароль или Google). Один раз.');
    console.log('       WAF выдаст новый aws-waf-token под Chrome-fingerprint.');
  } else {
    console.log('\n   ✅ Профиль уже существует, данные есть.');
  }
  console.log('\n   Откат: node scripts/migrate-profile-browser.mjs --to yandex --id ' + target.id);
} else {
  console.log('\n➡  Профиль', target.id, '→ Yandex.');
  console.log('   Yandex-сессия в yandex-profile/ не тронута.');
}
