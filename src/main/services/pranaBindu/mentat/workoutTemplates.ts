// src/main/services/pranaBindu/mentat/workoutTemplates.ts
//
// Библиотека шаблонов тренировок для конструктора Intervals.icu.
//
// Синтаксис ICU (проверено):
//   - m = минуты, s = секунды, h = часы, mtr = метры, km
//   - cue-текст ставится ПЕРЕД длительностью (это подпись на часах)
//   - секции Warmup / Main Set / Cooldown — на отдельной строке
//   - повторы: "Nx" на отдельной строке, пустые строки до и после
//   - вложенные повторы НЕ поддерживаются
//   - RPE НЕ поддерживается; цели — % HR, Z1..Z7, Pace, freeride
//   - каждый шаг обязан иметь длительность и цель (иначе блок невидим)
//   - cue-текст на часах — английский (кириллица работает, но неудобна)

export type TemplateCategory =
  | 'run-easy'
  | 'run-long'
  | 'run-tempo'
  | 'run-intervals'
  | 'run-fartlek'
  | 'run-drills'
  | 'strength-big6'     // Wade Big-6 (по канону — пока без шаблонов)
  | 'strength-runner'
  | 'circuit'           // Круговые сборные комплексы (калистеника)
  | 'warmup';

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  'run-easy': 'Лёгкий / восстановительный',
  'run-long': 'Длительный',
  'run-tempo': 'Темповый / пороговый',
  'run-intervals': 'Интервалы / VO2max',
  'run-fartlek': 'Фартлек / прогрессивный',
  'run-drills': 'СБУ (беговые)',
  'strength-big6': 'Big-6 (Пол Уэйд)',
  'strength-runner': 'Силовая для бегунов',
  'circuit': 'Круговые (калистеника)',
  'warmup': 'Разминка / заминка',
};

export interface WorkoutTemplate {
  id: string;
  category: TemplateCategory;
  name: string;
  description?: string;
  usage?: string;
  text: string;
  verified?: boolean;
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // ============ Лёгкий / восстановительный ============

  {
    id: 'easy-recovery-60',
    category: 'run-easy',
    name: 'Recovery Run 60 min',
    description: 'Набрать объём, не закисляясь.',
    usage: `Вся тренировка — один блок на 60 минут. HR — зона 1 (легко), Pace — зона 2.
Замени Z1/Z2 на конкретный темп (например, 8:00/km), если не настроены зоны.`,
    text: `Recovery Run
- 60m Z1 HR`,
    verified: true,
  },
  {
    id: 'easy-run-60',
    category: 'run-easy',
    name: 'Easy Run 60 min',
    description: 'Лёгкий аэробный бег.',
    usage: `Один блок 60 минут. Пульс и темп — зона 2. Обычная аэробная работа.`,
    text: `Easy Run
- 60m Z2 HR`,
    verified: true,
  },

  // ============ Длительный ============

  {
    id: 'long-1h30',
    category: 'run-long',
    name: 'Long Run 1h30m',
    description: 'Выносливость по времени.',
    usage: `Один блок 1 час 30 минут. Ровный аэробный бег в Z2.`,
    text: `Long Run
- 1h30m Z2 HR`,
    verified: true,
  },
  {
    id: 'long-20km',
    category: 'run-long',
    name: 'Long Run 20 km',
    description: 'Выносливость по дистанции.',
    usage: `Один блок 20 километров. Цель по темпу — Z2.`,
    text: `Long Run
- 20km Z2 Pace`,
    verified: true,
  },

  // ============ Темповый / пороговый ============

  {
    id: 'tempo-20',
    category: 'run-tempo',
    name: 'Tempo Run 20 min',
    description: 'Повышение лактатного порога.',
    usage: `Три секции: Warmup, Main Set (20 минут на пороге), Cooldown.
Z4 Pace — пороговый темп (комфортно тяжело).`,
    text: `Tempo Run
Warmup
- 2km Z2 Pace

Main Set
- 20m Z4 Pace

Cooldown
- 2km Z2 Pace`,
    verified: true,
  },

  // ============ Интервалы ============

