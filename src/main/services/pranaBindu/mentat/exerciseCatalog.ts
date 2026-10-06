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
    { level: 1, name: 'Wall Push-ups', nameRu: 'Отжимания от стены',
      benchmarkLadder: ['1x10', '2x25', '3x50'], source: 'wade' },
    { level: 2, name: 'Incline Push-ups', nameRu: 'Отжимания в наклоне',
      benchmarkLadder: ['1x10', '2x20', '3x40'], source: 'wade' },
    { level: 3, name: 'Kneeling Push-ups', nameRu: 'Отжимания на коленях',
      benchmarkLadder: ['1x10', '2x15', '3x30'], source: 'wade' },
    { level: 4, name: 'Half Push-ups', nameRu: 'Неполные отжимания',
      benchmarkLadder: ['1x8', '2x35', '3x50'], source: 'wade' },
    { level: 5, name: 'Full Push-ups', nameRu: 'Полные отжимания',
      benchmarkLadder: ['1x5', '2x10', '2x30'], source: 'wade' },
    { level: 6, name: 'Close Push-ups', nameRu: 'Узкие отжимания',
      benchmarkLadder: ['1x5', '2x10', '2x20'], source: 'wade' },
    { level: 7, name: 'Uneven Push-ups', nameRu: 'Разновысокие отжимания',
      benchmarkLadder: ['1x5', '2x10', '2x20'], benchmarkRounds: 2, source: 'wade' },
    { level: 8, name: '1/2 One-Arm Push-ups', nameRu: 'Неполные отжимания на одной руке',
      benchmarkLadder: ['1x5', '2x10', '2x20'], benchmarkRounds: 2, source: 'wade' },
    { level: 9, name: 'Lever Push-ups', nameRu: 'Отжимания на одной руке с поддержкой',
      benchmarkLadder: ['1x5', '2x10', '2x20'], benchmarkRounds: 2, source: 'wade' },
    { level: 10, name: 'One-Arm Push-ups', nameRu: 'Отжимания на одной руке',
      benchmarkLadder: ['1x5', '2x10', '2x50'], benchmarkRounds: 2, source: 'wade' },
  ],
};

export const WADE_SQUAT: CatalogEntry = {
  key: 'squat',
  label: 'Приседания',
  icuName: 'Squats',
  category: 'wade',
  levels: [
    { level: 1, name: 'Shoulder Stand Squats', nameRu: 'Приседания в стойке на плечах',
      benchmarkLadder: ['1x10', '2x20', '3x40'], source: 'wade' },
    { level: 2, name: 'Jackknife Squats', nameRu: 'Приседания складной нож',
      benchmarkLadder: ['1x10', '2x20', '3x30'], source: 'wade' },
    { level: 3, name: 'Assisted Squats', nameRu: 'Приседания с поддержкой',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'wade' },
    { level: 4, name: 'Half Squats', nameRu: 'Неполные приседания',
      benchmarkLadder: ['1x8', '2x11', '2x15'], source: 'wade' },
    { level: 5, name: 'Full Squats', nameRu: 'Полные приседания',
      benchmarkLadder: ['1x5', '2x8', '2x10'], source: 'wade' },
    { level: 6, name: 'Close Squats', nameRu: 'Узкие приседания',
      benchmarkLadder: ['1x5', '2x8', '2x10'], source: 'wade' },
    { level: 7, name: 'Uneven Squats', nameRu: 'Разновысокие приседания',
      benchmarkLadder: ['1x5', '2x7', '2x9'], benchmarkRounds: 2, source: 'wade' },
    { level: 8, name: '1/2 One-Leg Squats', nameRu: 'Неполные приседания на одной ноге',
      benchmarkLadder: ['1x4', '2x6', '2x8'], benchmarkRounds: 2, source: 'wade' },
    { level: 9, name: 'Pistol Squats', nameRu: 'Пистолетик',
      benchmarkLadder: ['1x3', '2x5', '2x7'], benchmarkRounds: 2, source: 'wade' },
    { level: 10, name: 'One-Leg Squats', nameRu: 'Приседания на одной ноге',
      benchmarkLadder: ['1x1', '2x3', '2x6'], benchmarkRounds: 2, source: 'wade' },
  ],
};

