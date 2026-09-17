// src/shared/sensitive/wordlists/index.ts

import crypto from 'crypto';
import { BIP39_EN } from './bip39-en';
import { BIP39_RU } from './bip39-ru';

export type WordlistLang = 'en' | 'ru';

export const MIN_PHRASE_WORDS = 10;
export const MAX_PHRASE_WORDS = 24;
export const DEFAULT_PHRASE_WORDS = 12;
const MIN_WORDLIST_SIZE = 256;
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 8;
const PREFIX_LENGTH = 4;

/**
 * Очищает словарь: удаляет дубликаты, коллизии префиксов и слова
 * неправильной длины. Возвращает уже готовый к использованию массив.
 */
function dedupeWordlist(raw: string[]): string[] {
  const cleaned: string[] = [];
  const seenWords = new Set<string>();
  const seenPrefixes = new Set<string>();

  for (const word of raw) {
    if (!word) continue;

    // 1. Длина
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) continue;

    // 2. Дубликат
    if (seenWords.has(word)) continue;

    // 3. Коллизия по первым 4 символам
    const prefix = word.slice(0, PREFIX_LENGTH);
    if (seenPrefixes.has(prefix)) continue;

    seenWords.add(word);
    seenPrefixes.add(prefix);
    cleaned.push(word);
  }

  return cleaned;
}

let cleanedEnCache: string[] | null = null;
let cleanedRuCache: string[] | null = null;

function getCleanedList(lang: WordlistLang): string[] {
  if (lang === 'en') {
    if (cleanedEnCache === null) cleanedEnCache = dedupeWordlist(BIP39_EN);
    return cleanedEnCache;
  } else {
    if (cleanedRuCache === null) cleanedRuCache = dedupeWordlist(BIP39_RU);
    return cleanedRuCache;
  }
}

export function isWordlistReady(lang: WordlistLang): boolean {
  return getCleanedList(lang).length >= MIN_WORDLIST_SIZE;
}

export function getWordlist(lang: WordlistLang): string[] {
  const list = getCleanedList(lang);
  if (list.length < MIN_WORDLIST_SIZE) {
    throw new Error(
      `Словник "${lang}" слишком короткий после очистки (${list.length}). ` +
      `Минимум ${MIN_WORDLIST_SIZE} слов.`
    );
  }
  return list;
}

export function generatePhrase(lang: WordlistLang, wordCount = DEFAULT_PHRASE_WORDS): string {
  const list = getWordlist(lang);
  const listSize = list.length;

  const maxUint32 = 0xFFFFFFFF;
  const limit = Math.floor(maxUint32 / listSize) * listSize;

  const words: string[] = [];
  while (words.length < wordCount) {
    const buf = crypto.randomBytes(4);
    const n = buf.readUInt32BE(0);
    if (n < limit) {
      words.push(list[n % listSize]);
    }
  }
  return words.join(' ');
}

export function validatePhrase(
  phrase: string,
  lang: WordlistLang,
  minWords = MIN_PHRASE_WORDS,
  maxWords = MAX_PHRASE_WORDS
): { valid: boolean; error?: string } {
  const words = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length < minWords) return { valid: false, error: `Минимум ${minWords} слов` };
  if (words.length > maxWords) return { valid: false, error: `Максимум ${maxWords} слов` };

  if (!isWordlistReady(lang)) {
    // словарь пуст — валидируем только по количеству
    return { valid: true };
  }

  const set = new Set(getWordlist(lang));
  const invalid = words.filter((w) => !set.has(w));
  if (invalid.length > 0) {
    return { valid: false, error: `Неизвестные слова: ${invalid.slice(0, 3).join(', ')}` };
  }

  return { valid: true };
}

/**
 * Диагностика: возвращает список проблем и итоговое количество.
 * Вызывайте вручную в DevTools при подозрениях.
 */
export function diagnoseWordlist(lang: WordlistLang): {
  rawCount: number;
  cleanedCount: number;
  removedCount: number;
  ready: boolean;
} {
  const raw = lang === 'en' ? BIP39_EN : BIP39_RU;
  const cleaned = getCleanedList(lang);
  return {
    rawCount: raw.length,
    cleanedCount: cleaned.length,
    removedCount: raw.length - cleaned.length,
    ready: cleaned.length >= MIN_WORDLIST_SIZE,
  };
}