// scripts/mjs/recon-attach-test.mjs
/**
 * @name recon-attach-test
 * @purpose Тест attach файла в DeepSeek через setInputFiles: снимок input area до/после, чипы, скриншот, cleanup
 * @input CDP :9222 (Yandex), вкладка chat.deepseek.com
 * @output recon-output/attach-test-<ts>.{png,json}
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки / нет input[type=file] / setInputFiles failed
 * @tool false
 * @example node scripts/mjs/recon-attach-test.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const YANDEX_CDP = 'http://127.0.0.1:9222';
const DEEPSEEK_HOST = 'chat.deepseek.com';

(async () => {
  const browser = await chromium.connectOverCDP(YANDEX_CDP);
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  const page = pages.find(p => p.url().includes(DEEPSEEK_HOST)) ?? pages[0];
  if (!page) { console.error('Нет вкладки DeepSeek'); process.exit(1); }

  console.log('[attach-test] Page:', page.url());

  // 1. Создаём тестовый файл
  const tmpFile = path.join(os.tmpdir(), `recon-attach-${Date.now()}.txt`);
  await fs.writeFile(tmpFile, `Recon test file\nTimestamp: ${new Date().toISOString()}\nDo not send.`, 'utf-8');
  console.log('[attach-test] Test file:', tmpFile, 'size:', (await fs.stat(tmpFile)).size);

  // 2. Снимок input area ДО
  const before = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]');
    if (!ta) return null;
    const area = ta.closest('._020ab5b') || ta.parentElement?.parentElement;
    return {
      inputAreaHTML: area?.outerHTML?.slice(0, 20000) || '',
      chipsCount: document.querySelectorAll('._25c7358').length,
      chipsHTML: Array.from(document.querySelectorAll('._25c7358')).map(c => c.outerHTML.slice(0, 1500)),
    };
  });
  console.log('[attach-test] before: chips =', before?.chipsCount, ', area len =', before?.inputAreaHTML.length);

  // 3. setInputFiles на скрытый input
  const fileInput = page.locator('input[type="file"]').first();
  const attached = await fileInput.count();
  console.log('[attach-test] input[type=file] count =', attached);
  if (attached === 0) { console.error('Нет input[type=file]'); process.exit(1); }

  try {
    await fileInput.setInputFiles([tmpFile]);
    console.log('[attach-test] ✅ setInputFiles OK');
  } catch (e) {
    console.error('[attach-test] ❌ setInputFiles failed:', e.message);
    process.exit(1);
  }

  // 4. Ждём появления чипа (новых ._25c7358 или других в input area)
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]');
    if (!ta) return null;
    const area = ta.closest('._020ab5b') || ta.parentElement?.parentElement;
    const chips = Array.from(document.querySelectorAll('._25c7358'));
    return {
      inputAreaHTML: area?.outerHTML?.slice(0, 30000) || '',
      chipsCount: chips.length,
      chipsHTML: chips.map(c => c.outerHTML.slice(0, 2000)),
      chipNames: chips.map(c => c.querySelector('.e70accd6')?.textContent?.trim() || ''),
      chipMeta: chips.map(c => c.querySelector('._7103a25')?.textContent?.trim() || ''),
    };
  });
  console.log('[attach-test] after: chips =', after?.chipsCount, ', area len =', after?.inputAreaHTML.length);
  console.log('[attach-test] chip names:', after?.chipNames);
  console.log('[attach-test] chip meta :', after?.chipMeta);

  // 5. Скриншот
  const shotPath = path.join(ROOT, 'recon-output', `attach-test-${Date.now()}.png`);
  await page.screenshot({ path: shotPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log('[attach-test] Screenshot:', shotPath);

  // 6. Сохраняем JSON
  const jsonPath = path.join(ROOT, 'recon-output', `attach-test-${Date.now()}.json`);
  await fs.writeFile(jsonPath, JSON.stringify({ before, after, tmpFile, ts: new Date().toISOString() }, null, 2));
  console.log('[attach-test] JSON:', jsonPath);

  // 7. Пытаемся очистить (если найден крестик на чипе) — чтобы не оставлять мусор
  const cleaned = await page.evaluate(() => {
    const chips = document.querySelectorAll('._25c7358');
    let removed = 0;
    for (const chip of chips) {
      // Ищем крестик внутри чипа
      const closeBtn = chip.querySelector('[class*="close"], [aria-label*="remove"], [aria-label*="delete"], [class*="delete"], [class*="remove"]');
      if (closeBtn) { closeBtn.click(); removed++; }
    }
    return { removed, totalChips: chips.length };
  });
  console.log('[attach-test] Cleanup:', cleaned);

  process.exit(0);
})();