  {
    id: 'vo2max-10x400',
    category: 'run-intervals',
    name: 'VO2max 10x400m',
    description: 'Развитие максимального потребления кислорода.',
    usage: `Main Set 10x — весь блок ниже повторится 10 раз.
Cue «Fast» и «Recovery» — подсказки, которые появятся на часах.`,
    text: `VO2max Intervals
Warmup
- 2km Z2 Pace

Main Set 10x
- Fast 400mtr Z5 Pace
- Recovery 400mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
    verified: true,
  },
  {
    id: 'intervals-5x1000',
    category: 'run-intervals',
    name: 'Intervals 5x1000m',
    description: 'Классика — быстрые километры с восстановлением.',
    usage: `Main Set 5x — пять повторов блока ниже. Внутри — быстрый километр + 400 м восстановления.`,
    text: `Intervals
Warmup
- 2km Z2 Pace

Main Set 5x
- Fast 1km Z5 Pace
- Recovery 400mtr Z1 Pace

Cooldown
- 2km Z2 Pace`,
    verified: false,
  },

  // ============ Фартлек / прогрессивный ============

  {
    id: 'fartlek-classic',
    category: 'run-fartlek',
    name: 'Fartlek',
    description: 'Игра со скоростью, смена темпа.',
    usage: `Открывающие 10 минут лёгкого бега, затем серия разной интенсивности, 5 быстрых спринтов с отдыхом, закрывающие 10 минут Z2.
Пустая строка между блоками обязательна — иначе ICU не распознает повторы.`,
    text: `Fartlek
- 10m Z2 Pace
- 2m Z4 Pace
- 3m Z2 Pace
- 1m Z5 Pace
- 4m Z2 Pace

5x
- Sprint 30s Z5 Pace
- Recovery 90s Z2 Pace

- 10m Z2 Pace`,
    verified: true,
  },
  {
    id: 'progression-negative',
    category: 'run-fartlek',
    name: 'Progression Run',
    description: 'Финишировать быстрее, чем начали.',
    usage: `Три блока с растущей интенсивностью: 30 мин в Z2, 20 мин в Z3, 10 мин в Z4.`,
    text: `Progression Run
- 30m Z2 Pace
- 20m Z3 Pace
- 10m Z4 Pace`,
    verified: true,
  },

  // ============ СБУ ============

  {
    id: 'drills-base-20m',
    category: 'run-drills',
    name: 'Drills: Base Set (20mtr)',
    description: 'Техника и частота. Ставить в разминку перед основной.',
    usage: `mtr — это метры (не минуты!). Каждое упражнение 20 метров.
Z1 Pace — цель, чтобы блоки отрисовались и часы вибрировали.
Cue-текст (A-Skip, High Knees) — надпись на часах.`,
    text: `Drills Base Set
- Toe Up A-Skip 20mtr Z1 Pace
- Snap Down B-Skip 20mtr Z1 Pace
- Fast High Knees 20mtr Z1 Pace
- Heel Butt Kicks 20mtr Z1 Pace
- Carioca L 20mtr Z1 Pace
- Carioca R 20mtr Z1 Pace
- Recovery Jog 200mtr Z1 Pace`,
    verified: true,
  },
  {
    id: 'drills-power-30m',
    category: 'run-drills',
    name: 'Drills: Power (30mtr)',
    description: 'Сила отталкивания, многоскоки.',
    usage: `Акцент на мощное отталкивание. Каждое упражнение 30 метров.
После серии — 200 метров трусцы.`,
    text: `Drills Power
- Bounding 30mtr Z1 Pace
- Straight Leg Run 30mtr Z1 Pace
- Power Skips 30mtr Z1 Pace
- Recovery Jog 200mtr Z1 Pace`,
    verified: true,
  },
  {
    id: 'drills-coordination-20m',
    category: 'run-drills',
    name: 'Drills: Coordination (20mtr)',
    description: 'Баланс и координация.',
    usage: `Упражнения на координацию, короткие отрезки по 20 метров.`,
    text: `Drills Coordination
- Ankling 20mtr Z1 Pace
- Lateral Shuffle L 20mtr Z1 Pace
- Lateral Shuffle R 20mtr Z1 Pace
- Backward Run 20mtr Z1 Pace
- Recovery Jog 200mtr Z1 Pace`,
    verified: true,
  },
  {
    id: 'drills-bounding',
    category: 'run-drills',
    name: 'Drills: Bounding (4x)',
    description: 'Многоскоки — 4 повтора.',
    usage: `4x — весь блок ниже повторится 4 раза.
Пустая строка до и после 4x обязательна.`,
    text: `Drills Bounding

4x
- Bounding 40mtr Z1 Pace
- Recovery Jog 40mtr Z1 Pace`,
    verified: true,
  },
  {
    id: 'drills-strides',
    category: 'run-drills',
    name: 'Drills: Strides (6x100m)',
    description: 'Переход к соревновательному темпу.',
    usage: `6 повторов: ускорение 100 метров, затем 100 метров пешком назад.
Обычно ставится в конце лёгкой тренировки, чтобы «разбудить» быстрые мышцы.`,
    text: `Strides

6x
- Relaxed Acceleration 100mtr Z5 Pace
- Walk Back 100mtr Z1 Pace`,
    verified: true,
  },
  {
    id: 'drills-full-complex',
    category: 'run-drills',
    name: 'Drills: Full Complex',
    description: 'Полный комплекс СБУ: 6 упражнений, 4 повтора.',
    usage: `Классическая последовательность из 6 беговых упражнений по 50 метров. 4 повтора с возвратом трусцой.`,
    text: `Drills Full Complex
Warmup
- 2km Z2 Pace

Drill Set 4x
- Toe Up A-Skip 50mtr Z1 Pace
- Snap Down B-Skip 50mtr Z1 Pace
- Fast High Knees 50mtr Z1 Pace
- Heel Butt Kicks 50mtr Z1 Pace
- Carioca 50mtr Z1 Pace
- Acceleration 50mtr Z5 Pace
- Recovery Jog 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
    verified: true,
  },

