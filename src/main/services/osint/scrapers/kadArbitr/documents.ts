// src/main/services/osint/scrapers/kadArbitr/documents.ts
//
// Скачивание PDF судебных актов через контекст Playwright.
// Использует page.request — те же cookies/rcid, что у страниц карточки.
// Referer обязателен: kad отвергает скачивание без него.

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Page } from 'playwright';

export interface DownloadedDocument {
  localPath: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Извлекает UUID дела из URL PDF.
 *   /Kad/PdfDocument/{caseUuid}/{docId}/{filename}
 *   /Document/Pdf/{caseUuid}/{docId}/{filename}?isAddStamp=True
 */
export function extractCaseUuidFromPdfUrl(url: string): string {
  const m = url.match(
    /kad\.arbitr\.ru\/(?:Kad\/PdfDocument|Document\/Pdf)\/([a-f0-9-]+)/i
  );
  return m ? m[1] : '';
}

/**
 * Проверяет, что URL — это ссылка на PDF судебного акта kad.arbitr.
 */
export function isKadPdfUrl(url: string): boolean {
  return /kad\.arbitr\.ru\/(?:Kad\/PdfDocument|Document\/Pdf)\//i.test(url);
}

/**
 * Скачивает PDF судебного акта через route-перехват в новой вкладке
 * того же BrowserContext. Route ловит ответ ДО Chromium-плагина PDF-viewer,
 * поэтому тело доступно гарантированно.
 *
 * Первый запрос вернёт HTML с Pravocaptcha → JS в браузере пере-сабмитит
 * форму → второй запрос вернёт PDF. Route срабатывает на оба.
 */
export async function downloadKadDocument(
  page: Page,
  pdfUrl: string,
  caseUuid: string
): Promise<DownloadedDocument> {
  const fileNameMatch = pdfUrl.match(/\/([^/?]+\.pdf)/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : 'unknown.pdf';
  const yearMatch = fileName.match(/_(\d{4})\d{4}_/);
  const year = yearMatch ? yearMatch[1] : 'unknown_year';

  const dir = path.join(
    app.getPath('userData'),
    'raw_dumps',
    'kad',
    'docs',
    year
  );
  fs.mkdirSync(dir, { recursive: true });
  const localPath = path.join(dir, fileName);

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    return { localPath, sizeBytes: stat.size, contentType: 'application/pdf' };
  }

  const referer = caseUuid
    ? `https://kad.arbitr.ru/Card/${caseUuid}`
    : 'https://kad.arbitr.ru/';

  const ctx = page.context();
  const docPage = await ctx.newPage();

  // Диагностика: какие cookies в новой вкладке
  const cookies = await ctx.cookies('https://kad.arbitr.ru');
  console.log('[kad-pdf] cookies:',
    cookies.map(c => `${c.name}=${(c.value || '').slice(0, 8)}...`).join(', ')
  );
  const hasRcid = cookies.some(c => c.name === 'rcid' && c.value.length > 0);
  console.log('[kad-pdf] has rcid:', hasRcid);

  let savedResult: DownloadedDocument | null = null;

  // Перехватываем на уровне route — до Chromium PDF-viewer.
  await docPage.route(
    /\/Document\/Pdf\/|\/Kad\/PdfDocument\//i,
    async (route) => {
      if (savedResult) {
        await route.continue();
        return;
      }
      try {
        const response = await route.fetch();
        const body = await response.body();
        const magic = body.slice(0, 4).toString('utf-8');

        console.log('[kad-pdf] route:', route.request().method(), route.request().url(),
                    'content-type=', response.headers()['content-type'],
                    'magic=', magic,
                    'len=', body.length);

        if (magic !== '%PDF' && body.length > 10000) {
          try {
            const dumpPath = `/tmp/kad-pravocaptcha-${Date.now()}.html`;
            fs.writeFileSync(dumpPath, body);
            console.log('[kad-pdf] saved HTML to', dumpPath);
          } catch { /* ignore */ }
        }

        if (magic === '%PDF') {
          fs.writeFileSync(localPath, body);
          savedResult = {
            localPath,
            sizeBytes: body.length,
            contentType: 'application/pdf',
          };
        }
        await route.fulfill({ response, body });
      } catch (e) {
        console.warn('[kad-pdf] route error:', (e as Error).message);
        await route.continue();
      }
    }
  );

  try {
    await docPage
      .goto(pdfUrl, { referer, timeout: 90000, waitUntil: 'domcontentloaded' })
      .catch(() => null);

    const deadline = Date.now() + 60000;
    while (!savedResult && Date.now() < deadline) {
      await docPage.waitForTimeout(1000);
    }

    if (!savedResult) {
      throw new Error(
        'PDF не получен за 60 секунд. ' +
        'Возможно, Pravocaptcha требует ввода.'
      );
    }
    return savedResult;
  } finally {
    try { await docPage.close(); } catch { /* ignore */ }
  }
}