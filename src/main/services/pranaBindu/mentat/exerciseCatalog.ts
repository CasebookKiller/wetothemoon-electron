// src/main/services/pranaBindu/mentat/exerciseCatalog.ts
//
// Справочник упражнений для парсера и автодополнения.
//
// Две коллекции:
//   PROGRESSIONS_CATALOG — упражнения с 10 уровнями.
//     W1..W10 — прогрессии Пола Уэйда («Большая шестёрка»).
//     L1..L10 — общая калистеника и силовая для бегунов.
//   NAMED_EXERCISES — упражнения без уровней.
//     Drills (СБУ), plyo (плиометрика), warmup, run-basic.

import type { CatalogEntry, NamedExercise } from './types';

// ==================== Big-6 Пола Уэйда (W1..W10) ====================

export const WADE_PUSHUP: CatalogEntry = {
  key: 'pushup',
  label: 'Отжимания',
  icuName: 'Push-ups',
  category: 'wade',
  levels: [
    { level: 1, name: 'Wall Push-ups', hint: 'Стоя у стены' },
    { level: 2, name: 'Incline Push-ups', hint: 'На возвышении' },
    { level: 3, name: 'Kneeling Push-ups', hint: 'С колен' },
    { level: 4, name: 'Half Push-ups', hint: 'Половина амплитуды' },
    { level: 5, name: 'Full Push-ups', hint: 'Полные, плечи на уровне ладоней' },
    { level: 6, name: 'Close Push-ups', hint: 'Узкая постановка' },
    { level: 7, name: 'Uneven Push-ups', hint: 'Одна рука выше' },
    { level: 8, name: '1/2 One-Arm Push-ups', hint: 'Полуамплитудные на одной' },
    { level: 9, name: 'Lever Push-ups', hint: 'Одна рука на мяче' },
    { level: 10, name: 'One-Arm Push-ups', hint: 'Мастерский уровень' },
  ],
};

export const WADE_SQUAT: CatalogEntry = {
  key: 'squat',
  label: 'Приседания',
  icuName: 'Squats',
  category: 'wade',
  levels: [
    { level: 1, name: 'Shoulder Stand Squats', hint: 'Лёжа, ноги вверх' },
    { level: 2, name: 'Jackknife Squats', hint: 'Опора на руки' },
    { level: 3, name: 'Assisted Squats', hint: 'С опорой на дверь' },
    { level: 4, name: 'Half Squats', hint: 'Половина амплитуды' },
    { level: 5, name: 'Full Squats', hint: 'Полные, пятки на полу' },
    { level: 6, name: 'Close Squats', hint: 'Узкая постановка' },
    { level: 7, name: 'Uneven Squats', hint: 'Одна нога на мяче' },
    { level: 8, name: '1/2 One-Leg Squats', hint: 'Полуамплитудные на одной' },
    { level: 9, name: 'Pistol Squats', hint: 'Полный пистолет' },
    { level: 10, name: 'One-Leg Squats', hint: 'Мастерский уровень' },
  ],
};

export const WADE_PULLUP: CatalogEntry = {
  key: 'pullup',
  label: 'Подтягивания',
  icuName: 'Pull-ups',
  category: 'wade',
  levels: [
    { level: 1, name: 'Vertical Pulls', hint: 'Вертикальный вис, тяга' },
    { level: 2, name: 'Horizontal Pulls', hint: 'Австралийские' },
    { level: 3, name: 'Jackknife Pull-ups', hint: 'С опорой ног' },
    { level: 4, name: 'Half Pull-ups', hint: 'Половина амплитуды' },
    { level: 5, name: 'Full Pull-ups', hint: 'Полные, без рывков' },
    { level: 6, name: 'Close Pull-ups', hint: 'Узкий хват' },
    { level: 7, name: 'Uneven Pull-ups', hint: 'Одна рука на полотенце' },
    { level: 8, name: '1/2 One-Arm Pull-ups', hint: 'Полуамплитудные на одной' },
    { level: 9, name: 'Lever Pull-ups', hint: 'Рычаг' },
    { level: 10, name: 'One-Arm Pull-ups', hint: 'Мастерский уровень' },
  ],
};

