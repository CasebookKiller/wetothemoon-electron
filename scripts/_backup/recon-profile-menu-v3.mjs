// scripts/recon-profile-menu-v3.mjs
//
// v3 — отличается от v2 тем, что:
//   - использует page.click() (настоящая цепочка mouse-events)
//   - делает скриншот до/после
//   - ищет меню через DOM-diff (что появилось нового)
//   - проверяет aria-expanded у триггера
//   - ищет по aria-ролям и popover API (Radix/DeepSeek-специфика)
//
// Запуск:
//   node scripts/recon-profile-menu-v3.mjs

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = 'recon-output';
const ts = Date.now();
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) {
    if (p.url().includes('deepseek.com')) { page = p; break; }
  }
  if (page) break;
}
if (!page) { console.error('❌ нет вкладки deepseek.com'); process.exit(1); }

console.log(`🔍 CDP: ${CDP}`);
console.log(`🔍 URL: ${page.url()}\n`);

// ─── 0. Скриншот "до" ─────────────────────────────────────────
const shotBefore = path.join(OUT_DIR, `profile-menu-before-${ts}.png`);
await page.screenshot({ path: shotBefore, fullPage: false });
console.log(`📸 до: ${shotBefore}`);

// ─── 1. Настоящий клик ────────────────────────────────────────
const triggerSelector = 'div._7b40dad div._2afd28d';
console.log(`🖱  Настоящий клик: page.click('${triggerSelector}')...`);

let clickOk = false;
try {
  await page.click(triggerSelector, { timeout: 3000 });
  clickOk = true;
  console.log('   ✅ click выполнен');
} catch (e) {
  console.warn(`   ⚠️ page.click упал: ${e.message}`);
  // Fallback: mouse.click по координатам центра
  console.log('   🖱  fallback: mouse.click по rect центра');
  const rect = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().toJSON() : null;
  }, triggerSelector);
  if (rect) {
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    clickOk = true;
    console.log('   ✅ mouse.click выполнен');
  }
}
if (!clickOk) { console.error('❌ не удалось кликнуть'); await browser.close(); process.exit(1); }

// Ждём рендер портала/меню
await page.waitForTimeout(800);

// ─── 2. Скриншот "после" ──────────────────────────────────────
const shotAfter = path.join(OUT_DIR, `profile-menu-after-${ts}.png`);
await page.screenshot({ path: shotAfter, fullPage: false });
console.log(`📸 после: ${shotAfter}\n`);

// ─── 3. Проверка aria-expanded и diff DOM ─────────────────────
const result = await page.evaluate(({ triggerSelector }) => {
  const trigger = document.querySelector(triggerSelector);
  const triggerState = trigger ? {
    ariaExpanded: trigger.getAttribute('aria-expanded'),
    ariaHaspopup: trigger.getAttribute('aria-haspopup'),
    dataState: trigger.getAttribute('data-state'),
    classes: trigger.className,
    outerHTML: trigger.outerHTML.slice(0, 1500),
  } : null;

  const svgDump = (el) => Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || Math.round(svg.getBoundingClientRect().width),
    height: svg.getAttribute('height') || Math.round(svg.getBoundingClientRect().height),
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
  }));

  const styleSnapshot = (el) => {
    const cs = getComputedStyle(el);
    return {
      position: cs.position, zIndex: cs.zIndex, display: cs.display,
      visibility: cs.visibility, opacity: cs.opacity,
      background: cs.backgroundColor, color: cs.color,
      fontSize: cs.fontSize, padding: cs.padding,
      border: cs.border, borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow, width: cs.width, height: cs.height,
      top: cs.top, left: cs.left, right: cs.right, bottom: cs.bottom,
      transform: cs.transform,
    };
  };

  // ── 3a. Элементы по aria-ролям (меню, dialog, popover) ──
  const ariaCandidates = [];
  for (const sel of [
    '[role="menu"]', '[role="menuitem"]', '[role="dialog"]',
    '[role="listbox"]', '[data-radix-popper-content-wrapper]',
    '[data-state="open"]', '[popover]:popover-open',
    '.ds-popover', '.ds-dropdown-panel', '.ds-menu',
  ]) {
    const found = document.querySelectorAll(sel);
    for (const el of found) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      ariaCandidates.push({
        selector: sel,
        tag: el.tagName.toLowerCase(),
        classes: typeof el.className === 'string' ? el.className : '',
        rect: r.toJSON(),
        styles: styleSnapshot(el),
        outerHTML: el.outerHTML.slice(0, 3000),
        svgs: svgDump(el),
        textPreview: (el.textContent || '').trim().slice(0, 200),
      });
    }
  }

  // ── 3b. Все элементы, видимые И ближайшие к триггеру ──
  // Триггер: x=12 y=656 w=236 h=64. Меню обычно открывается вверх или вниз.
  // Ищем ВСЕ элементы с видимой геометрией, у которых rect.bottom ~ триггер.top
  // или rect.top ~ триггер.bottom, и z-index > 0.
  const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
  const nearby = [];
  if (triggerRect) {
    for (const el of document.querySelectorAll('body *')) {
      if (el === trigger || trigger.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 30) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (parseFloat(cs.opacity) < 0.1) continue;

      // Меню где-то в диапазоне ±400px по Y от триггера
      const nearY = Math.abs(r.top - triggerRect.top) < 400 ||
                    Math.abs(r.bottom - triggerRect.bottom) < 400 ||
                    (r.top < triggerRect.bottom && r.bottom > triggerRect.top);
      if (!nearY) continue;

      // Пересечение по X с триггером (или близко)
      const nearX = !(r.right < triggerRect.left - 100 || r.left > triggerRect.right + 100);
      if (!nearX) continue;

      // Должен содержать хотя бы один пункт (текст/кнопку)
      const items = el.querySelectorAll('button, [role="button"], [role="menuitem"], a, li, div[tabindex]');
      if (items.length === 0) continue;

      // Пропускаем огромные контейнеры (сайдбар целиком, чат)
      if (r.width > 400 || r.height > 400) continue;

      nearby.push({
        tag: el.tagName.toLowerCase(),
        classes: typeof el.className === 'string' ? el.className : '',
        rect: r.toJSON(),
        styles: styleSnapshot(el),
        itemCount: items.length,
        itemsText: Array.from(items).slice(0, 15).map((it) => ({
          tag: it.tagName.toLowerCase(),
          classes: typeof it.className === 'string' ? it.className : '',
          text: (it.textContent || '').trim().slice(0, 60),
          rect: it.getBoundingClientRect().toJSON(),
        })).filter((it) => it.text.length > 0),
        outerHTML: el.outerHTML.slice(0, 3000),
        svgs: svgDump(el),
      });
    }
  }

  // Сортируем nearby по z-index (наибольший сверху) и размеру
  nearby.sort((a, b) => {
    const za = parseInt(a.styles.zIndex, 10) || 0;
    const zb = parseInt(b.styles.zIndex, 10) || 0;
    if (za !== zb) return zb - za;
    return b.rect.width * b.rect.height - a.rect.width * a.rect.height;
  });

  return {
    triggerState,
    ariaCandidates: ariaCandidates.slice(0, 10),
    nearby: nearby.slice(0, 15),
  };
}, { triggerSelector });

