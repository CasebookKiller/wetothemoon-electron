// scripts/mjs/md-live-probe.mjs
/**
 * @name md-live-probe
 * @purpose Live-снапшоты стрима (длительность LIVE_MS) в recon-output/live-stream.jsonl — детект throttle/мерцания
 * @input env: CDP_URL (default http://127.0.0.1:9222), LIVE_MS (default 60000)
 * @output recon-output/live-stream.jsonl (append по каждому изменению .ds-markdown)
 * @args null
 * @result null
 * @exit 0 — успех (по таймауту)
 * @exit 1 — нет вкладки deepseek.com
 * @tool false
 * @example LIVE_MS=30000 node scripts/mjs/md-live-probe.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const DURATION_MS = Number(process.env.LIVE_MS || 60_000);
const OUT = 'recon-output/live-stream.jsonl';
fs.mkdirSync('recon-output', { recursive: true });
fs.writeFileSync(OUT, '');

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const ctx of browser.contexts()) for (const p of ctx.pages())
  if (p.url().includes('deepseek.com')) page = p;
if (!page) { console.error('❌ нет вкладки deepseek.com'); process.exit(1); }

console.log(`🎥 live-снапшоты ${DURATION_MS/1000}с → ${OUT}`);
console.log('Отправь сейчас сообщение в PW (или дождись стрима).');

await page.exposeFunction('__liveSnap', (snap) => {
  fs.appendFileSync(OUT, JSON.stringify({ ts: Date.now(), ...snap }) + '\n');
});

await page.evaluate((ms) => {
  const start = Date.now();
  const c = (s, re) => (s.match(re) || []).length;
  let lastHtml = '';
  let lastLen = -1;
  const tick = () => {
    const md = document.querySelectorAll('.ds-markdown');
    const el = md[md.length - 1];
    if (el) {
      const html = el.outerHTML;
      if (html !== lastHtml) {
        lastHtml = html;
        const m = {
          t: Date.now() - start,
          len: html.length,
          p: c(html, /ds-markdown-paragraph/g),
          tok: c(html, /class="token/g),
          katex: c(html, /katex/g),
          pre: c(html, /<pre/gi),
          code: c(html, /<code/gi),
          tbl: c(html, /<table/gi),
          li: c(html, /<li/gi),
          h3: c(html, /<h3/gi),
          strong: c(html, /<strong/gi),
          shrink: lastLen >= 0 && html.length < lastLen - 50, // ← сигнал throttle-обрезки
        };
        lastLen = html.length;
        window.__liveSnap(m);
      }
    }
    if (Date.now() - start < ms) setTimeout(tick, 300);
    else window.__liveSnap({ done: true, t: Date.now() - start });
  };
  tick();
}, DURATION_MS);

setTimeout(async () => { await browser.close(); console.log('\n✅ закрыто'); }, DURATION_MS + 2_000);