export const WADE_LEGRAISE: CatalogEntry = {
  key: 'legraise',
  label: 'Подъёмы ног',
  icuName: 'Leg Raises',
  category: 'wade',
  levels: [
    { level: 1, name: 'Knee Tucks', hint: 'Сидя, колени к груди' },
    { level: 2, name: 'Flat Bent Leg Raises', hint: 'Лёжа, согнутые' },
    { level: 3, name: 'Flat Frog Raises', hint: 'Лёжа, пятки вместе' },
    { level: 4, name: 'Flat Straight Leg Raises', hint: 'Лёжа, прямые' },
    { level: 5, name: 'Hanging Knee Raises', hint: 'В висе, колени' },
    { level: 6, name: 'Hanging Bent Raises', hint: 'В висе, согнутые' },
    { level: 7, name: 'Hanging Frog Raises', hint: 'В висе, лягушка' },
    { level: 8, name: 'Partial Straight Raises', hint: 'В висе, частично прямые' },
    { level: 9, name: 'Hanging Straight Raises', hint: 'В висе, прямые' },
    { level: 10, name: 'Windshield Wipers', hint: 'Дворники' },
  ],
};

export const WADE_BRIDGE: CatalogEntry = {
  key: 'bridge',
  label: 'Мостики',
  icuName: 'Bridges',
  category: 'wade',
  levels: [
    { level: 1, name: 'Short Bridges', hint: 'Короткий мост' },
    { level: 2, name: 'Straight Bridges', hint: 'Прямой мост' },
    { level: 3, name: 'Angled Bridges', hint: 'С наклоном' },
    { level: 4, name: 'Head Bridges', hint: 'С опорой на голову' },
    { level: 5, name: 'Half Bridges', hint: 'Половина амплитуды' },
    { level: 6, name: 'Full Bridges', hint: 'Полный мост' },
    { level: 7, name: 'Stand-to-Stand Bridges', hint: 'Из стойки в стойку' },
    { level: 8, name: 'Walking Bridges', hint: 'Мост с ходьбой' },
    { level: 9, name: 'Stand-to-Stand (advanced)', hint: 'Продвинутый' },
    { level: 10, name: 'One-Arm Bridges', hint: 'На одной руке' },
  ],
};

export const WADE_HANDSTAND: CatalogEntry = {
  key: 'handstand',
  label: 'Стойка на руках',
  icuName: 'Handstand Push-ups',
  category: 'wade',
  levels: [
    { level: 1, name: 'Wall Headstands', hint: 'Стойка на голове у стены' },
    { level: 2, name: 'Wall Handstands', hint: 'Стойка на руках у стены' },
    { level: 3, name: 'Half Handstand Push-ups', hint: 'Полуамплитудные' },
    { level: 4, name: 'Wall Handstand Push-ups', hint: 'У стены, полные' },
    { level: 5, name: 'Full Handstand Push-ups', hint: 'Полные' },
    { level: 6, name: 'Close Handstand Push-ups', hint: 'Узкая постановка' },
    { level: 7, name: 'Uneven Handstand Push-ups', hint: 'Одна рука выше' },
    { level: 8, name: '1/2 One-Arm HSPU', hint: 'Полуамплитудные на одной' },
    { level: 9, name: 'Lever HSPU', hint: 'Рычаг' },
    { level: 10, name: 'One-Arm HSPU', hint: 'Мастерский уровень' },
  ],
};

// ==================== Общая калистеника (L1..L10) ====================

export const CALI_DIPS: CatalogEntry = {
  key: 'dips',
  label: 'Отжимания на брусьях',
  icuName: 'Dips',
  category: 'cali',
  levels: [
    { level: 1, name: 'Bench Dips', hint: 'На скамье' },
    { level: 2, name: 'Short Bench Dips', hint: 'Узкая постановка' },
    { level: 3, name: 'Negative Dips', hint: 'Только негативная фаза' },
    { level: 4, name: 'Assisted Dips', hint: 'С резинкой' },
    { level: 5, name: 'Full Dips', hint: 'Полные на брусьях' },
    { level: 6, name: 'Ring Dips', hint: 'На кольцах' },
    { level: 7, name: 'Weighted Dips', hint: 'С весом' },
    { level: 8, name: 'Korean Dips', hint: 'Корейские' },
    { level: 9, name: 'One-Arm Dips (neg)', hint: 'На одной, негатив' },
    { level: 10, name: 'Muscle-up', hint: 'Выход силой' },
  ],
};

