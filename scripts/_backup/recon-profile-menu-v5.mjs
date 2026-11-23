// scripts/recon-profile-menu-v5.mjs
//
// v5: пункты меню DeepSeek = div.ds-dropdown-menu-option (не button/a/menuitem).
//     Селектор исправлен, hover теперь находит пункты, slice() увеличен.
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

// ─── 1. Открываем меню ───────────────────────────────────────
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

// ─── 2. Снимаем контейнер + пункты ──────────────────────────
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
      color: cs.color,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      boxShadow: cs.boxShadow,
      gap: cs.gap,
      transition: cs.transition,
      cursor: cs.cursor,
    };
  };

  const svgDump = (el) => Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || Math.round(svg.getBoundingClientRect().width),
    height: svg.getAttribute('height') || Math.round(svg.getBoundingClientRect().height),
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
  }));

  const menu = document.querySelector('[role="menu"].ds-dropdown-menu');
  if (!menu) return { error: 'menu исчезло' };

  const menuItems = [];
  // ПРАВИЛЬНЫЙ СЕЛЕКТОР: пункты — div.ds-dropdown-menu-option
  const items = menu.querySelectorAll('.ds-dropdown-menu-option');

  for (const el of items) {
    const r = el.getBoundingClientRect();
    const labelEl = el.querySelector('.ds-dropdown-menu-option__label');
    const text = labelEl ? (labelEl.textContent || '').trim() : (el.textContent || '').trim();
    const iconEl = el.querySelector('.ds-dropdown-menu-option__icon');

    menuItems.push({
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : '',
      rect: r.toJSON(),
      styles: styleSnapshot(el),
      text,
      labelStyles: labelEl ? styleSnapshot(labelEl) : null,
      iconStyles: iconEl ? styleSnapshot(iconEl) : null,
      svgs: svgDump(el),
    });
  }

  const triggerAvatar = document.querySelector('div._7b40dad div._2afd28d img');
  const avatarInfo = triggerAvatar ? {
    src: triggerAvatar.getAttribute('src'),
    rect: triggerAvatar.getBoundingClientRect().toJSON(),
    styles: styleSnapshot(triggerAvatar),
  } : null;

  return {
    menu: {
      classes: menu.className,
      rect: menu.getBoundingClientRect().toJSON(),
      styles: styleSnapshot(menu),
    },
    menuItems,
    avatarInfo,
  };
});

if (snapshot.error) { console.error('❌', snapshot.error); await browser.close(); process.exit(1); }
console.log(`📋 Пунктов: ${snapshot.menuItems.length}\n`);

// ─── 3. Hover-стили ─────────────────────────────────────────
console.log('🖱  Снимаю hover-стили...\n');
const hoverData = [];

for (let i = 0; i < snapshot.menuItems.length; i++) {
  const item = snapshot.menuItems[i];
  const cx = item.rect.x + item.rect.width / 2;
  const cy = item.rect.y + item.rect.height / 2;

  const before = await page.evaluate(({ text }) => {
    const items = Array.from(document.querySelectorAll('[role="menu"] .ds-dropdown-menu-option'));
    const el = items.find((x) => {
      const lbl = x.querySelector('.ds-dropdown-menu-option__label');
      return lbl && (lbl.textContent || '').trim() === text;
    });
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, color: cs.color };
  }, { text: item.text });

  await page.mouse.move(cx, cy);
  await page.waitForTimeout(250);

  const after = await page.evaluate(({ text }) => {
    const items = Array.from(document.querySelectorAll('[role="menu"] .ds-dropdown-menu-option'));
    const el = items.find((x) => {
      const lbl = x.querySelector('.ds-dropdown-menu-option__label');
      return lbl && (lbl.textContent || '').trim() === text;
    });
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, color: cs.color };
  }, { text: item.text });

  hoverData.push({ text: item.text, before, after });
  console.log(`  [${i}] "${item.text}"`);
  console.log(`      normal: bg=${before?.background} color=${before?.color}`);
  console.log(`      hover:  bg=${after?.background} color=${after?.color}`);
}

await page.mouse.move(0, 0);

// ─── 4. Save ────────────────────────────────────────────────
const out = { capturedAt: new Date().toISOString(), ...snapshot, hoverData };
const jsonPath = path.join(OUT_DIR, `profile-menu-v5-${ts}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
console.log(`\n✅ JSON: ${jsonPath}`);

const svgPath = path.join(OUT_DIR, `profile-menu-v5-svgs-${ts}.txt`);
let svgDump = `/* ${snapshot.menuItems.length} пунктов, ${snapshot.menuItems.reduce((a, m) => a + m.svgs.length, 0)} SVG */\n\n`;
for (const item of snapshot.menuItems) {
  svgDump += `// ═══ "${item.text}" ═══\n`;
  for (const svg of item.svgs) {
    svgDump += `// ${svg.width}×${svg.height}\n`;
    svgDump += `${svg.outerHTML}\n\n`;
  }
}
fs.writeFileSync(svgPath, svgDump);
console.log(`✅ SVG: ${svgPath}`);

// ─── 5. Закрываем ───────────────────────────────────────────
try { await page.click('div._7b40dad div._2afd28d'); await page.waitForTimeout(300); } catch {}

await browser.close();