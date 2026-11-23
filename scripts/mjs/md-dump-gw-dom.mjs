// scripts/mjs/md-dump-gw-dom.mjs
/**
 * @name md-dump-gw-dom
 * @purpose Дамп markdown-контейнера из GW renderer через CDP + metrics
 * @input env: CDP_URL (default http://127.0.0.1:9223), OUT (default md-recon/gw-dom-dump.json), MSG_INDEX (default -1 = последнее)
 * @output <OUT>.json + <OUT>.html; stdout: metrics
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — renderer не найден / markdown-контейнер не найден
 * @tool false
 * @example node scripts/mjs/md-dump-gw-dom.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const OUT = process.env.OUT || 'md-recon/gw-dom-dump.json';
const MSG_INDEX = Number(process.env.MSG_INDEX ?? -1);

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
  if (p.url().startsWith('http://localhost') || p.url().startsWith('file://') || p.url().includes('index.html'))
    page = p;
if (!page) { console.error('❌ renderer не найден'); process.exit(1); }

const data = await page.evaluate((idx) => {
  // Ищем markdown-контейнеры в отрендеренном GW.
  // Если в GatewayMessageAssistant есть специфичный класс/атрибут — используй его,
  // по умолчанию ищем по ds-markdown-paragraph (тот же признак, что и в PW).
  const roots = [];
  document.querySelectorAll('.ds-markdown-paragraph, [class*="markdown"]').forEach((p) => {
    let el = p;
    while (el && !(el.className?.toString?.().match?.(/(ds-markdown|markdown-body|message-content)/))) el = el.parentElement;
    if (el && !roots.includes(el)) roots.push(el);
  });
  const target = idx < 0 ? roots[roots.length - 1] : roots[idx];
  if (!target) return { error: 'markdown-контейнер в GW не найден', total: roots.length };

  const allClasses = Array.from(new Set(
    Array.from(target.querySelectorAll('[class]')).flatMap((e) => Array.from(e.classList))
  )).sort();
  const tagCounts = Array.from(target.querySelectorAll('*'))
    .reduce((a, e) => { const t = e.tagName.toLowerCase(); a[t] = (a[t] || 0) + 1; return a; }, {});

  return {
    totalMessages: roots.length,
    messageIndex: idx < 0 ? roots.length - 1 : idx,
    domOuterHtml: target.outerHTML,
    allClasses,
    tagCounts,
    // Полезно: что лежит прямо в dangerouslySetInnerHTML-пропсе
    _parentClasses: target.parentElement?.className,
  };
}, MSG_INDEX);

if (data.error) { console.error('❌', data); process.exit(1); }
data.metrics = metric(data.domOuterHtml);
data.source = 'gw-dom';
data.capturedAt = new Date().toISOString();

fs.mkdirSync('md-recon', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
fs.writeFileSync(OUT.replace(/\.json$/, '.html'), data.domOuterHtml);
console.log('✅ GW-DOM dump:', OUT);
console.log('   metrics:', data.metrics);
await browser.close();