export const CALI_PLANK: CatalogEntry = {
  key: 'plank',
  label: 'Планка',
  icuName: 'Plank',
  category: 'cali',
  levels: [
    { level: 1, name: 'Knee Plank', hint: 'С колен' },
    { level: 2, name: 'Forearm Plank', hint: 'На предплечьях' },
    { level: 3, name: 'Full Plank', hint: 'Полная на прямых руках' },
    { level: 4, name: 'Side Plank', hint: 'Боковая' },
    { level: 5, name: 'Plank with Leg Lift', hint: 'С подъёмом ноги' },
    { level: 6, name: 'RKC Plank', hint: 'Максимальное напряжение' },
    { level: 7, name: 'Body Saw Plank', hint: 'Качание вперёд-назад' },
    { level: 8, name: 'Ring Plank', hint: 'На кольцах' },
    { level: 9, name: 'Weighted Plank', hint: 'С весом на спине' },
    { level: 10, name: 'One-Arm Plank', hint: 'На одной руке' },
  ],
};

export const CALI_LSIT: CatalogEntry = {
  key: 'lsit',
  label: 'L-сиденье',
  icuName: 'L-sit',
  category: 'cali',
  levels: [
    { level: 1, name: 'Foot-Supported L-sit', hint: 'С опорой ногами' },
    { level: 2, name: 'Tuck L-sit', hint: 'Колени к груди' },
    { level: 3, name: 'One-Leg L-sit', hint: 'Одна нога выпрямлена' },
    { level: 4, name: 'L-sit on Parallettes', hint: 'На низких брусьях' },
    { level: 5, name: 'Full L-sit', hint: 'Полное' },
    { level: 6, name: 'L-sit on Rings', hint: 'На кольцах' },
    { level: 7, name: 'V-sit', hint: 'V-положение' },
    { level: 8, name: 'Straddle V-sit', hint: 'Ноги врозь' },
    { level: 9, name: 'Manna progression', hint: 'Прогрессия к манне' },
    { level: 10, name: 'Manna', hint: 'Манна' },
  ],
};

export const CALI_PLANCHE: CatalogEntry = {
  key: 'planche',
  label: 'Планш',
  icuName: 'Planche',
  category: 'cali',
  levels: [
    { level: 1, name: 'Pseudo Planche Push-ups', hint: 'Псевдо-планш' },
    { level: 2, name: 'Frog Stand', hint: 'Лягушка' },
    { level: 3, name: 'Tuck Planche', hint: 'Сгруппированный' },
    { level: 4, name: 'Advanced Tuck Planche', hint: 'Продвинутая группировка' },
    { level: 5, name: 'Straddle Planche', hint: 'Ноги врозь' },
    { level: 6, name: 'Half-Lay Planche', hint: 'Полу-плашмя' },
    { level: 7, name: 'Full Planche', hint: 'Полный планш' },
    { level: 8, name: 'Planche Push-ups', hint: 'Планш с отжиманием' },
    { level: 9, name: 'One-Arm Planche (tuck)', hint: 'На одной, сгруппированный' },
    { level: 10, name: 'One-Arm Planche', hint: 'Мастерский уровень' },
  ],
};

export const CALI_FRONTLEVER: CatalogEntry = {
  key: 'frontlever',
  label: 'Фронтальный вис',
  icuName: 'Front Lever',
  category: 'cali',
  levels: [
    { level: 1, name: 'Tuck Front Lever', hint: 'Сгруппированный' },
    { level: 2, name: 'Advanced Tuck FL', hint: 'Продвинутая группировка' },
    { level: 3, name: 'One-Leg FL', hint: 'Одна нога выпрямлена' },
    { level: 4, name: 'Straddle FL', hint: 'Ноги врозь' },
    { level: 5, name: 'Full FL', hint: 'Полный' },
    { level: 6, name: 'FL Raises', hint: 'Подъёмы в FL' },
    { level: 7, name: 'FL Rows', hint: 'Тяги в FL' },
    { level: 8, name: 'Touch-and-Go FL', hint: 'Касания' },
    { level: 9, name: 'One-Arm FL (tuck)', hint: 'На одной, сгруппированный' },
    { level: 10, name: 'One-Arm FL', hint: 'Мастерский уровень' },
  ],
};

// ==================== Силовая для бегунов (L1..L10) ====================

