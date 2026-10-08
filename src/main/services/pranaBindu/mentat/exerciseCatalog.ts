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
    { level: 6, name: 'Close Push-ups', nameRu: 'Узкие отжимания', aliases: ['Diamond Push-ups'],
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
      aliases: ['Body Row', 'Australian Pull-ups'],
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
      aliases: ['Bar Knee Raises'],
      benchmarkLadder: ['1x5', '2x10', '2x20'], source: 'wade' },
    { level: 6, name: 'Hanging Bent Raises', nameRu: 'Подъёмы согнутых ног в висе',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 7, name: 'Hanging Frog Raises', nameRu: 'Подъёмы ног в висе «лягушка»',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 8, name: 'Partial Straight Raises', nameRu: 'Неполные подъёмы прямых ног в висе',
      benchmarkLadder: ['1x5', '2x10', '2x15'], source: 'wade' },
    { level: 9, name: 'Hanging Straight Raises', nameRu: 'Подъёмы прямых ног в висе', aliases: ['Hanging Leg Raises'],
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
  aliases: ['Bridge', 'Back Bridge'],
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
    { level: 6, name: 'Full Bridges', nameRu: 'Полный мостик', aliases: ['Full Bridge'],
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
    { level: 1, name: 'Bench Dips', nameRu: 'Отжимания от скамьи',
      aliases: ['Bench Dip'],
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'startbw' },
    { level: 2, name: 'Short Bench Dips', nameRu: 'Короткие от скамьи',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'startbw' },
    { level: 3, name: 'Negative Dips', nameRu: 'Негативные',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'startbw' },
    { level: 4, name: 'Assisted Dips', nameRu: 'С поддержкой',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'startbw' },
    { level: 5, name: 'Full Dips', nameRu: 'Полные',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'startbw' },
    { level: 6, name: 'Ring Dips', nameRu: 'На кольцах',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'startbw' },
    { level: 7, name: 'Weighted Dips', nameRu: 'С весом',
      benchmarkLadder: ['1x5', '2x5', '3x5'], source: 'startbw' },
    { level: 8, name: 'Korean Dips', nameRu: 'Корейские',
      benchmarkLadder: ['1x3', '2x5', '3x6'], source: 'startbw' },
    { level: 9, name: 'One-Arm Dips (neg)', nameRu: 'На одной, негатив',
      benchmarkLadder: ['1x1', '2x2', '3x3'], benchmarkRounds: 2, source: 'startbw' },
    { level: 10, name: 'Muscle-up', nameRu: 'Выход силой',
      benchmarkLadder: ['1x1', '2x3', '3x5'], source: 'startbw' },
  ],
};

