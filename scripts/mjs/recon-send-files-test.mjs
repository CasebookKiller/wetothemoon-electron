// scripts/mjs/recon-send-files-test.mjs
/**
 * @name recon-send-files-test
 * @purpose E2E тест отправки файла в DeepSeek: новый чат → setInputFiles → chip → send → ожидание ответа → сбор результата
 * @input CDP :9222 (Yandex), вкладка chat.deepseek.com
 * @output recon-output/send-files-<ts>.{png,json}
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки / нет input[type=file] / chips не появились
 * @tool false
 * @example node scripts/mjs/recon-send-files-test.mjs
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
  let page = pages.find(p => p.url().includes(DEEPSEEK_HOST)) ?? pages[0];
  if (!page) { console.error('Нет вкладки DeepSeek'); process.exit(1); }

  console.log('[send-files-test] Текущий URL:', page.url());

  // ⚠️ ВАЖНО: создаём НОВЫЙ чат, не трогаем реальный диалог
  console.log('[send-files-test] Открываем новый чат…');
  await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
  console.log('[send-files-test] После goto URL:', page.url());

  // Проверяем, что мы не в старом чате
  const url = page.url();
  if (url.includes('/a/chat/s/')) {
    console.log('[send-files-test] ⚠️ Редирект в старый чат:', url);
    // Клик по кнопке "Новый чат" в сайдбаре
    const newChatBtn = page.locator('a[href="/"], button:has-text("Новый чат"), div[role="button"]:has-text("Новый чат")').first();
    if ((await newChatBtn.count()) > 0) {
      await newChatBtn.click();
      await page.waitForTimeout(2000);
      console.log('[send-files-test] После клика "Новый чат":', page.url());
    }
  }

  // Создаём тестовый файл
  const tmpFile = path.join(os.tmpdir(), `gw-test-${Date.now()}.md`);
  await fs.writeFile(tmpFile, `# GW Test File\n\nCreated: ${new Date().toISOString()}\n\nЭто тестовый файл для проверки sendMessageWithFiles.`, 'utf-8');
  console.log('[send-files-test] Test file:', tmpFile);

  // 1. setInputFiles
  const fileInput = page.locator('input[type="file"]').first();
  console.log('[send-files-test] input[type=file] count =', await fileInput.count());
  const chipsBefore = await page.locator('._25c7358').count();
  console.log('[send-files-test] chips before:', chipsBefore);

  await fileInput.setInputFiles([tmpFile]);
  console.log('[send-files-test] ✅ setInputFiles done');

  // 2. Ждём появления чипа
  try {
    await page.waitForFunction(
      ({ target }) => document.querySelectorAll('._25c7358').length >= target,
      { target: chipsBefore + 1 },
      { timeout: 30000, polling: 300 }
    );
    const chipsAfter = await page.locator('._25c7358').count();
    console.log('[send-files-test] ✅ chips after:', chipsAfter);
  } catch (e) {
    console.error('[send-files-test] ❌ chips не появились:', e.message);
    process.exit(1);
  }

  // 3. Заполняем textarea
  const textarea = page.locator('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]').first();
  await textarea.fill('Тест отправки файла из GW. Ответь "ok" и не более.');
  console.log('[send-files-test] Textarea заполнена');

  // 4. Снимок ДО отправки
  const assistantSelector = 'div.ds-markdown.ds-assistant-message-main-content';
  const messagesBefore = await page.locator(assistantSelector).count();
  console.log('[send-files-test] assistant messages before:', messagesBefore);

  // 5. Отправка (Enter с fallback на кнопку)
  await textarea.focus();
  await textarea.press('Enter');
  console.log('[send-files-test] ⏎ Enter pressed, проверяем сработал ли…');
  
  await page.waitForTimeout(1000); // Даём время React обработать
  const isSent = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]');
    return !ta || ta.value.length === 0;
  });

  if (isSent) {
    console.log('[send-files-test] ✅ Сообщение отправлено (Enter сработал)');
  } else {
    console.log('[send-files-test] ⚠️ Enter не сработал, кликаем по кнопке Send (через DOM)');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('div._52c986b, div.ds-button--primary.ds-button--filled'));
      const btn = btns[btns.length - 1];
      if (btn) btn.click();
    });
  }

  // 6. Ждём первое assistant-сообщение (до 120с)
  try {
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: assistantSelector, prev: messagesBefore },
      { timeout: 120000, polling: 500 }
    );
    console.log('[send-files-test] ✅ Ответ получен');
  } catch (e) {
    console.error('[send-files-test] ❌ Ответ не пришёл за 120с:', e.message);
  }

  // 7. Ждём стабилизации (HTML не меняется 3 раза по 300мс)
  await page.waitForFunction(
    ({ selector }) => {
      const els = document.querySelectorAll(selector);
      const last = els[els.length - 1];
      if (!last) return false;
      const w = window;
      const html = last.innerHTML;
      if (!html) return false;
      if (html === w.__lastStableHtml) {
        w.__stableCount = (w.__stableCount || 0) + 1;
        return w.__stableCount >= 3;
      }
      w.__lastStableHtml = html;
      w.__stableCount = 0;
      return false;
    },
    { selector: assistantSelector },
    { timeout: 120000, polling: 300 }
  ).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('[send-files-test] Стабилизация завершена');

  // 8. Собираем результат
  const result = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div[data-virtual-list-item-key]'));
    const lastItems = items.slice(-4).map((el) => ({
      key: el.getAttribute('data-virtual-list-item-key'),
      role: el.querySelector('.fbb737a4') ? 'user' : 'assistant',
      hasChips: !!el.querySelector('.eafda4ae'),
      chipNames: Array.from(el.querySelectorAll('.eafda4ae .e70accd6')).map(n => n.textContent?.trim()),
      chipMeta: Array.from(el.querySelectorAll('.eafda4ae ._7103a25')).map(n => n.textContent?.trim()),
      textPreview: (el.querySelector('.fbb737a4')?.textContent || el.querySelector('.ds-markdown')?.textContent || '').trim().slice(0, 200),
    }));
    return {
      url: location.href,
      totalItems: items.length,
      lastItems,
      chipsInInputArea: document.querySelectorAll('._25c7358').length,
    };
  });

  // 9. Скриншот
  const shotPath = path.join(ROOT, 'recon-output', `send-files-${Date.now()}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('[send-files-test] Screenshot:', shotPath);

  // 10. JSON
  const jsonPath = path.join(ROOT, 'recon-output', `send-files-${Date.now()}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
  console.log('[send-files-test] JSON:', jsonPath);

  console.log('\n=== РЕЗУЛЬТАТ ===');
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
})();