export const RUNNER_SQUAT: CatalogEntry = {
  key: 'runnersquat',
  label: 'Одноножные приседания',
  icuName: 'Single-Leg Squats',
  category: 'runner',
  levels: [
    { level: 1, name: 'Chair Squat', hint: 'На стул' },
    { level: 2, name: 'Assisted Pistol', hint: 'С опорой' },
    { level: 3, name: 'Box Pistol', hint: 'На низкую опору' },
    { level: 4, name: 'Counterbalance Pistol', hint: 'С противовесом' },
    { level: 5, name: 'Full Pistol', hint: 'Полный пистолет' },
    { level: 6, name: 'Pistol on Deficit', hint: 'С возвышения' },
    { level: 7, name: 'Weighted Pistol', hint: 'С весом' },
    { level: 8, name: 'Shrimp Squat (assisted)', hint: 'Креветка с опорой' },
    { level: 9, name: 'Shrimp Squat', hint: 'Креветка' },
    { level: 10, name: 'Shrimp (no hands)', hint: 'Креветка без рук' },
  ],
};

export const RUNNER_RDL: CatalogEntry = {
  key: 'runnerleg',
  label: 'Румынская тяга на одной ноге',
  icuName: 'Single-Leg RDL',
  category: 'runner',
  levels: [
    { level: 1, name: 'Assisted SL-RDL', hint: 'С опорой' },
    { level: 2, name: 'SL-RDL (partial)', hint: 'Полуамплитуда' },
    { level: 3, name: 'Full SL-RDL', hint: 'Полная' },
    { level: 4, name: 'SL-RDL with pause', hint: 'С паузой внизу' },
    { level: 5, name: 'SL-RDL with weight', hint: 'С весом' },
    { level: 6, name: 'SL-RDL on bosu', hint: 'На нестабильной опоре' },
    { level: 7, name: 'SL-RDL eyes closed', hint: 'С закрытыми глазами' },
    { level: 8, name: 'SL-RDL on wobble board', hint: 'На балансире' },
    { level: 9, name: 'Single-Leg Deadlift', hint: 'Становая на одной' },
    { level: 10, name: 'Pistol-to-RDL combo', hint: 'Комбо' },
  ],
};

export const RUNNER_CALF: CatalogEntry = {
  key: 'calfraise',
  label: 'Подъёмы на носки',
  icuName: 'Calf Raises',
  category: 'runner',
  levels: [
    { level: 1, name: 'Seated Calf Raises', hint: 'Сидя, обе ноги' },
    { level: 2, name: 'Standing Calf Raises', hint: 'Стоя, обе' },
    { level: 3, name: 'Single-Leg (assisted)', hint: 'На одной, с опорой' },
    { level: 4, name: 'Single-Leg Calf Raises', hint: 'На одной' },
    { level: 5, name: 'Deficit Calf Raises', hint: 'С возвышения' },
    { level: 6, name: 'Weighted Single-Leg', hint: 'С весом' },
    { level: 7, name: 'Slow Eccentric Calf', hint: 'Медленная негативная' },
    { level: 8, name: 'Explosive Calf Raises', hint: 'Взрывные' },
    { level: 9, name: 'Calf Raises on toes', hint: 'На пальцах' },
    { level: 10, name: 'Depth Jump + Calf', hint: 'Прыжок + подъём' },
  ],
};

export const RUNNER_ANTICORE: CatalogEntry = {
  key: 'anticore',
  label: 'Антиротационный кор',
  icuName: 'Anti-Rotation Core',
  category: 'runner',
  levels: [
    { level: 1, name: 'Dead Bug', hint: 'Жук' },
    { level: 2, name: 'Bird Dog', hint: 'Собака-птица' },
    { level: 3, name: 'Side Plank', hint: 'Боковая планка' },
    { level: 4, name: 'Pallof Press', hint: 'Пресс Паллофа' },
    { level: 5, name: 'Pallof Hold', hint: 'Удержание' },
    { level: 6, name: 'Kneeling Pallof', hint: 'С колен' },
    { level: 7, name: 'Pallof with rotation', hint: 'С ротацией' },
    { level: 8, name: 'Standing Rollout', hint: 'Роллаут' },
    { level: 9, name: 'Ab Wheel Kneeling', hint: 'Колесо с колен' },
    { level: 10, name: 'Ab Wheel Standing', hint: 'Колесо стоя' },
  ],
};

