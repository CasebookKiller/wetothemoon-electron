// scripts/recon-profile-menu.mjs
//
// Recon меню профиля в сайдбаре DeepSeek (PW):
//   - trigger (аватар + имя + "..."): HTML + computed styles
//   - dropdown после клика: HTML + computed styles
//   - все SVG внутри обоих блоков
//
// Запуск:
//   node scripts/recon-profile-menu.mjs
//   CDP_URL=http://127.0.0.1:9222 node scripts/recon-profile-menu.mjs
//
// Пишет:
//   recon-output/profile-menu-<ts>.json
//   recon-output/profile-menu-<ts>.html

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = 'recon-output';

const ts = Date.now();
fs.mkdirSync(OUT_DIR, { recursive: true });

// Хелпер: снять computed-стили для ключевых полей (в контексте браузера)
const STYLE_KEYS = [
  'display', 'position', 'width', 'height', 'minWidth', 'maxWidth',
  'padding', 'margin', 'border', 'borderRadius',
  'background', 'backgroundColor', 'backgroundImage',
  'color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
  'boxShadow', 'opacity', 'overflow', 'zIndex',
  'top', 'left', 'right', 'bottom',
  'flexDirection', 'alignItems', 'justifyContent', 'gap',
  'transition', 'transform',
];

const styleSnapshot = (el) => {
  const cs = getComputedStyle(el);
  const out = {};
  for (const k of STYLE_KEYS) out[k] = cs[k];
  return out;
};

const svgDump = (el) => {
  return Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || svg.getBoundingClientRect().width,
    height: svg.getAttribute('height') || svg.getBoundingClientRect().height,
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
  }));
};

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

// ──────────────────────────────────────────────────────────────
// ЭТАП 1: Найти trigger профиля
// ──────────────────────────────────────────────────────────────
// По твоему HTML: <div class="_2afd28d" tabindex="0"> внутри <div class="_7b40dad f14f3a6d">
// Логика: ищем _2afd28d внутри сайдбара (обычно правая нижняя часть).
// Fallback: первый элемент с tabindex=0, содержащий <img> аватар.
// ──────────────────────────────────────────────────────────────

const triggerInfo = await page.evaluate(({ STYLE_KEYS }) => {
  // Кандидаты — по классу из HTML
  let trigger = document.querySelector('div._7b40dad div._2afd28d');
  // Fallback: искать элемент с tabindex=0, у которого есть img (аватар)
  if (!trigger) {
    const candidates = Array.from(document.querySelectorAll('[tabindex="0"]'));
    trigger = candidates.find((el) => el.querySelector('img')) || null;
  }
  if (!trigger) return { error: 'trigger не найден' };

  const styleSnapshot = (el) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const k of STYLE_KEYS) out[k] = cs[k];
    return out;
  };
  const svgDump = (el) => Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || Math.round(svg.getBoundingClientRect().width),
    height: svg.getAttribute('height') || Math.round(svg.getBoundingClientRect().height),
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
  }));

  // Поднимаемся на 2-3 уровня вверх, чтобы захватить весь "виджет" профиля
  const container = trigger.closest('div._7b40dad') || trigger.parentElement || trigger;

  const avatarImg = trigger.querySelector('img');
  const nameEl = trigger.querySelector('._9d8da05') || Array.from(trigger.querySelectorAll('div')).find(
    (d) => d.children.length === 0 && (d.textContent || '').trim().length > 0
  );

  return {
    container: {
      classes: container.className,
      outerHTML: container.outerHTML,
      styles: styleSnapshot(container),
      rect: container.getBoundingClientRect().toJSON(),
    },
    trigger: {
      classes: trigger.className,
      outerHTML: trigger.outerHTML,
      styles: styleSnapshot(trigger),
      rect: trigger.getBoundingClientRect().toJSON(),
    },
    avatar: avatarImg ? {
      src: avatarImg.getAttribute('src'),
      alt: avatarImg.getAttribute('alt'),
      classes: avatarImg.className,
      styles: styleSnapshot(avatarImg),
    } : null,
    name: nameEl ? {
      text: (nameEl.textContent || '').trim(),
      classes: nameEl.className,
      styles: styleSnapshot(nameEl),
    } : null,
    svgs: svgDump(container),
  };
}, { STYLE_KEYS });

if (triggerInfo.error) {
  console.error('❌', triggerInfo.error);
  await browser.close();
  process.exit(1);
}

console.log('✅ Trigger найден:');
console.log('   container classes:', triggerInfo.container.classes);
console.log('   trigger classes:  ', triggerInfo.trigger.classes);
console.log('   avatar:', triggerInfo.avatar?.src?.slice(0, 60));
console.log('   name:  ', triggerInfo.name?.text);
console.log('   svgs in container:', triggerInfo.svgs.length);
console.log('   container rect:', triggerInfo.container.rect);
console.log();

// ──────────────────────────────────────────────────────────────
// ЭТАП 2: Кликнуть и снять выпадающее меню
// ──────────────────────────────────────────────────────────────

// Снимаем HTML до клика — чтобы потом найти "новые" элементы
const htmlBefore = await page.evaluate(() => document.body.innerHTML.length);

console.log('🖱  Клик по trigger...');
try {
  // Кликаем через DOM (не через page.click — Playwright может не найти
  // элемент из-за ShadowRoot / динамических классов)
  await page.evaluate((sel) => {
    let trigger = document.querySelector('div._7b40dad div._2afd28d');
    if (!trigger) {
      const candidates = Array.from(document.querySelectorAll('[tabindex="0"]'));
      trigger = candidates.find((el) => el.querySelector('img'));
    }
    if (trigger) trigger.click();
  }, null);

  await page.waitForTimeout(800); // ждём анимацию раскрытия меню
} catch (e) {
  console.warn('⚠️  клик упал:', e.message);
}