export const WADE_PULLUP: CatalogEntry = {
  key: 'pullup',
  label: 'Подтягивания',
  icuName: 'Pull-ups',
  category: 'wade',
  levels: [
    { level: 1, name: 'Vertical Pulls', nameRu: 'Вертикальные подтягивания',
      benchmarkLadder: ['1x10', '2x25', '3x40'], source: 'wade' },
    { level: 2, name: 'Horizontal Pulls', nameRu: 'Горизонтальные подтягивания',
      benchmarkLadder: ['1x10', '2x20', '3x30'], source: 'wade' },
    { level: 3, name: 'Jackknife Pull-ups', nameRu: 'Подтягивания складной нож',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'wade' },
    { level: 4, name: 'Half Pull-ups', nameRu: 'Неполные подтягивания',
      benchmarkLadder: ['1x8', '2x11', '3x15'], source: 'wade' },
    { level: 5, name: 'Full Pull-ups', nameRu: 'Полные подтягивания',
      benchmarkLadder: ['1x5', '2x8', '2x10'], source: 'wade' },
    { level: 6, name: 'Close Pull-ups', nameRu: 'Узкие подтягивания',
      benchmarkLadder: ['1x5', '2x8', '2x10'], source: 'wade' },
    { level: 7, name: 'Uneven Pull-ups', nameRu: 'Разновысокие подтягивания',
      benchmarkLadder: ['1x5', '2x7', '2x9'], benchmarkRounds: 2, source: 'wade' },
    { level: 8, name: '1/2 One-Arm Pull-ups', nameRu: 'Неполные подтягивания на одной руке',
      benchmarkLadder: ['1x4', '2x6', '2x8'], benchmarkRounds: 2, source: 'wade' },
    { level: 9, name: 'Lever Pull-ups', nameRu: 'Подтягивания на одной руке с поддержкой',
      benchmarkLadder: ['1x3', '2x5', '2x7'], benchmarkRounds: 2, source: 'wade' },
    { level: 10, name: 'One-Arm Pull-ups', nameRu: 'Подтягивания на одной руке',
      benchmarkLadder: ['1x2', '2x3', '2x6'], benchmarkRounds: 2, source: 'wade' },
  ],
};

export const WADE_LEGRAISE: CatalogEntry = {
  key: 'legraise',
  label: 'Подъёмы ног',
  icuName: 'Leg Raises',
  category: 'wade',
  levels: [
    { level: 1, name: 'Knee Tucks', nameRu: 'Подтягивание коленей к груди',
      benchmarkLadder: ['1x10', '2x20', '3x40'], source: 'wade' },
    { level: 2, name: 'Flat Bent Leg Raises', nameRu: 'Подъёмы коленей из положения лёжа',
      benchmarkLadder: ['1x10', '2x20', '3x35'], source: 'wade' },
    { level: 3, name: 'Flat Frog Raises', nameRu: 'Подъёмы согнутых ног лёжа',
      benchmarkLadder: ['1x10', '2x15', '3x30'], source: 'wade' },
    { level: 4, name: 'Flat Straight Leg Raises', nameRu: 'Подъёмы прямых ног из положения лёжа',
      benchmarkLadder: ['1x8', '2x15', '3x25'], source: 'wade' },
    { level: 5, name: 'Hanging Knee Raises', nameRu: 'Подтягивание коленей в висе',
      benchmarkLadder: ['1x5', '2x10', '2x20'], source: 'wade' },
    { level: 6, name: 'Hanging Bent Raises', nameRu: 'Подъёмы согнутых ног в висе',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 7, name: 'Hanging Frog Raises', nameRu: 'Подъёмы ног в висе «лягушка»',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 8, name: 'Partial Straight Raises', nameRu: 'Неполные подъёмы прямых ног в висе',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 9, name: 'Hanging Straight Raises', nameRu: 'Подъёмы прямых ног в висе',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 10, name: 'Windshield Wipers', nameRu: '«Дворники»',
      benchmarkLadder: ['1x5', '2x10', '2x30'], source: 'wade' },
  ],
};

