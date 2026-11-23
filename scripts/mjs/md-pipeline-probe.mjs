// scripts/mjs/md-pipeline-probe.mjs
/**
 * @name md-pipeline-probe
 * @purpose Полный probe пайплайна: IDB PW → PW DOM → gateway.db → GW DOM по MATCH_TEXT, дumps в md-recon/pipeline/
 * @input env: MATCH_TEXT (обязателен), PROFILE_ID, PW_CDP (auto из gateway-profiles.json cdpPort), GW_CDP (default :9223), GW_DB (auto)
 * @output md-recon/pipeline/{A-indexeddb-raw,B-pw-fullhtml,C-db-html,D-gw-dom}.{json,html}; stdout: цепочка
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет gateway-profiles.json / MATCH_TEXT / нет вкладки deepseek.com
 * @tool false
 * @example MATCH_TEXT="код" node scripts/mjs/md-pipeline-probe.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

// ─── АВТО-ОПРЕДЕЛЕНИЕ ПОРТОВ ─────────────────────────────────
const USER_DATA = path.join(os.homedir(), '.config', 'wetothemoon-electron');
let profileCfg;
try {
  profileCfg = JSON.parse(
    fs.readFileSync(path.join(USER_DATA, 'gateway-profiles.json'), 'utf8')
  );
} catch (e) {
  console.error('❌ Не найден gateway-profiles.json:', e.message);
  process.exit(1);
}
const activeId = profileCfg.activeId;
const activeProfile = profileCfg.profiles.find((p) => p.id === activeId);
if (!activeProfile) {
  console.error('❌ Активный профиль не найден:', activeId);
  process.exit(1);
}

// Можно переопределить через env (если нужно снять с неактивного профиля)
const PROFILE_ID = process.env.PROFILE_ID || activeId;
const targetProfile = profileCfg.profiles.find((p) => p.id === PROFILE_ID) || activeProfile;

const PW_CDP = process.env.PW_CDP || `http://127.0.0.1:${targetProfile.cdpPort}`;
const GW_CDP = process.env.GW_CDP || 'http://127.0.0.1:9223';

console.log(`📋 Активный профиль: ${activeProfile.name} (${activeProfile.id})`);
console.log(`📋 Целевой профиль:  ${targetProfile.name} (${targetProfile.id})`);
console.log(`📋 PW CDP:           ${PW_CDP}`);
console.log(`📋 GW CDP:           ${GW_CDP}`);

const MATCH = process.env.MATCH_TEXT || '';
if (!MATCH) { console.error('❌ MATCH_TEXT обязателен'); process.exit(1); }

const OUT_DIR = 'md-recon/pipeline';
fs.mkdirSync(OUT_DIR, { recursive: true });

const metric = (html) => {
  const c = (re) => ((html || '').match(re) || []).length;
  return {
    length: (html || '').length,
    dsParagraphs: c(/ds-markdown-paragraph/g),
    mdCodeBlocks: c(/md-code-block/g),
    tokens: c(/class="token/g),
    katex: c(/katex/g),
    pre: c(/<pre/gi), code: c(/<code/gi), table: c(/<table/gi),
    ol: c(/<ol/gi), ul: c(/<ul/gi), li: c(/<li/gi),
    h1: c(/<h1/gi), h2: c(/<h2/gi), h3: c(/<h3/gi),
    strong: c(/<strong/gi), em: c(/<em/gi), a: c(/<a /gi), img: c(/<img/gi),
  };
};

const save = (name, html, extra = {}) => {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), html || '');
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify({
    source: name, metrics: metric(html), ...extra, capturedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`  ✅ ${name}: len=${(html||'').length}`, metric(html));
};

// ---------- A) IndexedDB PW ----------
async function dumpIndexedDb(page) {
  console.log('📦 A) IndexedDB...');
  const raw = await page.evaluate(async (match) => {
    const openDb = (name) => new Promise((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const allStores = (db) => Array.from(db.objectStoreNames);

    // Пробуем самые вероятные имена
    for (const dbName of ['deepseek-chat', 'deepseek_chat', 'deepseek']) {
      let db; try { db = await openDb(dbName); } catch { continue; }
      const stores = allStores(db);
      const result = { dbName, stores: {}, matched: null };

      for (const s of stores) {
        try {
          const rows = await new Promise((res, rej) => {
            const tx = db.transaction(s, 'readonly');
            const req = tx.objectStore(s).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          result.stores[s] = rows.length;
          for (const r of rows) {
            const txt = r?.content || r?.text || r?.message?.content || '';
            if (txt && String(txt).includes(match)) {
              result.matched = { store: s, row: r };
              break;
            }
          }
        } catch (e) { result.stores[s] = `err: ${e.message}`; }
      }
      db.close();
      if (result.matched) return result;
    }
    return { error: 'IndexedDB: совпадение не найдено' };
  }, MATCH);

  if (raw.error) { console.log('  ⚠️', raw.error); return null; }
  save('A-indexeddb-raw', JSON.stringify(raw.matched.row, null, 2),
       { store: raw.matched.store, dbName: raw.dbName });
  return raw.matched.row;
}

// ---------- B) fullHtml из DOM PW ----------
async function dumpPwFullHtml(page) {
  console.log('🌐 B) fullHtml (PW DOM)...');
  const found = await page.evaluate((match) => {
    const nodes = [];
    document.querySelectorAll('.ds-markdown').forEach((el) => {
      const txt = el.textContent || '';
      if (!txt.includes(match)) return;
      nodes.push({ html: el.outerHTML, textPreview: txt.slice(0, 200) });
    });
    return nodes.length ? nodes[nodes.length - 1] : null;
  }, MATCH);
  if (!found) { console.log('  ⚠️ не найдено'); return null; }
  save('B-pw-fullhtml', found.html, { textPreview: found.textPreview });
  return found.html;
}

// ---------- C) DB content_html ----------
function dumpDb() {
  console.log('💾 C) DB content_html...');
  const dbPath = process.env.GW_DB
    || ['/home/' + os.userInfo().username + '/.config/wetothemoon-electron/gateway.db']
        .find((p) => fs.existsSync(p));
  if (!dbPath) { console.log('  ⚠️ DB не найдена, задай GW_DB='); return null; }

  const db = new DatabaseSync(dbPath);
  const row = db.prepare(
    `SELECT id, role, content_html, content_plain, saved_at, profile_id
    FROM messages
    WHERE role='assistant' AND profile_id = ? AND content_plain LIKE ?
    ORDER BY id DESC LIMIT 1`
  ).get(targetProfile.id, `%${MATCH}%`);
  db.close();
  if (!row) { console.log('  ⚠️ не найдено'); return null; }
  save('C-db-html', row.content_html, {
    messageId: row.id, savedAt: row.saved_at,
    plainPreview: (row.content_plain || '').slice(0, 200),
  });
  return row.content_html;
}

// ---------- D) GW DOM ----------
async function dumpGwDom() {
  console.log('🖥  D) GW DOM...');
  let browser;
  try { browser = await chromium.connectOverCDP(GW_CDP); }
  catch (e) {
    console.log('  ⚠️ GW CDP недоступен (9223). Запусти с GW_REMOTE_DEBUG=9223 npm run dev');
    return null;
  }
  let page = null;
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) {
    const u = p.url();
    if (u.includes('localhost') || u.includes('index.html')) page = p;
  }
  if (!page) { console.log('  ⚠️ renderer не найден'); await browser.close(); return null; }

  const found = await page.evaluate((match) => {
    // В GW markdown-контейнеры сохраняют DS-классы — ищем по ним же
    const seen = new Set();
    const roots = [];
    document.querySelectorAll('.ds-markdown, .ds-markdown-paragraph, [class*="markdown"]').forEach((p) => {
      let el = p;
      while (el && !(el.className?.toString?.().match?.(/(ds-markdown|markdown-body|message-content)/))) el = el.parentElement;
      if (!el || seen.has(el)) return;
      seen.add(el);
      const txt = el.textContent || '';
      if (!txt.includes(match)) return;
      roots.push({ html: el.outerHTML, textPreview: txt.slice(0, 200) });
    });
    return roots.length ? roots[roots.length - 1] : null;
  }, MATCH);

  await browser.close();
  if (!found) { console.log('  ⚠️ в GW не найдено'); return null; }
  save('D-gw-dom', found.html, { textPreview: found.textPreview });
  return found.html;
}

// ---------- run ----------
console.log(`🔍 MATCH_TEXT="${MATCH}"\n`);

const pw = await chromium.connectOverCDP(PW_CDP);
const version = await fetch(`${PW_CDP}/json/version`).then(r => r.json());

// Достаём URL первой вкладки — по нему видно, какой аккаунт
let pwPage = null;
for (const ctx of pw.contexts()) for (const p of ctx.pages())
  if (p.url().includes('deepseek.com')) pwPage = p;

if (!pwPage) { console.error('❌ нет вкладки deepseek.com'); await pw.close(); process.exit(1); }

const pageUrl = pwPage.url();
const pageTitle = await pwPage.title();
console.log(`✅ PW подключён: ${version.Browser}`);
console.log(`   URL:   ${pageUrl}`);
console.log(`   Title: ${pageTitle}`);
console.log(`   Профиль: ${targetProfile.name} (${targetProfile.id})  ·  порт ${targetProfile.cdpPort}`);
console.log();