// Ищем выпадающее меню: элементы с position:fixed|absolute, появившиеся ПОСЛЕ клика,
// с высоким z-index и видимой геометрией.
const dropdownInfo = await page.evaluate(({ STYLE_KEYS, htmlBefore }) => {
  const styleSnapshot = (el) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const k of STYLE_KEYS) out[k] = cs[k];
    return out;
  };
  const svgDump = (el) => Array.from(el.querySelectorAll('svg')).map((svg, i) => ({
    index: i,
    outerHTML: svg.outerHTML,
    width: svg.getAttribute('width') || Math.round(svg.getBoundingClientRect().width),
    height: svg.getAttribute('height') || Math.round(svg.getBoundingClientRect().height),
    fill: getComputedStyle(svg).fill,
    color: getComputedStyle(svg).color,
  }));

  // Кандидаты на dropdown: любые элементы с position fixed/absolute, z-index > 10,
  // видимая площадь > 50x50, содержат 2+ "пункта" (div/button/li с текстом).
  const all = Array.from(document.querySelectorAll('body *'));
  const candidates = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 40) continue;
    const cs = getComputedStyle(el);
    if (!['fixed', 'absolute'].includes(cs.position)) continue;
    const z = parseInt(cs.zIndex, 10) || 0;
    if (z < 5) continue;

    // Считаем "пункты" — элементы-потомки с текстом и ролью кнопки
    const items = Array.from(el.querySelectorAll(
      'button, [role="button"], [role="menuitem"], li, div[tabindex]'
    )).filter((c) => (c.textContent || '').trim().length > 0 && !c.contains(el));

    if (items.length >= 1) {
      candidates.push({
        tag: el.tagName.toLowerCase(),
        classes: el.className,
        outerHTML: el.outerHTML,
        styles: styleSnapshot(el),
        rect: r.toJSON(),
        itemCount: items.length,
        itemsText: items.slice(0, 10).map((it) => ({
          tag: it.tagName.toLowerCase(),
          classes: it.className,
          text: (it.textContent || '').trim().slice(0, 80),
          styles: styleSnapshot(it),
        })),
        svgs: svgDump(el),
      });
    }
  }

  // Сортируем по z-index (наибольший — самый "верхний") и площади
  candidates.sort((a, b) => {
    const za = parseInt(a.styles.zIndex, 10) || 0;
    const zb = parseInt(b.styles.zIndex, 10) || 0;
    if (za !== zb) return zb - za;
    return b.rect.width * b.rect.height - a.rect.width * a.rect.height;
  });

  return {
    htmlLenBefore: htmlBefore,
    htmlLenAfter: document.body.innerHTML.length,
    candidates: candidates.slice(0, 5), // топ-5
  };
}, { STYLE_KEYS, htmlBefore });

console.log(`📦 DOM вырос: ${dropdownInfo.htmlLenBefore} → ${dropdownInfo.htmlLenAfter} (+${dropdownInfo.htmlLenAfter - dropdownInfo.htmlLenBefore})`);
console.log(`🎯 Кандидатов на dropdown: ${dropdownInfo.candidates.length}`);
if (dropdownInfo.candidates.length === 0) {
  console.warn('⚠️  Ничего не появилось после клика. Возможно, меню рендерится в portal с position: fixed, но фильтр по z-index или площади отсёк.');
}

for (const c of dropdownInfo.candidates) {
  console.log(`   - ${c.tag}.${c.classes.split(' ').slice(0, 3).join('.')} | z=${c.styles.zIndex} | items=${c.itemCount} | ${Math.round(c.rect.width)}×${Math.round(c.rect.height)}`);
  for (const it of c.itemsText) {
    console.log(`       → "${it.text}" (${it.tag}.${it.classes.split(' ').slice(0, 2).join('.')})`);
  }
}
console.log();

// ──────────────────────────────────────────────────────────────
// ЭТАП 3: Сохраняем всё
// ──────────────────────────────────────────────────────────────

const out = {
  capturedAt: new Date().toISOString(),
  cdpUrl: CDP,
  pwUrl: page.url(),
  trigger: triggerInfo,
  dropdown: dropdownInfo,
};

const jsonPath = path.join(OUT_DIR, `profile-menu-${ts}.json`);
const htmlPath = path.join(OUT_DIR, `profile-menu-${ts}.html`);

fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));

// HTML-дамп: trigger + все dropdown-кандидаты
let htmlDump = `<!-- TRIGGER (${triggerInfo.container.classes}) -->\n`;
htmlDump += triggerInfo.container.outerHTML + '\n\n';
htmlDump += `<!-- DROPDOWN CANDIDATES (top ${dropdownInfo.candidates.length}) -->\n`;
dropdownInfo.candidates.forEach((c, i) => {
  htmlDump += `\n<!-- [${i}] ${c.tag}.${c.classes} z=${c.styles.zIndex} items=${c.itemCount} -->\n`;
  htmlDump += c.outerHTML + '\n';
});
fs.writeFileSync(htmlPath, htmlDump);

console.log(`✅ JSON: ${jsonPath}`);
console.log(`✅ HTML: ${htmlPath}`);
console.log();
console.log('📋 Дальше:');
console.log('   1. Открой JSON → найди нужные классы в trigger/dropdown');
console.log('   2. Открой HTML → скопируй нужные SVG (они уже в GatewayIcons.tsx стиле)');
console.log('   3. Пришли мне только trigger.classes + dropdown.classes + itemsText');

// Закрываем меню обратно (клик по trigger ещё раз)
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