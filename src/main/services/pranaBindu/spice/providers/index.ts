/**
 * Реестр провайдеров Zepp.
 * Конкретные реализации регистрируются в 09 / 07.
 */

import type { ZeppDataProvider } from './types';

export type {
  ZeppDataProvider,
  ProviderCheckResult,
  RawWorkout,
} from './types';

const registry = new Map<string, ZeppDataProvider>();

export function registerProvider(provider: ZeppDataProvider): void {
  registry.set(provider.name, provider);
}

export function getProvider(name: string): ZeppDataProvider | undefined {
  return registry.get(name);
}

export function listProviders(): ZeppDataProvider[] {
  return Array.from(registry.values());
}