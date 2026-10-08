// src/main/services/pranaBindu/mentat/prehabPrograms.ts
//
// Профилактические программы: стопы, ахилл, колени, спина.
// Направлены на предупреждение травм, а не на развитие силы.
// Все упражнения — named, без уровней.

import type { ProgramSpec } from './types';

export const PREHAB_PROGRAMS: ProgramSpec[] = [
  // ==================== Feet & Calf ====================
  {
    key: 'prehab-feet',
    category: 'prehab',
    name: 'Feet & Calf',
    nameRu: 'Стопы и голень',
    description:
      'Профилактика болей в стопах и ахилле. Укрепление голени, ' +
      'свода стопы, мелкой моторики пальцев, эксцентрика на ахилл.',
    usage:
      '3 раза в неделю после лёгкого бега. Медленно, с фокусом на ' +
      'качество, а не на объём. Никогда не через боль.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Feet',
        movementKeys: [
          'tibialis-raises',
          'short-foot',
          'toe-yoga',
          'eccentric-heel-drop',
          'sl-hops-l',
          'sl-hops-r',
        ],
      },
    ],
  },

  // ==================== Knees ====================
  {
    key: 'prehab-knees',
    category: 'prehab',
    name: 'Knees',
    nameRu: 'Колени',
    description:
      'Стабилизация колена: VMO, ягодичные, контроль при спуске. ' +
      'Профилактика беговых коленных болей.',
    usage:
      '3 раза в неделю (не в дни длинных пробежек). Медленный ' +
      'контроль, без резких движений.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Knees',
        movementKeys: [
          'terminal-knee-extension',
          'clamshells',
          'wall-sit',
          'step-downs',
          'calfraise',
        ],
      },
    ],
  },

  // ==================== Back ====================
  {
    key: 'prehab-back',
    category: 'prehab',
    name: 'Back',
    nameRu: 'Спина',
    description:
      'Мобильность позвоночника, укрепление разгибателей, ' +
      'компенсация сидячей работы.',
    usage:
      '3 раза в неделю. Спокойно, с фокусом на дыхание и качество ' +
      'движения, не на скорость.',
    weeklySchedule: [null, 0, null, 0, null, 0, null],
    days: [
      {
        label: 'Back',
        movementKeys: [
          'cat-cow',
          'bird-dog',
          'superman-hold',
          'hip-flexor-stretch',
          'plank',
        ],
      },
    ],
  },

  // ==================== All ====================
  {
    key: 'prehab-all',
    category: 'prehab',
    name: 'Full Prehab',
    nameRu: 'Полный прехаб',
    description:
      'Один длинный блок: спина, стопы, колени. Для дней отдыха ' +
      'или восстановительных дней.',
    usage:
      '2 раза в неделю, длинная сессия. По 30 секунд на упражнение, ' +
      'без спешки.',
    weeklySchedule: [null, 0, null, null, 0, null, null],
    days: [
      {
        label: 'Full',
        movementKeys: [
          'cat-cow',
          'tibialis-raises',
          'short-foot',
          'eccentric-heel-drop',
          'clamshells',
          'terminal-knee-extension',
          'superman-hold',
        ],
      },
    ],
  },

    // ==================== Mobility ====================
  {
    key: 'prehab-mobility',
    category: 'prehab',
    name: 'Mobility',
    nameRu: 'Мобильность',
    description:
      'Раскрытие тазобедренных суставов и позвоночника. Растяжки ' +
      'для поддержания амплитуды, особенно при сидячей работе.',
    usage:
      'Ежедневно или через день, 10–15 минут. По 30 секунд на ' +
      'упражнение. Не через боль, спокойное дыхание.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Mobility',
        movementKeys: [
          'pigeon',
          'butterfly',
          'pancake',
          'frog-stretch',
          'spiderman-stretch',
          'spiderman-stretch-rotation',
          'seated-forward-bend',
        ],
      },
    ],
  },

  // ==================== Shoulders & Spine ====================
  {
    key: 'prehab-shoulders',
    category: 'prehab',
    name: 'Shoulders & Spine',
    nameRu: 'Плечи и осанка',
    description:
      'Компенсация сидячей работы: раскрытие грудного отдела, ' +
      'мобильность плеч, укрепление задней дельты и лопаточных мышц.',
    usage:
      '3 раза в неделю. Медленный контроль, без резких движений. ' +
      'Хорошо ставится перед силовой тренировкой как разогрев.',
    weeklySchedule: [null, 0, null, 0, null, 0, null],
    days: [
      {
        label: 'Shoulders',
        movementKeys: [
          'thoracic-rotation',
          'band-pull-apart',
          'wall-slide',
          'sleeper-stretch',
          'cat-cow',
        ],
      },
    ],
  },
  
];