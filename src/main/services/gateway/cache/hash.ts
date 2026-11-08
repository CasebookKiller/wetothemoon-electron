// src/main/services/gateway/cache/hash.ts

import { createHash } from 'crypto';
import type { MessageRole } from './types';

/**
 * Стабильный hash сообщения внутри диалога.
 * Цепочка parentHash гарантирует: одинаковый текст на разных позициях
 * получает разный hash (иначе UNIQUE INDEX не спасал бы от дублей).
 *
 * Формат: sha256(`${convId}:${role}:${contentPlain}:${parentHash ?? ''}`)
 *          → hex, 16 символов.
 */
/**
 * Стабильный hash сообщения внутри диалога.
 * salt — обычно `pw_key` (data-virtual-list-item-key, стабилен
 * и уникален в пределах диалога), либо parentHash как fallback
 * для сообщений без pw_key.
 */
export function computeMessageHash(
  convId: string,
  role: MessageRole,
  contentPlain: string,
  salt?: string
): string {
  return createHash('sha256')
    .update(`${convId}:${role}:${contentPlain}:${salt ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}