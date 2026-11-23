// scripts/recon-profile-menu-v4.mjs
//
// Снимает детально меню профиля DeepSeek:
//   - контейнер: полные стили
//   - каждый пункт: tag, classes, text, SVG-иконка, computed styles
//   - hover-стили: наводит мышь на каждый пункт и снимает изменения
//   - аватар: src, стили (для виджета в GW)
//
// Запуск:
//   node scripts/recon-profile-menu-v4.mjs

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

console.log(`🔍 URL: ${page.url()}\n`);

// ─── 1. Открываем меню (если не открыто) ────────────────────
const hasMenu = await page.evaluate(() =>
  !!document.querySelector('[role="menu"].ds-dropdown-menu')
);
if (!hasMenu) {
  console.log('🖱  Открываю меню...');
  await page.click('div._7b40dad div._2afd28d', { timeout: 3000 });
  await page.waitForTimeout(500);
}
const menuExists = await page.evaluate(() =>
  !!document.querySelector('[role="menu"].ds-dropdown-menu')
);
if (!menuExists) { console.error('❌ меню не открылось'); await browser.close(); process.exit(1); }
console.log('✅ меню открыто\n');

// ─── 2. Снимаем контейнер + все пункты ──────────────────────
const snapshot = await page.evaluate(() => {
  const styleSnapshot = (el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display, position: cs.position,
      width: cs.width, height: cs.height,
      minWidth: cs.minWidth, maxWidth: cs.maxWidth,
      padding: cs.padding, margin: cs.margin,
      border: cs.border, borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage,
      color: cs.color,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily, lineHeight: cs.lineHeight,
      boxShadow: cs.boxShadow,
      gap: cs.gap,
      flexDirection: cs.flexDirection,
      alignItems: cs.alignItems,
      justifyContent: cs.justifyContent,
      transition: cs.transition,
      cursor: cs.cursor,
      outline: cs.outline,
    };
  };

  const svgDump = (el) => Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || Math.round(svg.getBoundingClientRect().width),
    height: svg.getAttribute('height') || Math.round(svg.getBoundingClientRect().height),
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
    classes: typeof svg.className.baseVal === 'string' ? svg.className.baseVal : '',
  }));

  const menu = document.querySelector('[role="menu"].ds-dropdown-menu');
  if (!menu) return { error: 'menu исчезло' };

  const menuItems = [];
  // Ищем прямые интерактивные потомки: button, [role="menuitem"], a, div[tabindex]
  const items = menu.querySelectorAll(
    '[role="menuitem"], button, a, div[tabindex]:not([tabindex="-1"])'
  );

  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 15) continue;

    // Внутренние элементы (иконка + текст)
    const children = Array.from(el.children).map((c) => ({
      tag: c.tagName.toLowerCase(),
      classes: typeof c.className === 'string' ? c.className : '',
      rect: c.getBoundingClientRect().toJSON(),
      styles: styleSnapshot(c),
      svgCount: c.querySelectorAll('svg').length,
      textContent: (c.textContent || '').trim().slice(0, 80),
    }));

    menuItems.push({
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : '',
      rect: r.toJSON(),
      styles: styleSnapshot(el),
      text: (el.textContent || '').trim(),
      children,
      svgs: svgDump(el),
    });
  }

  // Аватар (триггер)
  const triggerAvatar = document.querySelector('div._7b40dad div._2afd28d img');
  const avatarInfo = triggerAvatar ? {
    src: triggerAvatar.getAttribute('src'),
    alt: triggerAvatar.getAttribute('alt'),
    classes: triggerAvatar.className,
    rect: triggerAvatar.getBoundingClientRect().toJSON(),
    styles: styleSnapshot(triggerAvatar),
  } : null;

  return {
    menu: {
      classes: menu.className,
      rect: menu.getBoundingClientRect().toJSON(),
      styles: styleSnapshot(menu),
      outerHTML: menu.outerHTML.slice(0, 8000),
    },
    menuItems,
    avatarInfo,
  };
});

if (snapshot.error) { console.error('❌', snapshot.error); await browser.close(); process.exit(1); }

// ─── 3. Hover-стили для каждого пункта ──────────────────────
console.log('🖱  Снимаю hover-стили для каждого пункта...\n');
const hoverData = [];

for (let i = 0; i < snapshot.menuItems.length; i++) {
  const item = snapshot.menuItems[i];
  const cx = item.rect.x + item.rect.width / 2;
  const cy = item.rect.y + item.rect.height / 2;

  // Снимаем стили до hover
  const before = await page.evaluate(({ text }) => {
    const items = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] a, [role="menu"] div[tabindex]'));
    const el = items.find((x) => (x.textContent || '').trim() === text);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      border: cs.border,
    };
  }, { text: item.text });

  // Hover
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(250);

  const after = await page.evaluate(({ text }) => {
    const items = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] a, [role="menu"] div[tabindex]'));
    const el = items.find((x) => (x.textContent || '').trim() === text);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      border: cs.border,
    };
  }, { text: item.text });

  hoverData.push({ text: item.text, before, after });
  console.log(`  [${i}] "${item.text}"`);
  console.log(`      normal: bg=${before?.background} color=${before?.color}`);
  console.log(`      hover:  bg=${after?.background} color=${after?.color}`);
}

// Убираем мышь с меню, чтобы не сработал click на последнем пункте
await page.mouse.move(0, 0);

// ─── 4. Сохранение ─────────────────────────────────────────
const out = {
  capturedAt: new Date().toISOString(),
  ...snapshot,
  hoverData,
};
const jsonPath = path.join(OUT_DIR, `profile-menu-v4-${ts}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
console.log(`\n✅ JSON: ${jsonPath}`);

// ─── 5. SVG-дамп отдельно для удобства ──────────────────────
const svgs = [];
for (const item of snapshot.menuItems) {
  for (const svg of item.svgs) {
    svgs.push({
      for: item.text,
      ...svg,
    });
  }
}
const svgPath = path.join(OUT_DIR, `profile-menu-v4-svgs-${ts}.txt`);
let svgDump = `/* ${snapshot.menuItems.length} пунктов меню, ${svgs.length} SVG */\n\n`;
for (const item of snapshot.menuItems) {
  svgDump += `// ═══ "${item.text}" ═══\n`;
  for (const svg of item.svgs) {
    svgDump += `// ${svg.width}×${svg.height} fill=${svg.fill}\n`;
    svgDump += `${svg.outerHTML}\n\n`;
  }
}
fs.writeFileSync(svgPath, svgDump);
console.log(`✅ SVG: ${svgPath}`);

// ─── 6. Закрываем меню ──────────────────────────────────────
try {
  await page.click('div._7b40dad div._2afd28d');
  await page.waitForTimeout(300);
} catch { /* ignore */ }

await browser.close();