  // ================= Circuit ================

  {
    id: 'circuit-a',
    category: 'circuit',
    name: 'Circuit A (Basics)',
    description: 'Статика и малая амплитуда. Для начинающих.',
    usage: `Для силовых цели по пульсу не ставим — ICU их не поддерживает.
Каждое упражнение — по времени. Название становится подсказкой на часах.
Level 1 — облегчённые вариации (у стены, с опорой).`,
    text: `Circuit A
- Wall Push-ups 30s Z2 Pace
- Rest 20s Z1 Pace
- Wall Sit 20s Z2 Pace
- Rest 20s Z1 Pace
- Dead Hang 30s Z2 Pace
- Rest 20s Z1 Pace
- Knee Tucks 20s Z2 Pace
- Rest 20s Z1 Pace
- Bridge 20s Z2 Pace
- Rest 20s Z1 Pace
- Bench Dips 30s Z2 Pace
- Rest 20s Z1 Pace`,
    verified: true,
  },
  {
    id: 'circuit-b',
    category: 'circuit',
    name: 'Circuit B (Classic)',
    description: 'Классика — базовые движения. 6 упражнений с отдыхом между ними.',
    usage: `Упражнения Z2 Pace (обычная работа), отдых Z1 Pace (легко) — на таймлайне чередование видно цветом.
Каждое упражнение — максимум повторов за отведённое время.
Между упражнениями отдых 30 секунд.`,
    text: `Circuit B
3x
- Push-ups 30s Z2 Pace
- Rest 30s Z1 Pace
- Squats 45s Z2 Pace
- Rest 30s Z1 Pace
- Pull-ups 20s Z2 Pace
- Rest 30s Z1 Pace
- Leg Raises 30s Z2 Pace
- Rest 30s Z1 Pace
- Bridge 30s Z2 Pace
- Rest 30s Z1 Pace
- Dips 20s Z2 Pace
- Rest 30s Z1 Pace`,
    verified: true,
  },
  {
    id: 'circuit-c',
    category: 'circuit',
    name: 'Circuit C (Advanced)',
    description: 'Сложные вариации — пистолетики, алмазные, негативы.',
    usage: `Сложные упражнения — Z3 Pace (нагрузка выше), отдых — Z1 Pace.
Full Bridge здесь обычное упражнение, поэтому Z2.`,
    text: `Circuit C
3x
- Diamond Push-ups 30s Z3 Pace
- Rest 30s Z1 Pace
- Pistol Squats L 20s Z3 Pace
- Rest 30s Z1 Pace
- Pistol Squats R 20s Z3 Pace
- Rest 30s Z1 Pace
- Wide Pull-ups 20s Z3 Pace
- Rest 30s Z1 Pace
- Hanging Leg Raises 30s Z3 Pace
- Rest 30s Z1 Pace
- Full Bridge 30s Z2 Pace
- Rest 30s Z1 Pace`,
    verified:true,
  },
  {
    id: 'circuit-3x',
    category: 'circuit',
    name: 'Circuit 3x',
    description: 'Круговая для бегунов: 3 круга, короткий отдых между упражнениями и длинный — между кругами.',
    usage: `3x — 3 круга.
Внутри круга: работа Z2, короткий отдых Z1 (20 сек).
Между кругами — 60 сек Z1.
На таймлайне видно 3 цветных цикла.`,
    text: `Circuit 3x

3x
- Push-ups 30s Z2 Pace
- Rest 20s Z1 Pace
- Squats 30s Z2 Pace
- Rest 20s Z1 Pace
- Pull-ups 30s Z2 Pace
- Rest 20s Z1 Pace
- Leg Raises 30s Z2 Pace
- Rest 20s Z1 Pace
- Back Bridge 20s Z2 Pace
- Rest 20s Z1 Pace
- Dips 30s Z2 Pace
- Rest 60s Z1 Pace`,
    verified: true,
  },
  {
    id: 'circuit-technique',
    category: 'circuit',
    name: 'Circuit: Technique',
    description: 'Акцент на технику, медленное выполнение.',
    usage: `Не круговая, а последовательная работа над техникой. Каждое упражнение — медленно, подконтрольно.
Без повторов — один проход по всем шести движениям.`,
    text: `Circuit: Technique
- Slow Push-ups 40s Z1 Pace
- Rest 20s
- Deep Squats 30s Z1 Pace
- Rest 20s
- Negative Pull-ups 30s Z1 Pace
- Rest 20s
- Slow Leg Raises 30s Z1 Pace
- Rest 20s
- Full Bridge 30s Z1 Pace
- Rest 20s
- Controlled Dips 30s Z1 Pace`,
    verified: true,
  },

