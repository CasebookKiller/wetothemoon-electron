// src/main/services/pranaBindu/tileCache.ts
import { app, net, protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = path.join(app.getPath('userData'), 'pb-tile-cache');

function getTilePath(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const subDir = hash.slice(0, 2);
  return path.join(CACHE_DIR, subDir, `${hash}.png`);
}

export function registerTileCacheProtocol() {
  protocol.handle('pb-tile', async (request) => {
    const actualUrl = request.url.replace('pb-tile://', 'https://');
    const tilePath = getTilePath(actualUrl);

    try {
      // 1. Пробуем отдать с диска
      const cachedData = await fs.readFile(tilePath);
      return new Response(cachedData, {
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*', // <-- Разрешаем CORS
        },
      });
    } catch {
      // 2. Если нет — качаем
      try {
        const response = await net.fetch(actualUrl, {
          headers: {
            'User-Agent': 'wetothemoon-electron/1.0 (https://github.com/CasebookKiller; casebookkiller@yandex.ru)', // <-- Замени на свой контакт
            'Referer': 'https://casebookkiller.github.io/wetothemoon-electron', // OSM также рекомендует Referer
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Сохраняем в фоне, чтобы не задерживать ответ
        fs.mkdir(path.dirname(tilePath), { recursive: true })
          .then(() => fs.writeFile(tilePath, buffer))
          .catch((e) => console.warn('[TileCache] save error:', e));

        return new Response(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Access-Control-Allow-Origin': '*', // <-- Разрешаем CORS
          },
        });
      } catch (err) {
        console.warn('[TileCache] fetch error:', actualUrl);
        return new Response('Not Found', { status: 404 });
      }
    }
  });
}