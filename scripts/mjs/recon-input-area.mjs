// scripts/mjs/recon-input-area.mjs
/**
 * @name recon-input-area
 * @purpose Recon input area DeepSeek: file inputs, attach buttons, drop zones, textarea + React handlers, существующие чипы
 * @input CDP :9222 (Yandex), вкладка chat.deepseek.com
 * @output recon-output/input-area-<ts>.json
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки DeepSeek
 * @tool false
 * @example node scripts/mjs/recon-input-area.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const YANDEX_CDP = 'http://127.0.0.1:9222';
const DEEPSEEK_HOST = 'chat.deepseek.com';

const PAGE_EVAL = () => {
  const out = {
    url: location.href,
    ua: navigator.userAgent,
    ts: new Date().toISOString(),
    fileInputs: [],
    attachButtons: [],
    dropZones: [],
    textarea: null,
    inputAreaContainer: null,
    inputAreaFullHTML: null,
    existingChips: [],
    textareaReactHandlers: [],
    fileInputReactHandlers: [],
  };

  // 1. input[type=file]
  document.querySelectorAll('input[type="file"]').forEach((el, i) => {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    const r = el.getBoundingClientRect();
    out.fileInputs.push({
      index: i, attrs,
      visible: el.offsetParent !== null,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      parentChain: (() => {
        const chain = []; let cur = el;
        for (let d = 0; d < 5 && cur; d++) {
          chain.push({ tag: cur.tagName, classes: (typeof cur.className === 'string' ? cur.className : '').slice(0, 120) });
          cur = cur.parentElement;
        }
        return chain;
      })(),
    });
    const keys = Object.keys(el).filter(k => k.startsWith('__reactProps'));
    for (const k of keys) {
      const props = el[k];
      if (props && typeof props === 'object') {
        out.fileInputReactHandlers.push({ index: i, handlers: Object.keys(props).filter(kk => kk.startsWith('on')) });
      }
    }
  });

  // 2. Кнопки attach
  const kw = /attach|upload|file|paperclip|clip|прикреп|файл|загруз/i;
  document.querySelectorAll('[aria-label], [title], button, [role="button"]').forEach(el => {
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    const cls = typeof el.className === 'string' ? el.className : '';
    if (!kw.test(label) && !kw.test(cls)) return;
    const r = el.getBoundingClientRect();
    out.attachButtons.push({
      tag: el.tagName, classes: cls.slice(0, 200), ariaLabel: label,
      visible: el.offsetParent !== null,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      hasSvg: !!el.querySelector('svg'),
      svgSample: el.querySelector('svg')?.outerHTML?.slice(0, 400),
    });
  });

  // 3. Drop-зоны
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n;
    const keys = Object.keys(el).filter(k => k.startsWith('__reactProps'));
    for (const k of keys) {
      const props = el[k];
      if (!props || typeof props !== 'object') continue;
      const dragHandlers = Object.keys(props).filter(kk => /^on(Drag|Drop)/i.test(kk));
      if (dragHandlers.length === 0) continue;
      const r = el.getBoundingClientRect();
      out.dropZones.push({
        tag: el.tagName,
        classes: (typeof el.className === 'string' ? el.className : '').slice(0, 150),
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
        dragHandlers,
      });
    }
  }

  // 4. Textarea
  const ta = document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]');
  if (ta) {
    const r = ta.getBoundingClientRect();
    out.textarea = {
      tag: ta.tagName, id: ta.id, name: ta.name, placeholder: ta.placeholder,
      classes: typeof ta.className === 'string' ? ta.className : '',
      rows: ta.rows,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      parentChain: (() => {
        const chain = []; let cur = ta.parentElement;
        for (let d = 0; d < 6 && cur; d++) {
          chain.push({
            tag: cur.tagName,
            classes: (typeof cur.className === 'string' ? cur.className : '').slice(0, 150),
            childCount: cur.children.length,
          });
          cur = cur.parentElement;
        }
        return chain;
      })(),
    };
    const keys = Object.keys(ta).filter(k => k.startsWith('__reactProps'));
    for (const k of keys) {
      const props = ta[k];
      if (props && typeof props === 'object') {
        out.textareaReactHandlers = Object.keys(props).filter(kk => kk.startsWith('on'));
      }
    }
    let cur = ta;
    for (let d = 0; d < 8 && cur; d++) {
      const cls = typeof cur.className === 'string' ? cur.className : '';
      if (/input|composer|editor|prompt|message/i.test(cls) && cur !== ta) {
        out.inputAreaContainer = {
          depth: d, tag: cur.tagName, classes: cls,
          outerHTMLSample: cur.outerHTML.slice(0, 8000),
        };
        break;
      }
      cur = cur.parentElement;
    }
    const compose = ta.closest('form') || ta.closest('[class*="input"]') || ta.parentElement?.parentElement;
    if (compose) out.inputAreaFullHTML = compose.outerHTML.slice(0, 30000);
  }

  // 5. Существующие чипы (для 1:1 рендера в GW)
  document.querySelectorAll('.eafda4ae').forEach((container, ci) => {
    container.querySelectorAll('._25c7358').forEach((chip, chi) => {
      out.existingChips.push({
        containerIndex: ci, chipIndex: chi,
        chipClasses: typeof chip.className === 'string' ? chip.className : '',
        name: chip.querySelector('.e70accd6')?.textContent?.trim() || '',
        meta: chip.querySelector('._7103a25')?.textContent?.trim() || '',
        svgSample: chip.querySelector('svg')?.outerHTML?.slice(0, 600) || '',
        chipFullHTML: chip.outerHTML.slice(0, 3000),
      });
    });
  });

  return out;
};

(async () => {
  const browser = await chromium.connectOverCDP(YANDEX_CDP);
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  const page = pages.find(p => p.url().includes(DEEPSEEK_HOST)) ?? pages[0];
  if (!page) { console.error('Нет вкладки DeepSeek'); process.exit(1); }

  console.log('[recon] Page:', page.url());
  console.log('[recon] UA:', await page.evaluate(() => navigator.userAgent));

  const result = await page.evaluate(PAGE_EVAL);

  const outDir = path.join(ROOT, 'recon-output');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `input-area-${Date.now()}.json`);
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log('[recon] fileInputs:', result.fileInputs.length);
  console.log('[recon] attachButtons:', result.attachButtons.length);
  console.log('[recon] dropZones:', result.dropZones.length);
  console.log('[recon] textarea handlers:', result.textareaReactHandlers);
  console.log('[recon] existingChips:', result.existingChips.length);
  console.log('[recon] ✅', outPath);

  process.exit(0);
})();