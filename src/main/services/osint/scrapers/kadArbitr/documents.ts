// src/main/services/osint/scrapers/kadArbitr/documents.ts
//
// Скачивание PDF судебных актов через контекст Playwright.
// Работаем в СУЩЕСТВУЮЩЕЙ вкладке (не создаём новую):
//  - rcid и ASP.NET_SessionId уже активны;
//  - Referer естественный — мы на /Card/{uuid};
//  - Pravocaptcha если появится — в интерфейсе пользователя,
//    а не в скрытой вкладке (можно решить руками).

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
 * Проверяет, что URL — ссылка на PDF судебного акта kad.arbitr.
 */
export function isKadPdfUrl(url: string): boolean {
  return /kad\.arbitr\.ru\/(?:Kad\/PdfDocument|Document\/Pdf)\//i.test(url);
}

/**
 * Скачивает PDF судебного акта с kad.arbitr.
 *
 * Гипотеза: kad проверяет Referer. При прямом fetch без Referer карточки
 * отдаётся Pravocaptcha. Значит нужно:
 *  1. Сначала перейти на карточку дела (/Card/{caseUuid}) — Referer станет правильный.
 *  2. Затем fetch на исходный URL /Kad/PdfDocument/... (он редиректит на
 *     /Document/Pdf/...?isAddStamp=True сам).
 */
export async function downloadKadDocument(
  page: Page,
  pdfUrl: string,
  targetDir: string
): Promise<{
  success: boolean;
  savedPath?: string;
  error?: string;
  size?: number;
  status?: number;
  debug?: any;
}> {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const urlObj = new URL(pdfUrl);
    const filename = decodeURIComponent(
      urlObj.pathname.split('/').pop() || 'document.pdf'
    );
    const targetPath = path.join(targetDir, filename);

    // Извлекаем caseUuid и docUuid из пути.
    // Форматы:
    //   /Document/Pdf/{caseUuid}/{docUuid}/{filename}.pdf?isAddStamp=True
    //   /Kad/PdfDocument/{caseUuid}/{docUuid}/{filename}.pdf
    const parts = urlObj.pathname.split('/').filter(Boolean);
    const caseUuid = parts[2]; // 2-й после /Document/Pdf или /Kad/PdfDocument
    const docUuid = parts[3];

    // 1. Навигация на карточку дела — чтобы Referer стал правильный
    if (caseUuid) {
      const cardUrl = `https://kad.arbitr.ru/Card/${caseUuid}`;
      console.log(`[kad] Навигация на карточку: ${cardUrl}`);
      await page.goto(cardUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      // Даём JS прогрузиться (Pravocaptcha проверка на карточке)
      await page.waitForTimeout(3000);
    }

    // 2. Формируем исходный URL (Kad/PdfDocument) — без ?isAddStamp=True
    //    Он редиректит на Document/Pdf/... сам.
    const originalUrl = docUuid
      ? `https://kad.arbitr.ru/Kad/PdfDocument/${caseUuid}/${docUuid}/${filename}`
      : pdfUrl;

    console.log(`[kad] fetch original: ${originalUrl}`);

    // 3. Fetch изнутри страницы (Referer = /Card/{caseUuid} теперь)
    const result = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, {
          credentials: 'include',
          redirect: 'follow',
        });
        const ct = r.headers.get('content-type') || '';
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);

        // Base64
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.byteLength; i += chunk) {
          binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
          );
        }
        const base64 = btoa(binary);

        return {
          base64,
          size: bytes.byteLength,
          status: r.status,
          contentType: ct,
          finalUrl: r.url,
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, originalUrl);

    const res = result as any;

    console.log(
      `[kad] fetch результат: status=${res.status} ct=${res.contentType} size=${res.size} url=${res.finalUrl}`
    );

    if (res.error) {
      return { success: false, error: res.error, status: res.status };
    }

    if (!res.base64 || !res.size) {
      return { success: false, error: 'Пустое тело ответа' };
    }

    if (!res.contentType?.includes('pdf')) {
      return {
        success: false,
        error: `Не PDF. content-type=${res.contentType}, размер=${res.size}`,
        debug: { finalUrl: res.finalUrl, status: res.status },
      };
    }

    const buffer = Buffer.from(res.base64, 'base64');
    fs.writeFileSync(targetPath, buffer);

    console.log(
      `[kad] PDF сохранён: ${targetPath} (${buffer.length} байт, status=${res.status})`
    );

    return {
      success: true,
      savedPath: targetPath,
      size: buffer.length,
      status: res.status,
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}


