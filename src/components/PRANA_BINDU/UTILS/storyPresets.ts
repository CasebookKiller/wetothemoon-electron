// src/components/PRANA_BINDU/UTILS/storyPresets.ts

export type StoryFormat = 'story' | 'portrait' | 'square' | 'landscape';

export type StoryPlatformId =
  | 'reels' | 'telegram' | 'vk' | 'max' | 'universal'
  | 'post-portrait' | 'post-square' | 'post-landscape';

export type LogoPosition = 'br' | 'bl' | 'tr' | 'tl';

export interface StoryPreset {
  id: StoryPlatformId;
  label: string;
  format: StoryFormat;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
  recommendedFormat: 'png' | 'jpg';
  hint?: string;
}

// Базовая высота, под которую спроектированы все layout'ы
export const REFERENCE_HEIGHT = 1920;
export const REFERENCE_WIDTH = 1080;

export const STORY_PRESETS: StoryPreset[] = [
  // ==================== СТОРИС (9:16) ====================
  {
    id: 'reels',
    label: 'Stories / Reels (IG)',
    format: 'story',
    width: 1080, height: 1920,
    safeTop: 250, safeBottom: 250, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
    hint: 'Базовая вертикаль 9:16.',
  },
  {
    id: 'telegram',
    label: 'Telegram (сторис)',
    format: 'story',
    width: 1080, height: 1920,
    safeTop: 180, safeBottom: 200, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
    hint: 'Сверху — аватар и имя, снизу — кнопка «Ещё».',
  },
  {
    id: 'vk',
    label: 'ВКонтакте (сторис)',
    format: 'story',
    width: 1080, height: 1920,
    safeTop: 160, safeBottom: 220, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'jpg',
    hint: 'JPG предпочтительнее — меньше вес файла.',
  },
  {
    id: 'max',
    label: 'MAX',
    format: 'story',
    width: 1080, height: 1920,
    safeTop: 160, safeBottom: 200, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
  },
  {
    id: 'universal',
    label: 'Универсальный 9:16',
    format: 'story',
    width: 1080, height: 1920,
    safeTop: 120, safeBottom: 160, safeLeft: 40, safeRight: 40,
    recommendedFormat: 'png',
  },

  // ==================== ПОСТЫ ====================
  {
    id: 'post-portrait',
    label: 'Пост 4:5 (IG / VK)',
    format: 'portrait',
    width: 1080, height: 1350,
    safeTop: 30, safeBottom: 30, safeLeft: 40, safeRight: 40,
    recommendedFormat: 'jpg',
    hint: 'Лента IG/VK, занимает максимум места. JPG.',
  },
  {
    id: 'post-square',
    label: 'Пост 1:1 (универсал)',
    format: 'square',
    width: 1080, height: 1080,
    safeTop: 30, safeBottom: 30, safeLeft: 135, safeRight: 135,
    recommendedFormat: 'jpg',
    hint: 'Квадрат. Видимая область IG-карусели ~810×1080 (safeLeft/Right=135).',
  },
  {
    id: 'post-landscape',
    label: 'Пост 1.91:1 (горизонт)',
    format: 'landscape',
    width: 1080, height: 566,
    safeTop: 20, safeBottom: 20, safeLeft: 40, safeRight: 40,
    recommendedFormat: 'jpg',
    hint: 'Горизонтальная карточка / превью ссылки.',
  },
];

export const getPreset = (id: StoryPlatformId): StoryPreset =>
  STORY_PRESETS.find((p) => p.id === id) ?? STORY_PRESETS[0];

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  br: 'Правый нижний',
  bl: 'Левый нижний',
  tr: 'Правый верхний',
  tl: 'Левый верхний',
};