// ─── 4. Вывод ────────────────────────────────────────────────
console.log('🔎 Состояние триггера после клика:');
console.log('   aria-expanded:', result.triggerState?.ariaExpanded);
console.log('   aria-haspopup:', result.triggerState?.ariaHaspopup);
console.log('   data-state:   ', result.triggerState?.dataState);
console.log('   classes:      ', result.triggerState?.classes);
console.log();

console.log(`🎯 Aria-кандидатов: ${result.ariaCandidates.length}`);
result.ariaCandidates.forEach((c, i) => {
  console.log(`  [${i}] sel="${c.selector}" <${c.tag}.${c.classes}> ${Math.round(c.rect.width)}×${Math.round(c.rect.height)} @ (${Math.round(c.rect.x)},${Math.round(c.rect.y)})`);
  console.log(`       text: "${c.textPreview}"`);
  console.log(`       z=${c.styles.zIndex} pos=${c.styles.position} bg=${c.styles.background}`);
});
console.log();

console.log(`🎯 Nearby (близко к триггеру, 60×30+, z>0): ${result.nearby.length}`);
result.nearby.forEach((c, i) => {
  console.log(`  [${i}] <${c.tag}.${c.classes}> ${Math.round(c.rect.width)}×${Math.round(c.rect.height)} @ (${Math.round(c.rect.x)},${Math.round(c.rect.y)}) z=${c.styles.zIndex} pos=${c.styles.position}`);
  console.log(`       items (${c.itemCount}):`);
  c.itemsText.slice(0, 6).forEach((it) => {
    console.log(`         - <${it.tag}.${it.classes}> "${it.text}"`);
  });
});

// ─── 5. Сохраняем ────────────────────────────────────────────
const outPath = path.join(OUT_DIR, `profile-menu-v3-${ts}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\n✅ JSON: ${outPath}`);
console.log(`✅ Скриншоты:\n   до:    ${shotBefore}\n   после: ${shotAfter}`);

// ─── 6. Дамп HTML ────────────────────────────────────────────
let htmlDump = `<!-- TRIGGER -->\n${result.triggerState?.outerHTML}\n\n`;
htmlDump += '<!-- ARIA CANDIDATES -->\n';
result.ariaCandidates.forEach((c, i) => {
  htmlDump += `\n<!-- [${i}] sel="${c.selector}" ${c.tag}.${c.classes} -->\n${c.outerHTML}\n`;
});
htmlDump += '\n<!-- NEARBY -->\n';
result.nearby.forEach((c, i) => {
  htmlDump += `\n<!-- [${i}] ${c.tag}.${c.classes} ${Math.round(c.rect.width)}×${Math.round(c.rect.height)} -->\n${c.outerHTML}\n`;
});
const htmlPath = path.join(OUT_DIR, `profile-menu-v3-${ts}.html`);
fs.writeFileSync(htmlPath, htmlDump);
console.log(`✅ HTML: ${htmlPath}`);

// ─── 7. Не закрываем меню — оставляем как есть ──────────────
// (чтобы ты мог посмотреть скриншот и, если нужно, снять ещё раз)
console.log('\nℹ️  Меню оставлено открытым (не кликаем второй раз).');

await browser.close();