// src/shared/sensitive/wordlists/index.ts

import crypto from 'crypto';
import { BIP39_EN } from './bip39-en';
import { BIP39_RU } from './bip39-ru';

export type WordlistLang = 'en' | 'ru';

export const WORDLISTS: Record<WordlistLang, string[]> = {
  en: BIP39_EN,
  ru: BIP39_RU,
};

export const MIN_PHRASE_WORDS = 10;
export const MAX_PHRASE_WORDS = 24;
export const DEFAULT_PHRASE_WORDS = 12;
const MIN_WORDLIST_SIZE = 256;

export function isWordlistReady(lang: WordlistLang): boolean {
  return (WORDLISTS[lang]?.length ?? 0) >= MIN_WORDLIST_SIZE;
}

export function getWordlist(lang: WordlistLang): string[] {
  const list = WORDLISTS[lang];
  if (!list || list.length < MIN_WORDLIST_SIZE) {
    throw new Error(
      `Словник "${lang}" не загружен или слишком короткий (${list?.length ?? 0}). ` +
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