export const WADE_BRIDGE: CatalogEntry = {
  key: 'bridge',
  label: 'Мостики',
  icuName: 'Bridges',
  category: 'wade',
  levels: [
    { level: 1, name: 'Short Bridges', nameRu: 'Мостик от плеч',
      benchmarkLadder: ['1x10', '2x25', '3x50'], source: 'wade' },
    { level: 2, name: 'Straight Bridges', nameRu: 'Прямой мостик',
      benchmarkLadder: ['1x10', '2x20', '3x40'], source: 'wade' },
    { level: 3, name: 'Angled Bridges', nameRu: 'Мостик из обратного наклона',
      benchmarkLadder: ['1x8', '2x15', '3x30'], source: 'wade' },
    { level: 4, name: 'Head Bridges', nameRu: 'Мостик из упора на голову',
      benchmarkLadder: ['1x8', '2x15', '2x25'], source: 'wade' },
    { level: 5, name: 'Half Bridges', nameRu: 'Полумостик',
      benchmarkLadder: ['1x8', '2x15', '2x20'], source: 'wade' },
    { level: 6, name: 'Full Bridges', nameRu: 'Полный мостик',
      benchmarkLadder: ['1x6', '2x10', '2x15'], source: 'wade' },
    { level: 7, name: 'Stand-to-Stand Bridges', nameRu: 'Мостик по стенке вниз',
      benchmarkLadder: ['1x3', '2x6', '2x10'], source: 'wade' },
    { level: 8, name: 'Walking Bridges', nameRu: 'Мостик по стенке вверх',
      benchmarkLadder: ['1x2', '2x4', '2x8'], source: 'wade' },
    { level: 9, name: 'Stand-to-Stand (advanced)', nameRu: 'Неполный мостик из положения стоя',
      benchmarkLadder: ['1x1', '2x3', '2x6'], source: 'wade' },
    { level: 10, name: 'One-Arm Bridges', nameRu: 'Полный мостик из положения стоя',
      benchmarkLadder: ['1x1', '2x3', '2x10-30s'], source: 'wade' },
  ],
};

