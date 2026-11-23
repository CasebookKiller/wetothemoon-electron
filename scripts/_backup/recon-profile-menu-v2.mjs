// scripts/recon-profile-menu-v2.mjs
//
// Универсальный recon меню профиля DeepSeek:
//   - кликает по триггеру
//   - ищет элементы по тексту пунктов меню (Настройки, Выйти, Тема, Язык)
//   - выводит цепочку родителей до 6 уровней
//   - проверяет ShadowRoot
//   - сохраняет HTML всех найденных кандидатов
//
// Запуск:
//   node scripts/recon-profile-menu-v2.mjs
//   CDP_URL=http://127.0.0.1:9222 node scripts/recon-profile-menu-v2.mjs

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = 'recon-output';
const ts = Date.now();
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEYWORDS = [
  'Настройки', 'Настройка', 'Выйти', 'Выход', 'Тема', 'Язык',
  'Профиль', 'Аккаунт', 'Выйти из аккаунта', 'Удалить аккаунт',
  'Settings', 'Logout', 'Sign out', 'Theme', 'Language',
];

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

// ─── 1. Клик по триггеру ───────────────────────────────────────
console.log('🖱  Клик по профилю...');
await page.evaluate(() => {
  let trigger = document.querySelector('div._7b40dad div._2afd28d');
  if (!trigger) {
    const candidates = Array.from(document.querySelectorAll('[tabindex="0"]'));
    trigger = candidates.find((el) => el.querySelector('img'));
  }
  if (trigger) trigger.click();
});
await page.waitForTimeout(1500); // ждём анимацию и рендер портала

// ─── 2. Поиск по тексту + ShadowRoot ──────────────────────────
const result = await page.evaluate(({ KEYWORDS }) => {
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
      position: cs.position,
      zIndex: cs.zIndex,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      background: cs.backgroundColor,
      color: cs.color,
      fontSize: cs.fontSize,
      padding: cs.padding,
      border: cs.border,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      width: cs.width,
      height: cs.height,
    };
  };

  const parentChain = (el, maxDepth = 6) => {
    const chain = [];
    let cur = el;
    for (let i = 0; i < maxDepth && cur; i++, cur = cur.parentElement) {
      chain.push({
        tag: cur.tagName.toLowerCase(),
        id: cur.id || null,
        classes: typeof cur.className === 'string' ? cur.className : '',
        rect: cur.getBoundingClientRect().toJSON(),
        styles: styleSnapshot(cur),
      });
    }
    return chain;
  };

  // Собираем ВСЕ элементы body (рекурсивно, включая ShadowRoot)
  const allElements = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      allElements.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document.body);

  // 1. Элементы, содержащие ключевые слова
  const byText = [];
  for (const el of allElements) {
    // Берём только "листовые" элементы (без дочерних div с тем же текстом)
    const text = (el.textContent || '').trim();
    if (text.length === 0 || text.length > 200) continue;

    for (const kw of KEYWORDS) {
      if (text.includes(kw)) {
        // Пропускаем body, html, крупные контейнеры
        if (['BODY', 'HTML', 'MAIN', 'NAV', 'ASIDE'].includes(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) continue;
        // Пропускаем, если элемент — просто текст внутри кнопки, и есть кнопка-родитель
        const parentBtn = el.closest('button, [role="button"], [role="menuitem"], a');
        byText.push({
          tag: el.tagName.toLowerCase(),
          classes: typeof el.className === 'string' ? el.className : '',
          text: text.slice(0, 120),
          rect: r.toJSON(),
          styles: styleSnapshot(el),
          parentChain: parentChain(el),
          parentButton: parentBtn ? {
            tag: parentBtn.tagName.toLowerCase(),
            classes: typeof parentBtn.className === 'string' ? parentBtn.className : '',
            outerHTML: parentBtn.outerHTML.slice(0, 1500),
          } : null,
          svgs: svgDump(el),
        });
        break;
      }
    }
  }

  // 2. Все элементы с position fixed/absolute, z-index > 0, появившиеся после клика
  const floating = [];
  for (const el of allElements) {
    const r = el.getBoundingClientRect();
    if (r.width < 30 || r.height < 20) continue;
    const cs = getComputedStyle(el);
    if (!['fixed', 'absolute'].includes(cs.position)) continue;
    const z = parseInt(cs.zIndex, 10);
    if (isNaN(z) || z <= 0) continue;
    // Пропускаем, если элемент — явно часть чата (огромный)
    if (r.width > 1000 && r.height > 600) continue;

    floating.push({
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : '',
      rect: r.toJSON(),
      zIndex: z,
      styles: styleSnapshot(el),
      outerHTML: el.outerHTML.slice(0, 2000),
      svgs: svgDump(el),
    });
  }

  // 3. Проверка ShadowRoot
  const shadowHosts = [];
  for (const el of allElements) {
    if (el.shadowRoot) {
      shadowHosts.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: typeof el.className === 'string' ? el.className : '',
        shadowChildren: el.shadowRoot.querySelectorAll('*').length,
      });
    }
  }

  return { byText, floating, shadowHosts };
}, { KEYWORDS });

