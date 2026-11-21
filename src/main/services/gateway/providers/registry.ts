/**
 * Реестр провайдеров. Центральное место регистрации адаптеров.
 *
 * Использование:
 *   import { initProviders, getProvider, listProviders } from './registry';
 *   initProviders();                       // регистрирует всех
 *   const adapter = getProvider('deepseek');
 */

import type { ProviderAdapter } from './types';

const registry = new Map<string, ProviderAdapter>();

export function registerProvider(adapter: ProviderAdapter): void {
  if (registry.has(adapter.name)) {
    console.warn(`[ProviderRegistry] Провайдер '${adapter.name}' уже зарегистрирован, перезапись`);
  }
  registry.set(adapter.name, adapter);
}

export function getProvider(name: string): ProviderAdapter | null {
  return registry.get(name) ?? null;
}

export function listProviders(): ProviderAdapter[] {
  return Array.from(registry.values());
}

export function listProviderNames(): string[] {
  return Array.from(registry.keys());
}

export function hasProvider(name: string): boolean {
  return registry.has(name);
}

// ─── Авто-регистрация при первом вызове ─────────────────────────────────

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // Импорт внутри функции — чтобы не было циклической зависимости
  // (adapter.ts импортирует types.ts, registry.ts импортирует adapter.ts).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DeepSeekAdapter } = require('./deepseek/adapter') as typeof import('./deepseek/adapter');
  registerProvider(new DeepSeekAdapter());

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GigaChatAdapter } = require('./gigachat/adapter') as typeof import('./gigachat/adapter');
    registerProvider(new GigaChatAdapter());
  } catch (e) {
    console.warn('[ProviderRegistry] GigaChatAdapter не зарегистрирован:', (e as Error).message);
  }

  console.log('[ProviderRegistry] Инициализировано провайдеров:', listProviderNames());
}