export const CALI_PLANK: CatalogEntry = {
  key: 'plank',
  label: 'Планка',
  icuName: 'Plank',
  category: 'cali',
  levels: [
    { level: 1, name: 'Knee Plank', nameRu: 'С колен',
      benchmarkLadder: ['30s', '60s', '120s'], source: 'acsm' },
    { level: 2, name: 'Forearm Plank', nameRu: 'На предплечьях',
      benchmarkLadder: ['30s', '60s', '120s'], source: 'acsm' },
    { level: 3, name: 'Full Plank', nameRu: 'Полная',
      benchmarkLadder: ['30s', '60s', '120s'], source: 'acsm' },
    { level: 4, name: 'Side Plank', nameRu: 'Боковая',
      benchmarkLadder: ['30s', '60s', '90s'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'Plank with Leg Lift', nameRu: 'С подъёмом ноги',
      benchmarkLadder: ['20s', '40s', '60s'], benchmarkRounds: 2, source: 'acsm' },
    { level: 6, name: 'RKC Plank', nameRu: 'RKC',
      benchmarkLadder: ['20s', '30s', '45s'], source: 'og2' },
    { level: 7, name: 'Body Saw Plank', nameRu: 'Пила',
      benchmarkLadder: ['20s', '30s', '45s'], source: 'og2' },
    { level: 8, name: 'Ring Plank', nameRu: 'На кольцах',
      benchmarkLadder: ['15s', '30s', '45s'], source: 'og2' },
    { level: 9, name: 'Weighted Plank', nameRu: 'С весом',
      benchmarkLadder: ['30s', '60s', '90s'], source: 'og2' },
    { level: 10, name: 'One-Arm Plank', nameRu: 'На одной руке',
      benchmarkLadder: ['15s', '30s', '45s'], benchmarkRounds: 2, source: 'og2' },
  ],
};

export const CALI_LSIT: CatalogEntry = {
  key: 'lsit',
  label: 'L-сиденье',
  icuName: 'L-sit',
  category: 'cali',
  levels: [
    { level: 1, name: 'Foot-Supported L-sit', nameRu: 'С опорой ногами',
      benchmarkLadder: ['15s', '30s', '45s'], source: 'og2' },
    { level: 2, name: 'Tuck L-sit', nameRu: 'Колени к груди',
      benchmarkLadder: ['10s', '20s', '30s'], source: 'og2' },
    { level: 3, name: 'One-Leg L-sit', nameRu: 'Одна нога выпрямлена',
      benchmarkLadder: ['10s', '20s', '30s'], benchmarkRounds: 2, source: 'og2' },
    { level: 4, name: 'L-sit on Parallettes', nameRu: 'На низких брусьях',
      benchmarkLadder: ['10s', '20s', '30s'], source: 'og2' },
    { level: 5, name: 'Full L-sit', nameRu: 'Полное',
      benchmarkLadder: ['10s', '15s', '30s'], source: 'og2' },
    { level: 6, name: 'L-sit on Rings', nameRu: 'На кольцах',
      benchmarkLadder: ['10s', '15s', '20s'], source: 'og2' },
    { level: 7, name: 'V-sit', nameRu: 'V-положение',
      benchmarkLadder: ['5s', '10s', '15s'], source: 'og2' },
    { level: 8, name: 'Straddle V-sit', nameRu: 'V, ноги врозь',
      benchmarkLadder: ['5s', '10s', '15s'], source: 'og2' },
    { level: 9, name: 'Manna progression', nameRu: 'Прогрессия к манне',
      benchmarkLadder: ['3s', '5s', '10s'], source: 'og2' },
    { level: 10, name: 'Manna', nameRu: 'Манна',
      benchmarkLadder: ['3s', '5s', '10s'], source: 'og2' },
  ],
};

export const CALI_PLANCHE: CatalogEntry = {
  key: 'planche',
  label: 'Планш',
  icuName: 'Planche',
  category: 'cali',
  levels: [
    { level: 1, name: 'Pseudo Planche Push-ups', nameRu: 'Псевдо-планш',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'og2' },
    { level: 2, name: 'Frog Stand', nameRu: 'Лягушка',
      benchmarkLadder: ['10s', '20s', '30s'], source: 'og2' },
    { level: 3, name: 'Tuck Planche', nameRu: 'Сгруппированный',
      benchmarkLadder: ['5s', '10s', '20s'], source: 'og2' },
    { level: 4, name: 'Advanced Tuck Planche', nameRu: 'Продвинутая группировка',
      benchmarkLadder: ['5s', '10s', '15s'], source: 'og2' },
    { level: 5, name: 'Straddle Planche', nameRu: 'Ноги врозь',
      benchmarkLadder: ['3s', '5s', '10s'], source: 'og2' },
    { level: 6, name: 'Half-Lay Planche', nameRu: 'Полу-плашмя',
      benchmarkLadder: ['3s', '5s', '10s'], source: 'og2' },
    { level: 7, name: 'Full Planche', nameRu: 'Полный планш',
      benchmarkLadder: ['2s', '5s', '10s'], source: 'og2' },
    { level: 8, name: 'Planche Push-ups', nameRu: 'Планш с отжиманием',
      benchmarkLadder: ['1x1', '2x2', '3x3'], source: 'og2' },
    { level: 9, name: 'One-Arm Planche (tuck)', nameRu: 'На одной, сгруппированный',
      benchmarkLadder: ['2s', '3s', '5s'], benchmarkRounds: 2, source: 'og2' },
    { level: 10, name: 'One-Arm Planche', nameRu: 'Мастерский уровень',
      benchmarkLadder: ['1s', '2s', '3s'], benchmarkRounds: 2, source: 'og2' },
  ],
};

export const CALI_FRONTLEVER: CatalogEntry = {
  key: 'frontlever',
  label: 'Фронтальный вис',
  icuName: 'Front Lever',
  category: 'cali',
  levels: [
    { level: 1, name: 'Tuck Front Lever', nameRu: 'Сгруппированный',
      benchmarkLadder: ['10s', '20s', '30s'], source: 'og2' },
    { level: 2, name: 'Advanced Tuck FL', nameRu: 'Продвинутая группировка',
      benchmarkLadder: ['10s', '15s', '20s'], source: 'og2' },
    { level: 3, name: 'One-Leg FL', nameRu: 'Одна нога выпрямлена',
      benchmarkLadder: ['10s', '15s', '20s'], benchmarkRounds: 2, source: 'og2' },
    { level: 4, name: 'Straddle FL', nameRu: 'Ноги врозь',
      benchmarkLadder: ['5s', '10s', '15s'], source: 'og2' },
    { level: 5, name: 'Full FL', nameRu: 'Полный',
      benchmarkLadder: ['5s', '10s', '15s'], source: 'og2' },
    { level: 6, name: 'FL Raises', nameRu: 'Подъёмы в FL',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'og2' },
    { level: 7, name: 'FL Rows', nameRu: 'Тяги в FL',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'og2' },
    { level: 8, name: 'Touch-and-Go FL', nameRu: 'Касания',
      benchmarkLadder: ['1x1', '2x3', '3x5'], source: 'og2' },
    { level: 9, name: 'One-Arm FL (tuck)', nameRu: 'На одной, сгруппированный',
      benchmarkLadder: ['3s', '5s', '10s'], benchmarkRounds: 2, source: 'og2' },
    { level: 10, name: 'One-Arm FL', nameRu: 'Мастерский уровень',
      benchmarkLadder: ['2s', '3s', '5s'], benchmarkRounds: 2, source: 'og2' },
  ],
};

// ==================== Силовая для бегунов (L1..L10) ====================

export const RUNNER_SQUAT: CatalogEntry = {
  key: 'runnersquat',
  label: 'Одноножные приседания',
  icuName: 'Single-Leg Squats',
  category: 'runner',
  levels: [
    { level: 1, name: 'Chair Squat', nameRu: 'На стул',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 2, name: 'Assisted Pistol', nameRu: 'Пистолет с опорой',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 3, name: 'Box Pistol', nameRu: 'Пистолет на низкую опору',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 4, name: 'Counterbalance Pistol', nameRu: 'Пистолет с противовесом',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'Full Pistol', nameRu: 'Полный пистолет',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'startbw' },
    { level: 6, name: 'Pistol on Deficit', nameRu: 'Пистолет с возвышения',
      benchmarkLadder: ['1x5', '2x6', '3x8'], benchmarkRounds: 2, source: 'og2' },
    { level: 7, name: 'Weighted Pistol', nameRu: 'Пистолет с весом',
      benchmarkLadder: ['1x5', '2x5', '3x5'], benchmarkRounds: 2, source: 'og2' },
    { level: 8, name: 'Shrimp Squat (assisted)', nameRu: 'Креветка с опорой',
      benchmarkLadder: ['1x3', '2x5', '3x8'], benchmarkRounds: 2, source: 'og2' },
    { level: 9, name: 'Shrimp Squat', nameRu: 'Креветка',
      benchmarkLadder: ['1x3', '2x5', '3x8'], benchmarkRounds: 2, source: 'og2' },
    { level: 10, name: 'Shrimp (no hands)', nameRu: 'Креветка без рук',
      benchmarkLadder: ['1x3', '2x5', '3x5'], benchmarkRounds: 2, source: 'og2' },
  ],
};

export const RUNNER_RDL: CatalogEntry = {
  key: 'runnerleg',
  label: 'Румынская тяга на одной ноге',
  icuName: 'Single-Leg RDL',
  category: 'runner',
  levels: [
    { level: 1, name: 'Assisted SL-RDL', nameRu: 'С опорой',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 2, name: 'SL-RDL (partial)', nameRu: 'Полуамплитуда',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 3, name: 'Full SL-RDL', nameRu: 'Полная',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 4, name: 'SL-RDL with pause', nameRu: 'С паузой внизу',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'SL-RDL with weight', nameRu: 'С весом',
      benchmarkLadder: ['1x8', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 6, name: 'SL-RDL on bosu', nameRu: 'На нестабильной опоре',
      benchmarkLadder: ['1x6', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 7, name: 'SL-RDL eyes closed', nameRu: 'С закрытыми глазами',
      benchmarkLadder: ['1x5', '2x6', '3x8'], benchmarkRounds: 2, source: 'acsm' },
    { level: 8, name: 'SL-RDL on wobble board', nameRu: 'На балансире',
      benchmarkLadder: ['1x5', '2x6', '3x8'], benchmarkRounds: 2, source: 'acsm' },
    { level: 9, name: 'Single-Leg Deadlift', nameRu: 'Становая на одной',
      benchmarkLadder: ['1x5', '2x5', '3x5'], benchmarkRounds: 2, source: 'og2' },
    { level: 10, name: 'Pistol-to-RDL combo', nameRu: 'Комбо',
      benchmarkLadder: ['1x3', '2x5', '3x6'], benchmarkRounds: 2, source: 'og2' },
  ],
};

export const RUNNER_CALF: CatalogEntry = {
  key: 'calfraise',
  label: 'Подъёмы на носки',
  icuName: 'Calf Raises',
  category: 'runner',
  levels: [
    { level: 1, name: 'Seated Calf Raises', nameRu: 'Сидя, обе ноги',
      benchmarkLadder: ['1x15', '2x20', '3x25'], source: 'acsm' },
    { level: 2, name: 'Standing Calf Raises', nameRu: 'Стоя, обе',
      benchmarkLadder: ['1x15', '2x20', '3x25'], source: 'acsm' },
    { level: 3, name: 'Single-Leg (assisted)', nameRu: 'На одной, с опорой',
      benchmarkLadder: ['1x10', '2x15', '3x20'], benchmarkRounds: 2, source: 'acsm' },
    { level: 4, name: 'Single-Leg Calf Raises', nameRu: 'На одной',
      benchmarkLadder: ['1x10', '2x15', '3x20'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'Deficit Calf Raises', nameRu: 'С возвышения',
      benchmarkLadder: ['1x10', '2x15', '3x20'], benchmarkRounds: 2, source: 'acsm' },
    { level: 6, name: 'Weighted Single-Leg', nameRu: 'С весом, одна нога',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 7, name: 'Slow Eccentric Calf', nameRu: 'Медленная негативная',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'alfredson' },
    { level: 8, name: 'Explosive Calf Raises', nameRu: 'Взрывные',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'acsm' },
    { level: 9, name: 'Calf Raises on toes', nameRu: 'На пальцах',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'acsm' },
    { level: 10, name: 'Depth Jump + Calf', nameRu: 'Прыжок + подъём',
      benchmarkLadder: ['1x5', '2x6', '3x8'], source: 'acsm' },
  ],
};

export const RUNNER_ANTICORE: CatalogEntry = {
  key: 'anticore',
  label: 'Антиротационный кор',
  icuName: 'Anti-Rotation Core',
  category: 'runner',
  levels: [
    { level: 1, name: 'Dead Bug', nameRu: 'Жук',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 2, name: 'Bird Dog', nameRu: 'Собака-птица',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 3, name: 'Side Plank', nameRu: 'Боковая планка',
      benchmarkLadder: ['30s', '45s', '60s'], benchmarkRounds: 2, source: 'acsm' },
    { level: 4, name: 'Pallof Press', nameRu: 'Пресс Паллофа',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'Pallof Hold', nameRu: 'Удержание Паллофа',
      benchmarkLadder: ['20s', '30s', '45s'], benchmarkRounds: 2, source: 'acsm' },
    { level: 6, name: 'Kneeling Pallof', nameRu: 'С колен',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 7, name: 'Pallof with rotation', nameRu: 'С ротацией',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 8, name: 'Standing Rollout', nameRu: 'Роллаут стоя',
      benchmarkLadder: ['1x6', '2x8', '3x10'], source: 'og2' },
    { level: 9, name: 'Ab Wheel Kneeling', nameRu: 'Колесо с колен',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'og2' },
    { level: 10, name: 'Ab Wheel Standing', nameRu: 'Колесо стоя',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'og2' },
  ],
};

export const RUNNER_LUNGE: CatalogEntry = {
  key: 'runnerlunge',
  label: 'Выпады',
  icuName: 'Lunges',
  category: 'runner',
  levels: [
    { level: 1, name: 'Mini Lunge', nameRu: 'Мини-выпад',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 2, name: 'Static Lunge', nameRu: 'Статический',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 3, name: 'Walking Lunge', nameRu: 'В движении',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 4, name: 'Reverse Lunge', nameRu: 'Назад',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 5, name: 'Bulgarian Split Squat', nameRu: 'Болгарский', aliases: ['Bulgarian Split Squats'],
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 6, name: 'Deficit Reverse Lunge', nameRu: 'С возвышения',
      benchmarkLadder: ['1x8', '2x10', '3x12'], benchmarkRounds: 2, source: 'acsm' },
    { level: 7, name: 'Weighted Bulgarian', nameRu: 'С весом',
      benchmarkLadder: ['1x6', '2x8', '3x10'], benchmarkRounds: 2, source: 'acsm' },
    { level: 8, name: 'Jumping Lunge', nameRu: 'С прыжком',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'acsm' },
    { level: 9, name: 'Curtsy Lunge', nameRu: 'Кёртси',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 10, name: 'Pistol-to-Lunge combo', nameRu: 'Комбо',
      benchmarkLadder: ['1x3', '2x5', '3x6'], benchmarkRounds: 2, source: 'og2' },
  ],
};

// ==================== Кор (L1..L10) ====================

export const CORE_DRAGONFLAG: CatalogEntry = {
  key: 'core-dragonflag',
  label: 'Кор: прогрессия драконьего флага',
  icuName: 'Dragon Flag',
  category: 'core',
  levels: [
    { level: 1, name: 'Dead Bug', nameRu: 'Жук',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 2, name: 'Hollow Body Hold', nameRu: 'Лодочка',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'og2' },
    { level: 3, name: 'Hollow Rock', nameRu: 'Качание в лодочке',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'og2' },
    { level: 4, name: 'Lying Leg Raise', nameRu: 'Подъём прямых ног лёжа',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'og2' },
    { level: 5, name: 'V-Up', nameRu: 'V-складка',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'og2' },
    { level: 6, name: 'Dragon Flag Negative', nameRu: 'Драконий флаг, негатив',
      benchmarkLadder: ['1x3', '2x5', '3x5'], source: 'og2' },
    { level: 7, name: 'Dragon Flag Tuck', nameRu: 'Драконий флаг сгруппированный',
      benchmarkLadder: ['1x3', '2x5', '3x5'], source: 'og2' },
    { level: 8, name: 'Dragon Flag One-Leg', nameRu: 'Драконий флаг на одной ноге',
      benchmarkLadder: ['1x3', '2x4', '3x5'], benchmarkRounds: 2, source: 'og2' },
    { level: 9, name: 'Dragon Flag Half', nameRu: 'Драконий флаг половинный',
      benchmarkLadder: ['1x3', '2x4', '3x5'], source: 'og2' },
    { level: 10, name: 'Dragon Flag Full', nameRu: 'Драконий флаг полный',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'og2' },
  ],
};

export const CORE_ANTIEXT = {
  key: 'core-antiext',
  label: 'Кор: анти-экстензия на колесе',
  icuName: 'Ab Wheel',
  category: 'core' as const,
  levels: [
    { level: 1, name: 'Kneeling Plank Hold', nameRu: 'Планка с колен',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 2, name: 'Short Rollout', nameRu: 'Короткий роллаут',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'og2' },
    { level: 3, name: 'Half Rollout', nameRu: 'Полуроллаут',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'og2' },
    { level: 4, name: 'Full Rollout Kneeling', nameRu: 'Полный с колен',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'og2' },
    { level: 5, name: 'Rollout with Pause', nameRu: 'С паузой внизу',
      benchmarkLadder: ['1x3', '2x5', '3x8'], source: 'og2' },
    { level: 6, name: 'Rollout + Return', nameRu: 'Роллаут с возвратом',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'og2' },
    { level: 7, name: 'Weighted Rollout', nameRu: 'С весом',
      benchmarkLadder: ['1x5', '2x5', '3x8'], source: 'og2' },
    { level: 8, name: 'Standing Negative', nameRu: 'Негатив со стойки',
      benchmarkLadder: ['1x3', '2x5', '3x5'], source: 'og2' },
    { level: 9, name: 'Standing Half Rollout', nameRu: 'Полуроллаут стоя',
      benchmarkLadder: ['1x3', '2x5', '3x5'], source: 'og2' },
    { level: 10, name: 'Standing Full Rollout', nameRu: 'Полный роллаут стоя',
      benchmarkLadder: ['1x3', '2x5', '3x5'], source: 'og2' },
  ],
} as CatalogEntry;

// ==================== Осанка (L1..L10) ====================

export const POSTURE_UPPER: CatalogEntry = {
  key: 'posture-upper',
  label: 'Осанка: верх спины',
  icuName: 'Posture Upper',
  category: 'posture',
  levels: [
    { level: 1, name: 'Chin Tucks', nameRu: 'Втягивание подбородка',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'spaulding' },
    { level: 2, name: 'Wall Angels', nameRu: 'Ангел у стены',
      benchmarkLadder: ['1x10', '2x12', '3x15'], source: 'spaulding' },
    { level: 3, name: 'Prone Y-Raises', nameRu: 'Y-подъёмы лёжа',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'spaulding' },
    { level: 4, name: 'Prone T-Raises', nameRu: 'T-подъёмы лёжа',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'spaulding' },
    { level: 5, name: 'Prone W-Raises', nameRu: 'W-подъёмы лёжа',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'spaulding' },
    { level: 6, name: 'Superman Hold', nameRu: 'Супермен',
      benchmarkLadder: ['20s', '30s', '45s'], source: 'spaulding' },
    { level: 7, name: 'Prone Cobra', nameRu: 'Кобра лёжа',
      benchmarkLadder: ['15s', '30s', '45s'], source: 'spaulding' },
    { level: 8, name: 'Cat-Cow Flow', nameRu: 'Кошка-корова',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'spaulding' },
    { level: 9, name: 'Bird Dog Hold', nameRu: 'Собака-птица, удержание',
      benchmarkLadder: ['20s', '30s', '45s'], benchmarkRounds: 2, source: 'spaulding' },
    { level: 10, name: 'Banded Face Pulls', nameRu: 'Тяга к лицу с резинкой',
      benchmarkLadder: ['1x12', '2x15', '3x20'], source: 'spaulding' },
  ],
};

export const POSTURE_FULL: CatalogEntry = {
  key: 'posture-full',
  label: 'Осанка: комплекс',
  icuName: 'Posture Full',
  category: 'posture',
  levels: [
    { level: 1, name: 'Wall Stand', nameRu: 'Стойка у стены',
      benchmarkLadder: ['30s', '60s', '90s'], source: 'spaulding' },
    { level: 2, name: 'Wall Slide', nameRu: 'Скольжение у стены',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'spaulding' },
    { level: 3, name: 'Chest Opener', nameRu: 'Раскрытие груди',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'spaulding' },
    { level: 4, name: 'Doorway Stretch', nameRu: 'Растяжка в проёме',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'spaulding' },
    { level: 5, name: 'Hip Flexor Stretch', nameRu: 'Растяжка сгибателей бедра',
      benchmarkLadder: ['30s', '45s', '60s'], benchmarkRounds: 2, source: 'spaulding' },
    { level: 6, name: 'Thoracic Extension', nameRu: 'Экстензия грудного отдела',
      benchmarkLadder: ['30s', '60s', '90s'], source: 'spaulding' },
    { level: 7, name: 'Prone Press-Up', nameRu: 'Маккензи',
      benchmarkLadder: ['1x8', '2x10', '3x12'], source: 'spaulding' },
    { level: 8, name: 'Quadruped T-Spine', nameRu: 'Ротация в четвереньках',
      benchmarkLadder: ['1x5', '2x8', '3x10'], benchmarkRounds: 2, source: 'spaulding' },
    { level: 9, name: 'Standing Overhead Reach', nameRu: 'Вытяжение вверх стоя',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'spaulding' },
    { level: 10, name: 'Full Posture Flow', nameRu: 'Полный поток',
      benchmarkLadder: ['1x5', '2x5', '3x5'], source: 'spaulding' },
  ],
};

// ==================== Жиросжигание / HIIT (L1..L10) ====================

export const WEIGHTLOSS_HIIT: CatalogEntry = {
  key: 'weightloss-hiit',
  label: 'HIIT: базовые кардио',
  icuName: 'HIIT Basic',
  category: 'weightloss',
  levels: [
    { level: 1, name: 'Jumping Jacks', nameRu: 'Прыжки ноги-руки',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 2, name: 'High Knees', nameRu: 'Высокое колено',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 3, name: 'Mountain Climbers', nameRu: 'Альпинист',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 4, name: 'Bear Crawl', nameRu: 'Медвежья ходьба',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 5, name: 'Jump Squats', nameRu: 'Прыжковые приседания',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'acsm' },
    { level: 6, name: 'Shadow Boxing', nameRu: 'Бой с тенью',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 7, name: 'Jump Rope', nameRu: 'Скакалка',
      benchmarkLadder: ['60s', '90s', '120s'], source: 'acsm' },
    { level: 8, name: 'Tuck Jumps', nameRu: 'Прыжки с подтяжкой колен',
      benchmarkLadder: ['1x8', '2x10', '3x15'], source: 'acsm' },
    { level: 9, name: 'Burpees', nameRu: 'Бёрпи',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'acsm' },
    { level: 10, name: 'Burpee + Push-up', nameRu: 'Бёрпи с отжиманием',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'acsm' },
  ],
};

export const WEIGHTLOSS_BODYWEIGHT: CatalogEntry = {
  key: 'weightloss-bw',
  label: 'HIIT: силовое тело',
  icuName: 'HIIT Strength',
  category: 'weightloss',
  levels: [
    { level: 1, name: 'Bodyweight Squat', nameRu: 'Присед без веса',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'acsm' },
    { level: 2, name: 'Reverse Lunge', nameRu: 'Выпад назад',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 3, name: 'Push-up', nameRu: 'Отжимания',
      benchmarkLadder: ['1x5', '2x10', '3x15'], source: 'acsm' },
    { level: 4, name: 'Glute Bridge', nameRu: 'Мостик',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'acsm' },
    { level: 5, name: 'Plank Hold', nameRu: 'Планка',
      benchmarkLadder: ['30s', '45s', '60s'], source: 'acsm' },
    { level: 6, name: 'Split Squat', nameRu: 'Выпад статический',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 7, name: 'Pike Push-up', nameRu: 'Отжимания уголком',
      benchmarkLadder: ['1x5', '2x8', '3x10'], source: 'acsm' },
    { level: 8, name: 'Single-Leg Glute Bridge', nameRu: 'Мостик на одной ноге',
      benchmarkLadder: ['1x10', '2x12', '3x15'], benchmarkRounds: 2, source: 'acsm' },
    { level: 9, name: 'Pistol Squat (neg)', nameRu: 'Пистолет, негатив',
      benchmarkLadder: ['1x3', '2x5', '3x5'], benchmarkRounds: 2, source: 'og2' },
    { level: 10, name: 'Full Body Circuit', nameRu: 'Полный круг',
      benchmarkLadder: ['1x10', '2x15', '3x20'], source: 'acsm' },
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
    icuName: 'A-Skip', aliases: ['Toe Up A-Skip'], hint: 'Носок на себя, активное бедро',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'b-skip', category: 'drill', label: 'B-Skip', nameRu: 'Б-скип',
    icuName: 'B-Skip', aliases: ['Snap Down B-Skip'], hint: 'Выброс прямой ноги',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'high-knees', category: 'drill', label: 'High Knees', nameRu: 'Высокое колено',
    icuName: 'High Knees', aliases: ['Fast High Knees'], hint: 'Максимальная частота',
    defaultDuration: '20mtr', defaultZone: 1 },
  { key: 'butt-kicks', category: 'drill', label: 'Butt Kicks', nameRu: 'Захлёст голени',
    icuName: 'Butt Kicks', aliases: ['Heel Butt Kicks'], hint: 'Пятка к ягодице',
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
    icuName: 'Straight Leg', aliases: ['Straight Leg Run'], hint: 'Бег на прямых ногах',
    defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'power-skips', category: 'drill', label: 'Power Skips', nameRu: 'Прыжки в шаге',
    icuName: 'Power Skips', hint: 'Прыжки в шаге',
    defaultDuration: '30mtr', defaultZone: 1 },
  { key: 'strides', category: 'drill', label: 'Strides', nameRu: 'Ускорения',
    icuName: 'Strides', hint: 'Ускорение расслабленно',
    defaultDuration: '100mtr', defaultZone: 5 },
  { key: 'acceleration', category: 'drill', label: 'Acceleration', nameRu: 'Разгон',
    icuName: 'Acceleration', aliases: ['Relaxed Acceleration'], hint: 'Разгон 0-95%',
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