// ─── 3. Вывод ─────────────────────────────────────────────────
console.log(`📝 Элементов с текстом меню: ${result.byText.length}`);
result.byText.slice(0, 10).forEach((el, i) => {
  console.log(`\n  [${i}] <${el.tag}> classes="${el.classes}"`);
  console.log(`      text: "${el.text}"`);
  console.log(`      rect: ${Math.round(el.rect.width)}×${Math.round(el.rect.height)} @ (${Math.round(el.rect.x)},${Math.round(el.rect.y)})`);
  console.log(`      parentChain:`);
  el.parentChain.forEach((p, j) => {
    console.log(`        ${j}: <${p.tag}> class="${p.classes}" pos=${p.styles.position} z=${p.styles.zIndex}`);
  });
  if (el.parentButton) {
    console.log(`      button: <${el.parentButton.tag}> class="${el.parentButton.classes}"`);
  }
});

console.log(`\n📐 Плавающих элементов (fixed/absolute, z>0): ${result.floating.length}`);
result.floating.slice(0, 10).forEach((el, i) => {
  console.log(`\n  [${i}] <${el.tag}> class="${el.classes}" z=${el.zIndex}`);
  console.log(`      rect: ${Math.round(el.rect.width)}×${Math.round(el.rect.height)} @ (${Math.round(el.rect.x)},${Math.round(el.rect.y)})`);
});

console.log(`\n🧩 ShadowRoot хостов: ${result.shadowHosts.length}`);
result.shadowHosts.slice(0, 5).forEach((h) => {
  console.log(`  - <${h.tag}> id="${h.id}" class="${h.classes}" children=${h.shadowChildren}`);
});

// ─── 4. Сохранение ────────────────────────────────────────────
const outPath = path.join(OUT_DIR, `profile-menu-v2-${ts}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\n✅ JSON: ${outPath}`);

// HTML-дамп: все byText и floating
let htmlDump = '<!-- BY TEXT -->\n';
result.byText.forEach((el, i) => {
  htmlDump += `\n<!-- [${i}] <${el.tag}> ${el.classes} -->\n`;
  htmlDump += `<!-- parentChain: ${el.parentChain.map(p => p.tag + '.' + p.classes).join(' > ')} -->\n`;
  if (el.parentButton) htmlDump += el.parentButton.outerHTML + '\n';
  else htmlDump += `<div class="${el.classes}">${el.text}</div>\n`;
});
htmlDump += '\n<!-- FLOATING -->\n';
result.floating.forEach((el, i) => {
  htmlDump += `\n<!-- [${i}] <${el.tag}> ${el.classes} z=${el.zIndex} -->\n`;
  htmlDump += el.outerHTML + '\n';
});
const htmlPath = path.join(OUT_DIR, `profile-menu-v2-${ts}.html`);
fs.writeFileSync(htmlPath, htmlDump);
console.log(`✅ HTML: ${htmlPath}`);

// ─── 5. Закрыть меню ─────────────────────────────────────────
try {
  await page.evaluate(() => {
    let trigger = document.querySelector('div._7b40dad div._2afd28d');
    if (!trigger) {
      const candidates = Array.from(document.querySelectorAll('[tabindex="0"]'));
      trigger = candidates.find((el) => el.querySelector('img'));
    }
    if (trigger) trigger.click();
  });
} catch { /* ignore */ }

await browser.close();