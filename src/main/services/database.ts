// src/main/services/database.ts
//
// Фасад над модулями src/main/services/db/*.
// Оставлен для обратной совместимости: все старые импорты
// `import { ... } from '../services/database'` продолжают работать.
// Новый код — импортируй точечно: `from '../services/db/entities'` и т.д.

export * from './db';