export const RUNNER_LUNGE: CatalogEntry = {
  key: 'runnerlunge',
  label: 'Выпады',
  icuName: 'Lunges',
  category: 'runner',
  levels: [
    { level: 1, name: 'Mini Lunge', hint: 'Мини-выпад' },
    { level: 2, name: 'Static Lunge', hint: 'Статический' },
    { level: 3, name: 'Walking Lunge', hint: 'В движении' },
    { level: 4, name: 'Reverse Lunge', hint: 'Назад' },
    { level: 5, name: 'Bulgarian Split Squat', hint: 'Болгарский' },
    { level: 6, name: 'Deficit Reverse Lunge', hint: 'С возвышения' },
    { level: 7, name: 'Weighted Bulgarian', hint: 'С весом' },
    { level: 8, name: 'Jumping Lunge', hint: 'С прыжком' },
    { level: 9, name: 'Curtsy Lunge', hint: 'Кёртси' },
    { level: 10, name: 'Pistol-to-Lunge combo', hint: 'Комбо' },
  ],
};

// ==================== Сводный каталог прогрессий ====================

export const PROGRESSIONS_CATALOG: CatalogEntry[] = [
  // Wade
  WADE_PUSHUP,
  WADE_SQUAT,
  WADE_PULLUP,
  WADE_LEGRAISE,
  WADE_BRIDGE,
  WADE_HANDSTAND,
  // Cali
  CALI_DIPS,
  CALI_PLANK,
  CALI_LSIT,
  CALI_PLANCHE,
  CALI_FRONTLEVER,
  // Runner
  RUNNER_SQUAT,
  RUNNER_RDL,
  RUNNER_CALF,
  RUNNER_ANTICORE,
  RUNNER_LUNGE,
];

// ==================== Упражнения без уровней (named) ====================

export const NAMED_EXERCISES: NamedExercise[] = [
  // --- СБУ (Специальные беговые упражнения) ---
  { key: 'a-skip', category: 'drill', label: 'A-Skip', icuName: 'A-Skip',
    hint: 'Носок на себя, активное бедро', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'b-skip', category: 'drill', label: 'B-Skip', icuName: 'B-Skip',
    hint: 'Выброс прямой ноги', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'high-knees', category: 'drill', label: 'High Knees', icuName: 'High Knees',
    hint: 'Максимальная частота', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'butt-kicks', category: 'drill', label: 'Butt Kicks', icuName: 'Butt Kicks',
    hint: 'Пятка к ягодице', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'carioca-l', category: 'drill', label: 'Carioca L', icuName: 'Carioca L',
    hint: 'Скрестный шаг, левым боком', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'carioca-r', category: 'drill', label: 'Carioca R', icuName: 'Carioca R',
    hint: 'Скрестный шаг, правым боком', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'ankling', category: 'drill', label: 'Ankling', icuName: 'Ankling',
    hint: 'Перекат', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'lateral-shuffle', category: 'drill', label: 'Lateral Shuffle',
    icuName: 'Lateral Shuffle', hint: 'Приставной шаг', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'backward-run', category: 'drill', label: 'Backward Run', icuName: 'Backward Run',
    hint: 'Бег спиной', defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'bounding', category: 'drill', label: 'Bounding', icuName: 'Bounding',
    hint: 'Многоскоки', defaultDuration: '40mtr', defaultZone: 1 },
  { key: 'straight-leg', category: 'drill', label: 'Straight Leg', icuName: 'Straight Leg',
    hint: 'Бег на прямых', defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'power-skips', category: 'drill', label: 'Power Skips', icuName: 'Power Skips',
    hint: 'Прыжки в шаге', defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'strides', category: 'drill', label: 'Strides', icuName: 'Strides',
    hint: 'Ускорение расслабленно', defaultDuration: '100mtr', defaultZone: 5 },
  { key: 'acceleration', category: 'drill', label: 'Acceleration', icuName: 'Acceleration',
    hint: 'Разгон 0-95%', defaultDuration: '50mtr', defaultZone: 5 },

  // --- Плиометрика ---
  { key: 'jump-squats', category: 'plyo', label: 'Jump Squats', icuName: 'Jump Squats',
    hint: 'Прыжковые приседания', defaultDuration: '30s', defaultZone: 3 },
  { key: 'lunge-jumps', category: 'plyo', label: 'Lunge Jumps', icuName: 'Lunge Jumps',
    hint: 'Выпады с прыжком', defaultDuration: '30s', defaultZone: 3 },
  { key: 'broad-jumps', category: 'plyo', label: 'Broad Jumps', icuName: 'Broad Jumps',
    hint: 'Прыжки в длину', defaultDuration: '30s', defaultZone: 3 },
  { key: 'skater-hops', category: 'plyo', label: 'Skater Hops', icuName: 'Skater Hops',
    hint: 'Боковые прыжки', defaultDuration: '30s', defaultZone: 3 },

  // --- Разминка / заминка ---
  { key: 'jumping-jacks', category: 'warmup', label: 'Jumping Jacks', icuName: 'Jumping Jacks',
    hint: 'Прыжки ноги-руки', defaultDuration: '30s', defaultZone: 1 },
  { key: 'walking-lunges', category: 'warmup', label: 'Walking Lunges', icuName: 'Walking Lunges',
    hint: 'Выпады в движении', defaultDuration: '30s', defaultZone: 1 },
  { key: 'inchworms', category: 'warmup', label: 'Inchworms', icuName: 'Inchworms',
    hint: 'Ходьба на руках', defaultDuration: '30s', defaultZone: 1 },
  { key: 'arm-circles', category: 'warmup', label: 'Arm Circles', icuName: 'Arm Circles',
    hint: 'Круги руками', defaultDuration: '30s', defaultZone: 1 },
  { key: 'leg-swings', category: 'warmup', label: 'Leg Swings', icuName: 'Leg Swings',
    hint: 'Махи ногами', defaultDuration: '30s', defaultZone: 1 },
  { key: 'dead-bug', category: 'warmup', label: 'Dead Bug', icuName: 'Dead Bug',
    hint: 'Жук: поясница прижата', defaultDuration: '30s', defaultZone: 1 },
  { key: 'bird-dog', category: 'warmup', label: 'Bird Dog', icuName: 'Bird Dog',
    hint: 'Без ротации корпуса', defaultDuration: '30s', defaultZone: 1 },
  { key: 'hollow-body-hold', category: 'warmup', label: 'Hollow Body Hold',
    icuName: 'Hollow Body Hold', hint: 'Носки оттянуты', defaultDuration: '30s', defaultZone: 1 },

  // --- Run-basic (служебные шаги) ---
  { key: 'recovery-jog', category: 'run-basic', label: 'Recovery Jog', icuName: 'Recovery Jog',
    hint: 'Трусца для восстановления', defaultDuration: '200mtr', defaultZone: 1 },
  { key: 'walk-back', category: 'run-basic', label: 'Walk Back', icuName: 'Walk Back',
    hint: 'Пешком назад к старту', defaultDuration: '100mtr', defaultZone: 1 },
  { key: 'rest', category: 'run-basic', label: 'Rest', icuName: 'Rest',
    hint: 'Отдых', defaultDuration: '60s', defaultZone: 1 },
];

