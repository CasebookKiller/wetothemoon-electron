// scripts/mjs/md-dump-pw.mjs
/**
 * @name md-dump-pw
 * @purpose Дамп эталонного `.ds-markdown` из живого PW (deepseek.com) через CDP + metrics
 * @input env: CDP_URL (default http://127.0.0.1:9222), OUT (default md-recon/pw-dump.json), MSG_INDEX (default -1)
 * @output <OUT>.json + <OUT>.html; stdout: metrics
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки deepseek.com / ds-markdown не найден
 * @tool false
 * @example node scripts/mjs/md-dump-pw.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUT = process.env.OUT || 'md-recon/pw-dump.json';
const MSG_INDEX = Number(process.env.MSG_INDEX ?? -1); // -1 = последнее ассистентское

const metric = (html) => {
  const c = (re) => (html.match(re) || []).length;
  return {
    length: html.length,
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

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const ctx of browser.contexts()) for (const p of ctx.pages())
  if (p.url().includes('deepseek.com')) page = p;
if (!page) { console.error('❌ нет вкладки deepseek.com'); process.exit(1); }

const data = await page.evaluate((idx) => {
  // .ds-markdown — корень markdown-блока внутри сообщения ассистента
  const mdRoots = [];
  document.querySelectorAll('.ds-markdown-paragraph, .ds-markdown').forEach((p) => {
    let el = p;
    while (el && !(el.className?.toString?.().match?.(/\bds-markdown\b/))) el = el.parentElement;
    if (el && !mdRoots.includes(el)) mdRoots.push(el);
  });
  const target = idx < 0 ? mdRoots[mdRoots.length - 1] : mdRoots[idx];
  if (!target) return { error: 'ds-markdown не найден', total: mdRoots.length };

  // Поднимаемся на 1-3 уровня, чтобы захватить контейнер сообщения (с кнопками Copy/Regenerate)
  let container = target;
  for (let i = 0; i < 4 && container.parentElement; i++) {
    const p = container.parentElement;
    if (p.querySelector('[class*="ds-icon-button"], [class*="action"]')) { container = p; break; }
    container = p;
  }

  const allClasses = Array.from(new Set(
    Array.from(target.querySelectorAll('[class]'))
      .flatMap((e) => Array.from(e.classList))
  )).sort();
  const tagCounts = Array.from(target.querySelectorAll('*'))
    .reduce((a, e) => { const t = e.tagName.toLowerCase(); a[t] = (a[t] || 0) + 1; return a; }, {});

  return {
    messageIndex: idx < 0 ? mdRoots.length - 1 : idx,
    totalMessages: mdRoots.length,
    mdOuterHtml: target.outerHTML,
    containerOuterHtml: container.outerHTML,
    allClasses,
    tagCounts,
  };
}, MSG_INDEX);

if (data.error) { console.error('❌', data); process.exit(1); }
data.metrics = metric(data.mdOuterHtml);
data.source = 'pw';
data.capturedAt = new Date().toISOString();

fs.mkdirSync('md-recon', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
fs.writeFileSync(OUT.replace(/\.json$/, '.html'), data.mdOuterHtml);
console.log('✅ PW dump:', OUT);
console.log('   metrics:', data.metrics);
await browser.close();