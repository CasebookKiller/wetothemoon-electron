// src/main/services/pranaBindu/mentat/thenicsCatalog.ts
//
// Каталог упражнений из приложения Thenics.
// Отдельно от PROGRESSIONS_CATALOG (Wade/Cali/Runner/Core/Posture/HIIT).
//
// Отличия от нашего каталога:
//   - 4 уровня сложности (Beginner / Intermediate / Advanced / Pro)
//     вместо 10 уровней Wade/Cali.
//   - Одно движение = одна запись (никаких levels[] с ladder).
//   - Есть weighted-варианты (Push Up +10Kg) и Ring/Band-упражнения —
//     в этом сэмпле не включены, добавим отдельно.
//
// Пока используется только как источник для таблицы equivalences
// (Melange v21). В matcher / генераторы не встроен.

export type ThenicsLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';

export interface ThenicsEntry {
  /** ID из исходной таблицы Thenics (1..265+). */
  id: number;
  /** Слаг-ключ: 'push-up', 'archer-pull-up'. Только lowercase, дефисы. */
  key: string;
  /** Название как в Thenics (англ.). */
  name: string;
  /** Русский перевод (если был в таблице). */
  nameRu?: string;
  level: ThenicsLevel;
  /** Группы мышц (Muscles + Muscles 2..6 из таблицы). */
  muscles?: string[];
  /** Оборудование (Equipment из таблицы). */
  equipment?: string[];
  youtube?: string;
}

export const THENICS_CATALOG: ThenicsEntry[] = [
  // ============ Push ============
  { id: 198, key: 'knee-push-up', name: 'Knee Push Up', level: 'Beginner',
    muscles: ['Arms', 'Chest'], equipment: ['No'] },
  { id: 4, key: 'push-up', name: 'Push Up', nameRu: 'Полные отжимания', level: 'Beginner',
    muscles: ['Arms', 'Chest'], equipment: ['No'] },
  { id: 116, key: 'diamond-push-up', name: 'Diamond Push Up', level: 'Beginner',
    muscles: ['Arms', 'Chest'], equipment: ['No'] },
  { id: 86, key: 'archer-push-up', name: 'Archer Push Up', level: 'Intermediate',
    muscles: ['Arms', 'Chest'], equipment: ['No'] },
  { id: 122, key: 'one-arm-push-up', name: 'One Arm Push Up', level: 'Advanced',
    muscles: ['Arms', 'Chest', 'Shoulders'], equipment: ['No'] },

  // ============ Pull ============
  { id: 1, key: 'pull-up', name: 'Pull Up', nameRu: 'Полные подтягивания', level: 'Beginner',
    muscles: ['Arms', 'Back'], equipment: ['Bar'] },
  { id: 82, key: 'chin-up', name: 'Chin Up', level: 'Beginner',
    muscles: ['Arms', 'Back'], equipment: ['Bar'] },
  { id: 2, key: 'body-row', name: 'Body Row', nameRu: 'Горизонтальные подтягивания', level: 'Beginner',
    muscles: ['Arms', 'Back'], equipment: ['Lower bar'] },
  { id: 6, key: 'archer-pull-up', name: 'Archer Pull Up', nameRu: 'Подтягивания Лучник', level: 'Intermediate',
    muscles: ['Arms', 'Back'], equipment: ['Bar'] },
  { id: 100, key: 'one-arm-pull-up', name: 'One Arm Pull Up', level: 'Advanced',
    muscles: ['Arms', 'Back'], equipment: ['Bar'] },

  // ============ Dip ============
  { id: 216, key: 'bench-dip', name: 'Bench Dip', level: 'Beginner',
    muscles: ['Arms'], equipment: ['Bench'] },
  { id: 3, key: 'dip', name: 'Dip', nameRu: 'Отжимания на брусьях', level: 'Beginner',
    muscles: ['Arms', 'Chest'], equipment: ['Push up bars'] },
  { id: 144, key: 'korean-dip', name: 'Korean Dip', level: 'Intermediate',
    muscles: ['Arms', 'Chest', 'Shoulders'], equipment: ['Lower bar'] },
  { id: 229, key: 'impossible-dip', name: 'Impossible Dip', level: 'Pro',
    muscles: ['Arms', 'Chest'], equipment: ['Push up bars'] },

  // ============ Squat ============
  { id: 231, key: 'chair-squat', name: 'Chair Squat', level: 'Beginner',
    muscles: ['Legs'], equipment: ['Bench or Chair'] },
  { id: 232, key: 'squat', name: 'Squat', level: 'Beginner',
    muscles: ['Legs'], equipment: ['No'] },
  { id: 49, key: 'bulgarian-squat', name: 'Bulgarian Squat', level: 'Intermediate',
    muscles: ['Legs'], equipment: ['Bench or Chair'] },
  { id: 55, key: 'pistol-squat', name: 'Pistol Squat', level: 'Advanced',
    muscles: ['Legs'], equipment: ['No'] },
  { id: 143, key: 'shrimp-squat', name: 'Shrimp Squat', level: 'Advanced',
    muscles: ['Legs'], equipment: ['No'] },

  // ============ Leg Raise / Core ============
  { id: 17, key: 'leg-raise', name: 'Leg Raise', nameRu: 'Подъём ног', level: 'Beginner',
    muscles: ['Abs'], equipment: ['No'] },
  { id: 115, key: 'plank', name: 'Plank', level: 'Beginner',
    muscles: ['Abs'], equipment: ['No'] },
  { id: 127, key: 'hollow-body-hold', name: 'Hollow Body Hold', level: 'Beginner',
    muscles: ['Abs'], equipment: ['No'] },
  { id: 34, key: 'dragon-flag', name: 'Dragon Flag', level: 'Advanced',
    muscles: ['Abs'], equipment: ['Bench, Pillar or Very low bar'] },

  // ============ Handstand / Planche / Lever ============
  { id: 59, key: 'wall-handstand', name: 'Wall Handstand', level: 'Beginner',
    muscles: ['Arms', 'Shoulders'], equipment: ['Wall'] },
  { id: 20, key: 'tuck-planche', name: 'Tuck Planche', level: 'Intermediate',
    muscles: ['Chest', 'Shoulders', 'Abs'], equipment: ['No'] },
  { id: 35, key: 'front-lever', name: 'Front Lever', level: 'Advanced',
    muscles: ['Arms', 'Back', 'Abs'], equipment: ['Bar'] },
];

/** Поиск по слагу. */
export function findThenicsByKey(key: string): ThenicsEntry | undefined {
  return THENICS_CATALOG.find((e) => e.key === key);
}

/** Поиск по имени (регистронезависимо, без дефисов). */
export function findThenicsByName(name: string): ThenicsEntry | undefined {
  const norm = name.trim().toLowerCase().replace(/-/g, ' ');
  return THENICS_CATALOG.find(
    (e) => e.name.toLowerCase().replace(/-/g, ' ') === norm
  );
}