// src/components/GATEWAY/utils/tokenEstimator.ts

// Актуальное контекстное окно DeepSeek (V4 Pro / V4 Flash) — 1M токенов.
// Источник: официальная документация api-docs.deepseek.com (context_window: 1048576).
export const CONTEXT_WINDOW_TOKENS = 1_048_576;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let latin = 0, cyrillic = 0, cjk = 0, other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x0400) latin++;
    else if (code < 0x0500) cyrillic++;
    else if (code < 0x3000) other++;
    else cjk++;
  }
  return Math.ceil(latin / 4 + cyrillic / 2.5 + other / 3 + cjk / 1.5);
}

export function estimateConversationTokens(
  messages: Array<{ contentPlain: string; thinking?: string }>
): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.contentPlain || '');
    if (m.thinking) total += estimateTokens(m.thinking);
    total += 15;
  }
  return total;
}