export const WADE_HANDSTAND: CatalogEntry = {
  key: 'handstand',
  label: 'Стойка на руках',
  icuName: 'Handstand Push-ups',
  category: 'wade',
  levels: [
    { level: 1, name: 'Wall Headstands', nameRu: 'Стойка на голове у стены',
      benchmarkLadder: ['30s', '60s', '120s'], source: 'wade' },
    { level: 2, name: 'Wall Handstands', nameRu: 'Стойка на руках у стены',
      benchmarkLadder: ['10s', '30s', '60s'], source: 'wade' },
    { level: 3, name: 'Half Handstand Push-ups', nameRu: 'Неполные отжимания в стойке у стены',
      benchmarkLadder: ['30s', '60s', '120s'], source: 'wade' },
    { level: 4, name: 'Wall Handstand Push-ups', nameRu: 'Отжимания в стойке на руках у стены',
      benchmarkLadder: ['1x5', '2x10', '2x20'], source: 'wade' },
    { level: 5, name: 'Full Handstand Push-ups', nameRu: 'Отжимания в стойке на руках',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 6, name: 'Close Handstand Push-ups', nameRu: 'Узкие отжимания в стойке',
      benchmarkLadder: ['1x5', '2x9', '2x12'], source: 'wade' },
    { level: 7, name: 'Uneven Handstand Push-ups', nameRu: 'Разновысокие отжимания в стойке',
      benchmarkLadder: ['1x5', '2x8', '2x10'], benchmarkRounds: 2, source: 'wade' },
    { level: 8, name: '1/2 One-Arm HSPU', nameRu: 'Неполные отжимания в стойке на одной руке',
      benchmarkLadder: ['1x4', '2x6', '2x8'], benchmarkRounds: 2, source: 'wade' },
    { level: 9, name: 'Lever HSPU', nameRu: 'Отжимания в стойке на одной руке с поддержкой',
      benchmarkLadder: ['1x3', '2x4', '2x6'], benchmarkRounds: 2, source: 'wade' },
    { level: 10, name: 'One-Arm HSPU', nameRu: 'Отжимания в стойке на одной руке',
      benchmarkLadder: ['1x1', '2x2', '2x5'], benchmarkRounds: 2, source: 'wade' },
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

// ==================== Кор (L1..L10) ====================

export const CORE_DRAGONFLAG: CatalogEntry = {
  key: 'core-dragonflag',
  label: 'Кор: прогрессия драконьего флага',
  icuName: 'Dragon Flag',
  category: 'core',
  levels: [
    { level: 1, name: 'Dead Bug', hint: 'Поясница прижата, руки/ноги попеременно' },
    { level: 2, name: 'Hollow Body Hold', hint: 'Носки оттянуты, поясница на полу' },
    { level: 3, name: 'Hollow Rock', hint: 'Качание в hollow, поясница не отрывается' },
    { level: 4, name: 'Lying Leg Raise', hint: 'Прямые ноги до 90°, без раскачки' },
    { level: 5, name: 'V-Up', hint: 'Одновременный подъём корпуса и ног' },
    { level: 6, name: 'Dragon Flag Negative', hint: 'Только опускание, медленно' },
    { level: 7, name: 'Dragon Flag Tuck', hint: 'Сгруппированный, колени к груди' },
    { level: 8, name: 'Dragon Flag One-Leg', hint: 'Одна нога прямая, вторая согнута' },
    { level: 9, name: 'Dragon Flag Half', hint: 'Половина амплитуды, прямая' },
    { level: 10, name: 'Dragon Flag Full', hint: 'Полный флаг, тело прямой линией' },
  ],
};

export const CORE_ANTIEXT = {
  key: 'core-antiext',
  label: 'Кор: анти-экстензия на колесе',
  icuName: 'Ab Wheel',
  category: 'core' as const,
  levels: [
    { level: 1, name: 'Kneeling Plank Hold', hint: 'Стойка на коленях, без колеса' },
    { level: 2, name: 'Short Rollout', hint: 'Колесо на 30 см от колен' },
    { level: 3, name: 'Half Rollout', hint: 'До половины амплитуды' },
    { level: 4, name: 'Full Rollout Kneeling', hint: 'Полная амплитуда с колен' },
    { level: 5, name: 'Rollout with Pause', hint: 'Пауза 2 сек в нижней точке' },
    { level: 6, name: 'Rollout + Return', hint: 'Медленный возврат без прогиба' },
    { level: 7, name: 'Weighted Rollout', hint: 'С весом на спине' },
    { level: 8, name: 'Standing Negative', hint: 'Только негатив со стойки' },
    { level: 9, name: 'Standing Half Rollout', hint: 'Половина стоя' },
    { level: 10, name: 'Standing Full Rollout', hint: 'Полный роллаут стоя' },
  ],
} as CatalogEntry;

// ==================== Осанка (L1..L10) ====================

export const POSTURE_UPPER: CatalogEntry = {
  key: 'posture-upper',
  label: 'Осанка: верх спины',
  icuName: 'Posture Upper',
  category: 'posture',
  levels: [
    { level: 1, name: 'Chin Tucks', hint: 'Подбородок к шее, без напряжения' },
    { level: 2, name: 'Wall Angels', hint: 'Лопатки прижаты к стене' },
    { level: 3, name: 'Prone Y-Raises', hint: 'Лёжа, руки в Y, подъём лопаток' },
    { level: 4, name: 'Prone T-Raises', hint: 'Руки в T, лопатки к центру' },
    { level: 5, name: 'Prone W-Raises', hint: 'Руки в W, сжатие лопаток' },
    { level: 6, name: 'Superman Hold', hint: 'Одновременно руки и ноги' },
    { level: 7, name: 'Prone Cobra', hint: 'Плавный подъём корпуса, лопатки вместе' },
    { level: 8, name: 'Cat-Cow Flow', hint: 'Плавные перекаты, дыхание с движением' },
    { level: 9, name: 'Bird Dog Hold', hint: 'Противоположные рука/нога, 5 сек' },
    { level: 10, name: 'Banded Face Pulls', hint: 'С резинкой, лопатки к центру' },
  ],
};

export const POSTURE_FULL: CatalogEntry = {
  key: 'posture-full',
  label: 'Осанка: комплекс',
  icuName: 'Posture Full',
  category: 'posture',
  levels: [
    { level: 1, name: 'Wall Stand', hint: 'Стоять у стены 30 сек' },
    { level: 2, name: 'Wall Slide', hint: 'Руки вверх по стене' },
    { level: 3, name: 'Chest Opener', hint: 'Раскрытие грудного отдела' },
    { level: 4, name: 'Doorway Stretch', hint: 'Растяжка груди в проёме' },
    { level: 5, name: 'Hip Flexor Stretch', hint: 'Стоя на одном колене' },
    { level: 6, name: 'Thoracic Extension', hint: 'На валике, руки назад' },
    { level: 7, name: 'Prone Press-Up', hint: 'Маккензи, мягкая экстензия' },
    { level: 8, name: 'Quadruped T-Spine', hint: 'Ротация в упоре на четвереньках' },
    { level: 9, name: 'Standing Overhead Reach', hint: 'Руки вверх без прогиба' },
    { level: 10, name: 'Full Posture Flow', hint: 'Все элементы в потоке' },
  ],
};

// ==================== Жиросжигание / HIIT (L1..L10) ====================

export const WEIGHTLOSS_HIIT: CatalogEntry = {
  key: 'weightloss-hiit',
  label: 'HIIT: базовые кардио',
  icuName: 'HIIT Basic',
  category: 'weightloss',
  levels: [
    { level: 1, name: 'Jumping Jacks', hint: 'Прыжки ноги-руки' },
    { level: 2, name: 'High Knees', hint: 'Бег на месте с высоким коленом' },
    { level: 3, name: 'Mountain Climbers', hint: 'Планка + поочерёдные ноги' },
    { level: 4, name: 'Bear Crawl', hint: 'Ходьба на четвереньках' },
    { level: 5, name: 'Jump Squats', hint: 'Присед с прыжком' },
    { level: 6, name: 'Shadow Boxing', hint: 'Бой с тенью, работа рук' },
    { level: 7, name: 'Jump Rope', hint: 'Скакалка, ровный ритм' },
    { level: 8, name: 'Tuck Jumps', hint: 'Прыжки с подтяжкой колен' },
    { level: 9, name: 'Burpees', hint: 'Прыжок-планка-прыжок' },
    { level: 10, name: 'Burpee + Push-up', hint: 'Burpee с отжиманием' },
  ],
};

export const WEIGHTLOSS_BODYWEIGHT: CatalogEntry = {
  key: 'weightloss-bw',
  label: 'HIIT: силовое тело',
  icuName: 'HIIT Strength',
  category: 'weightloss',
  levels: [
    { level: 1, name: 'Bodyweight Squat', hint: 'Полный присед, руки вперёд' },
    { level: 2, name: 'Reverse Lunge', hint: 'Шаг назад, колено к полу' },
    { level: 3, name: 'Push-up', hint: 'Полные отжимания' },
    { level: 4, name: 'Glute Bridge', hint: 'Мостик на плечах' },
    { level: 5, name: 'Plank Hold', hint: 'Классическая планка' },
    { level: 6, name: 'Split Squat', hint: 'Статический выпад' },
    { level: 7, name: 'Pike Push-up', hint: 'Складка, руки на полу' },
    { level: 8, name: 'Single-Leg Glute Bridge', hint: 'Мостик на одной ноге' },
    { level: 9, name: 'Pistol Squat (neg)', hint: 'Негатив пистолетика' },
    { level: 10, name: 'Full Body Circuit', hint: 'Все элементы в круге' },
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
  // Core
  CORE_DRAGONFLAG,
  CORE_ANTIEXT,
  // Posture
  POSTURE_UPPER,
  POSTURE_FULL,
  // Weight-loss
  WEIGHTLOSS_HIIT,
  WEIGHTLOSS_BODYWEIGHT,
];

// ==================== Упражнения без уровней (named) ====================

export const NAMED_EXERCISES: NamedExercise[] = [
  // --- СБУ (Специальные беговые упражнения) ---
  { key: 'a-skip', category: 'drill', label: 'A-Skip', nameRu: 'А-скип',
    icuName: 'A-Skip', hint: 'Носок на себя, активное бедро',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'b-skip', category: 'drill', label: 'B-Skip', nameRu: 'Б-скип',
    icuName: 'B-Skip', hint: 'Выброс прямой ноги',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'high-knees', category: 'drill', label: 'High Knees', nameRu: 'Высокое колено',
    icuName: 'High Knees', hint: 'Максимальная частота',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'butt-kicks', category: 'drill', label: 'Butt Kicks', nameRu: 'Захлёст голени',
    icuName: 'Butt Kicks', hint: 'Пятка к ягодице',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'carioca-l', category: 'drill', label: 'Carioca L', nameRu: 'Карьока левым боком',
    icuName: 'Carioca L', hint: 'Скрестный шаг, левым боком',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'carioca-r', category: 'drill', label: 'Carioca R', nameRu: 'Карьока правым боком',
    icuName: 'Carioca R', hint: 'Скрестный шаг, правым боком',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'ankling', category: 'drill', label: 'Ankling', nameRu: 'Перекат',
    icuName: 'Ankling', hint: 'Перекат с пятки на носок',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'lateral-shuffle', category: 'drill', label: 'Lateral Shuffle', nameRu: 'Приставной шаг',
    icuName: 'Lateral Shuffle', hint: 'Приставной шаг',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'backward-run', category: 'drill', label: 'Backward Run', nameRu: 'Бег спиной',
    icuName: 'Backward Run', hint: 'Бег спиной вперёд',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'bounding', category: 'drill', label: 'Bounding', nameRu: 'Многоскоки',
    icuName: 'Bounding', hint: 'Многоскоки',
    defaultDuration: '40mtr', defaultZone: 1 },
  { key: 'straight-leg', category: 'drill', label: 'Straight Leg', nameRu: 'Бег на прямых',
    icuName: 'Straight Leg', hint: 'Бег на прямых ногах',
    defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'power-skips', category: 'drill', label: 'Power Skips', nameRu: 'Прыжки в шаге',
    icuName: 'Power Skips', hint: 'Прыжки в шаге',
    defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'strides', category: 'drill', label: 'Strides', nameRu: 'Ускорения',
    icuName: 'Strides', hint: 'Ускорение расслабленно',
    defaultDuration: '100mtr', defaultZone: 5 },
  { key: 'acceleration', category: 'drill', label: 'Acceleration', nameRu: 'Разгон',
    icuName: 'Acceleration', hint: 'Разгон 0-95%',
    defaultDuration: '50mtr', defaultZone: 5 },

  // --- СБУ: расширение ---
  { key: 'straight-leg-bound', category: 'drill', label: 'Straight-Leg Bound', nameRu: 'Прыжки на прямой ноге',
    icuName: 'Straight-Leg Bound', hint: 'Отталкивание прямой ногой',
    defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'sl-hops-l', category: 'drill', label: 'Single-Leg Hops L', nameRu: 'Прыжки на левой',
    icuName: 'Single-Leg Hops L', hint: 'Прыжки на левой',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'sl-hops-r', category: 'drill', label: 'Single-Leg Hops R', nameRu: 'Прыжки на правой',
    icuName: 'Single-Leg Hops R', hint: 'Прыжки на правой',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'fast-feet', category: 'drill', label: 'Fast Feet', nameRu: 'Частые шаги',
    icuName: 'Fast Feet', hint: 'Максимальная частота, короткий шаг',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'wall-drill', category: 'drill', label: 'Wall Drill', nameRu: 'У стены',
    icuName: 'Wall Drill', hint: 'У стены, работа бёдра',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'marching-high-knees', category: 'drill', label: 'Marching High Knees', nameRu: 'Ходьба с высоким коленом',
    icuName: 'Marching High Knees', hint: 'Медленно, акцент на осанке',
    defaultDuration: '20mtr', defaultZone: 1 },

  // --- Плиометрика ---
  { key: 'jump-squats', category: 'plyo', label: 'Jump Squats', nameRu: 'Прыжковые приседания',
    icuName: 'Jump Squats', hint: 'Прыжковые приседания',
    defaultDuration: '30s', defaultZone: 3 },
  { key: 'lunge-jumps', category: 'plyo', label: 'Lunge Jumps', nameRu: 'Выпады с прыжком',
    icuName: 'Lunge Jumps', hint: 'Выпады с прыжком',
    defaultDuration: '30s', defaultZone: 3 },
  { key: 'broad-jumps', category: 'plyo', label: 'Broad Jumps', nameRu: 'Прыжки в длину',
    icuName: 'Broad Jumps', hint: 'Прыжки в длину',
    defaultDuration: '30s', defaultZone: 3 },
  { key: 'skater-hops', category: 'plyo', label: 'Skater Hops', nameRu: 'Боковые прыжки',
    icuName: 'Skater Hops', hint: 'Боковые прыжки',
    defaultDuration: '30s', defaultZone: 3 },

  // --- Разминка / заминка ---
  { key: 'jumping-jacks', category: 'warmup', label: 'Jumping Jacks', nameRu: 'Прыжки ноги-руки',
    icuName: 'Jumping Jacks', hint: 'Прыжки ноги-руки',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'walking-lunges', category: 'warmup', label: 'Walking Lunges', nameRu: 'Выпады в движении',
    icuName: 'Walking Lunges', hint: 'Выпады в движении',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'inchworms', category: 'warmup', label: 'Inchworms', nameRu: 'Ходьба на руках',
    icuName: 'Inchworms', hint: 'Ходьба на руках',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'arm-circles', category: 'warmup', label: 'Arm Circles', nameRu: 'Круги руками',
    icuName: 'Arm Circles', hint: 'Круги руками',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'leg-swings', category: 'warmup', label: 'Leg Swings', nameRu: 'Махи ногами',
    icuName: 'Leg Swings', hint: 'Махи ногами',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'dead-bug', category: 'warmup', label: 'Dead Bug', nameRu: 'Жук',
    icuName: 'Dead Bug', hint: 'Поясница прижата',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'bird-dog', category: 'warmup', label: 'Bird Dog', nameRu: 'Собака-птица',
    icuName: 'Bird Dog', hint: 'Без ротации корпуса',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'hollow-body-hold', category: 'warmup', label: 'Hollow Body Hold', nameRu: 'Лодочка',
    icuName: 'Hollow Body Hold', hint: 'Носки оттянуты, поясница на полу',
    defaultDuration: '30s', defaultZone: 1 },

  // --- Run-basic ---
  { key: 'recovery-jog', category: 'run-basic', label: 'Recovery Jog', nameRu: 'Трусца',
    icuName: 'Recovery Jog', hint: 'Трусца для восстановления',
    defaultDuration: '200mtr', defaultZone: 1 },
  { key: 'walk-back', category: 'run-basic', label: 'Walk Back', nameRu: 'Шагом назад',
    icuName: 'Walk Back', hint: 'Пешком назад к старту',
    defaultDuration: '100mtr', defaultZone: 1 },
  { key: 'rest', category: 'run-basic', label: 'Rest', nameRu: 'Отдых',
    icuName: 'Rest', hint: 'Отдых',
    defaultDuration: '60s', defaultZone: 1 },

  // --- Стопы / голень / ахилл (новое) ---
  { key: 'tibialis-raises', category: 'prehab', label: 'Tibialis Raises', nameRu: 'Подъёмы носков на себя',
    icuName: 'Tibialis Raises', hint: 'Передняя большеберцовая, профилактика ахилла',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'toe-yoga', category: 'prehab', label: 'Toe Yoga', nameRu: 'Йога пальцев стопы',
    icuName: 'Toe Yoga', hint: 'Разведение и сведение пальцев',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'short-foot', category: 'prehab', label: 'Short Foot', nameRu: 'Сокращение стопы',
    icuName: 'Short Foot', hint: 'Свод стопы без поджатия пальцев',
    defaultDuration: '30s', defaultZone: 1 },

  // --- Кор: динамика и косые (новое) ---
  { key: 'russian-twist', category: 'warmup', label: 'Russian Twist', nameRu: 'Скручивания с поворотом',
    icuName: 'Russian Twist', hint: 'Косые мышцы живота',
    defaultDuration: '30s', defaultZone: 3 },
  { key: 'bicycle-crunch', category: 'warmup', label: 'Bicycle Crunch', nameRu: 'Велосипед',
    icuName: 'Bicycle Crunch', hint: 'Попеременное касание локтя и колена',
    defaultDuration: '30s', defaultZone: 3 },
  { key: 'mountain-climbers', category: 'warmup', label: 'Mountain Climbers', nameRu: 'Альпинист',
    icuName: 'Mountain Climbers', hint: 'Планка + попеременный подвод колен',
    defaultDuration: '30s', defaultZone: 3 },

      // --- Prehab: стопы / голень / ахилл ---
  { key: 'eccentric-heel-drop', category: 'prehab', label: 'Eccentric Heel Drop', nameRu: 'Эксцентрическое опускание на пятку',
    icuName: 'Eccentric Heel Drop', hint: 'Протокол Альфредасона для ахилла',
    defaultDuration: '30s', defaultZone: 1 },

  // --- Prehab: колени / ягодичные ---
  { key: 'terminal-knee-extension', category: 'prehab', label: 'Terminal Knee Extension', nameRu: 'Разгибание колена с резинкой',
    icuName: 'Terminal Knee Extension', hint: 'VMO, стабилизация колена',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'clamshells', category: 'prehab', label: 'Clamshells', nameRu: 'Раскрытие бедра (ракушка)',
    icuName: 'Clamshells', hint: 'Ягодичная, стабилизация таза',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'wall-sit', category: 'prehab', label: 'Wall Sit', nameRu: 'Стульчик у стены',
    icuName: 'Wall Sit', hint: 'Изометрия квадрицепса',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'step-downs', category: 'prehab', label: 'Step-Downs', nameRu: 'Спуск с платформы',
    icuName: 'Step-Downs', hint: 'Контроль колена при спуске',
    defaultDuration: '30s', defaultZone: 1 },

  // --- Prehab: спина / осанка ---
  { key: 'cat-cow', category: 'prehab', label: 'Cat-Cow', nameRu: 'Кошка-корова',
    icuName: 'Cat-Cow', hint: 'Мобильность позвоночника',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'superman-hold', category: 'prehab', label: 'Superman Hold', nameRu: 'Супермен',
    icuName: 'Superman Hold', hint: 'Разгибатели спины',
    defaultDuration: '30s', defaultZone: 1 },
  { key: 'hip-flexor-stretch', category: 'prehab', label: 'Hip Flexor Stretch', nameRu: 'Растяжка сгибателей бедра',
    icuName: 'Hip Flexor Stretch', hint: 'Подвздошно-поясничная, компенсация сидения',
    defaultDuration: '30s', defaultZone: 1 },
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