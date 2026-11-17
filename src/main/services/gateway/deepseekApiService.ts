// src/main/services/gateway/deepseekApiService.ts
//
// MVP-клиент официального DeepSeek API.
// Используется как fallback-канал, когда web-канал (Yandex/Chrome) недоступен
// из-за детекта/капчи/рейт-лимита. Совместим с OpenAI Chat Completions.

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ApiChatOpts {
  /**
   * Модель. Дефолт — 'deepseek-flash' (V4.1, поддерживает изображения, 1M контекст).
   * Алиасы 'deepseek-chat' / 'deepseek-reasoner' тоже работают (мапятся на сервере).
   */
  model?: string;
  /** Профиль (для учёта расхода). Дефолт — 'default'. */
  profileId?: string;
  temperature?: number;
  /** Reasoning-токены тоже считаются сюда. Для V4 минимум 4096, лучше 8192+. */
  max_tokens?: number;
  /** Уровень усилий для V4-моделей: low / high / max. */
  effort?: 'low' | 'high' | 'max';
  signal?: AbortSignal;
  /** Колбэк на каждый delta: reasoning (chain-of-thought) и content (ответ). */
  onDelta?: (d: { reasoning?: string; content?: string }) => void;
}

import { recordUsage } from './apiUsageDb';

const API_BASE = 'https://api.deepseek.com';

export class DeepSeekApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) {
    super(message);
  }
}

export async function chat(apiKey: string, messages: ApiMessage[], opts: ApiChatOpts = {}): Promise<{ content: string; reasoning: string; raw: unknown; usage: unknown }> {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new DeepSeekApiError(401, 'no_key', 'API-ключ не задан');
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? 'deepseek-flash',
    messages,
    temperature: opts.temperature ?? 1.0,
    max_tokens: opts.max_tokens ?? 8192,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (opts.effort) body.effort = opts.effort;

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let txt = '';
    try { txt = await res.text(); } catch { /* ignore */ }
    throw new DeepSeekApiError(res.status, null, `DeepSeek API ${res.status}: ${txt.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let content = '';
  let reasoning = '';
  let rawFinal: unknown = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE: события разделены \n\n; каждая строка начинается с "data: "
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { rawFinal = { done: true }; continue; }
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta ?? {};
          if (delta.reasoning_content) {
            reasoning += delta.reasoning_content;
            opts.onDelta?.({ reasoning: delta.reasoning_content });
          }
          if (delta.content) {
            content += delta.content;
            opts.onDelta?.({ content: delta.content });
          }
          if (j.usage) rawFinal = { usage: j.usage };
        } catch { /* игнорим битые строки */ }
      }
    }
  }

  const usage = (rawFinal as any)?.usage ?? null;
  if (usage) {
    try {
      const promptTokens     = Number(usage.prompt_tokens ?? 0);
      const completionTokens = Number(usage.completion_tokens ?? 0);
      const reasoningTokens  = Number(usage.completion_tokens_details?.reasoning_tokens ?? 0);
      const cacheHitTokens   = Number(usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0);
      const cacheMissTokens  = Number(usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens));
      recordUsage({
        profileId: opts.profileId ?? 'default',
        model: body.model as string,
        effort: (body.effort as string | undefined) ?? null,
        promptTokens, completionTokens, reasoningTokens,
        cacheHitTokens, cacheMissTokens,
      });
    } catch (e) {
      console.warn('[deepseekApi] recordUsage failed:', (e as Error).message);
    }
  }
  return { content, reasoning, raw: rawFinal, usage };
}

/** Простая проверка ключа: 1 короткий запрос, не-стриминговый. */
export async function ping(apiKey: string): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  if (!apiKey || !apiKey.startsWith('sk-')) return { ok: false, error: 'no_key' };
  try {
    const res = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = await res.json();
    return { ok: true, models: (j.data || []).map((m: any) => m.id) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}