  // ============ Силовая для бегунов ============

  {
    id: 'runner-core-activation',
    category: 'strength-runner',
    name: 'Runner Core Activation',
    description: 'Разогрев кора перед тренировкой.',
    usage: `5 упражнений по 30 секунд. Ставится перед лёгким бегом как активация.`,
    text: `Runner Core Activation
- Dead Bug 30s Z1 Pace
- Rest 20s
- Side Plank L 30s Z1 Pace
- Rest 20s
- Side Plank R 30s Z1 Pace
- Rest 20s
- Bird Dog 30s Z1 Pace
- Rest 20s
- Hollow Body Hold 30s Z1 Pace`,
    verified: true,
  },
  {
    id: 'runner-leg-strength',
    category: 'strength-runner',
    name: 'Runner Leg Strength',
    description: 'Укрепление ног и стоп после бега. 3 круга.',
    usage: `3x — 3 круга по 6 упражнений.
Работа Z2, короткий отдых Z1 (15 сек), между кругами 60 сек.
L / R — левая и правая нога, cue на часах.`,
    text: `Runner Leg Strength

3x
- Single Leg Glute Bridge L 30s Z2 Pace
- Rest 15s Z1 Pace
- Single Leg Glute Bridge R 30s Z2 Pace
- Rest 15s Z1 Pace
- Calf Raises 40s Z2 Pace
- Rest 15s Z1 Pace
- Bulgarian Split Squats L 30s Z2 Pace
- Rest 15s Z1 Pace
- Bulgarian Split Squats R 30s Z2 Pace
- Rest 15s Z1 Pace
- Tibialis Raises 40s Z2 Pace
- Rest 60s Z1 Pace`,
    verified: true,
  },
  {
    id: 'runner-plyometrics',
    category: 'strength-runner',
    name: 'Runner Plyometrics',
    description: 'Взрывные прыжковые упражнения. 3 круга.',
    usage: `3x — 3 круга.
Прыжки — Z3 (взрывная нагрузка), отдых — Z1.
Осторожно с коленями и ахиллом.`,
    text: `Runner Plyometrics

3x
- Jump Squats 30s Z3 Pace
- Rest 20s Z1 Pace
- Lunge Jumps 30s Z3 Pace
- Rest 20s Z1 Pace
- Broad Jumps 30s Z3 Pace
- Rest 20s Z1 Pace
- Skater Hops 30s Z3 Pace
- Rest 60s Z1 Pace`,
    verified: true,
  },
  {
    id: 'runner-stability',
    category: 'strength-runner',
    name: 'Runner Stability Circuit',
    description: 'Стабильность и баланс. 3 круга.',
    usage: `3x — 3 круга по 5 упражнений.
Работа Z2 (контролируемая), отдых Z1.
Все упражнения на баланс — медленно, без рывков.`,
    text: `Runner Stability

3x
- Single Leg RDL L 30s Z2 Pace
- Rest 15s Z1 Pace
- Single Leg RDL R 30s Z2 Pace
- Rest 15s Z1 Pace
- Fire Hydrants L 30s Z2 Pace
- Rest 15s Z1 Pace
- Fire Hydrants R 30s Z2 Pace
- Rest 15s Z1 Pace
- Wall Sit 40s Z2 Pace
- Rest 60s Z1 Pace`,
    verified: true,
  },

  // ============ Разминка ============

  {
    id: 'warmup-dynamic',
    category: 'warmup',
    name: 'Dynamic Warm-up',
    description: 'Активация мышц и подготовка к нагрузке.',
    usage: `6 упражнений по 30 секунд. Ставится перед основной частью беговой тренировки.`,
    text: `Dynamic Warm-up
- Jumping Jacks 30s Z1 Pace
- Rest 20s
- High Knees 30s Z1 Pace
- Rest 20s
- Butt Kicks 30s Z1 Pace
- Rest 20s
- Walking Lunges 30s Z1 Pace
- Rest 20s
- Inchworms 30s Z1 Pace
- Rest 20s
- Arm Circles 30s Z1 Pace`,
    verified: true,
  },
];