// ==================== Утилиты поиска ====================

/** Поиск прогрессии по ключу (pushup, squat, dips, …). */
export function findProgressionsByKey(key: string): CatalogEntry | undefined {
  return PROGRESSIONS_CATALOG.find((e) => e.key === key);
}

/** Поиск NamedExercise по ключу (a-skip, jump-squats, …). */
export function findNamedByKey(key: string): NamedExercise | undefined {
  return NAMED_EXERCISES.find((e) => e.key === key);
}

/** Поиск NamedExercise по ICU-имени (регистронезависимо). */
export function findNamedByName(name: string): NamedExercise | undefined {
  const norm = name.trim().toLowerCase();
  return NAMED_EXERCISES.find((e) => e.icuName.toLowerCase() === norm);
}

/**
 * Поиск варианта прогрессии по имени: 'Diamond Push-ups' → pushup, level=6.
 * Возвращает { entry, level } или undefined.
 */
export function findLevelByName(
  variantName: string
): { entry: CatalogEntry; level: number } | undefined {
  const norm = variantName.trim().toLowerCase();
  for (const entry of PROGRESSIONS_CATALOG) {
    for (const lvl of entry.levels) {
      if (lvl.name.toLowerCase() === norm) {
        return { entry, level: lvl.level };
      }
    }
  }
  return undefined;
}

/** Маппинг уровня 1..10 → зона ICU 1..6. */
export function levelToZone(level: number): number {
  const l = Math.max(1, Math.min(10, level));
  return Math.min(6, Math.floor((l - 1) * 6 / 9) + 1);
}

/** Найти любую запись по имени — сначала в прогрессиях, потом в named. */
export function findAnythingByName(name: string): {
  kind: 'progression';
  entry: CatalogEntry;
  level: number;
} | {
  kind: 'named';
  entry: NamedExercise;
} | undefined {
  const prog = findLevelByName(name);
  if (prog) {
    return { kind: 'progression', entry: prog.entry, level: prog.level };
  }
  const named = findNamedByName(name);
  if (named) {
    return { kind: 'named', entry: named };
  }
  return undefined;
}