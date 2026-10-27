// src/components/PRANA_BINDU/UTILS/storyPresets.ts

export type StoryPlatformId = 'reels' | 'telegram' | 'vk' | 'max' | 'universal';
export type LogoPosition = 'br' | 'bl' | 'tr' | 'tl';

export interface StoryPreset {
  id: StoryPlatformId;
  label: string;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
  recommendedFormat: 'png' | 'jpg';
  hint?: string;
}

export const STORY_PRESETS: StoryPreset[] = [
  {
    id: 'reels',
    label: 'Reels / Instagram',
    width: 1080, height: 1920,
    safeTop: 250, safeBottom: 250, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
    hint: 'Базовая вертикаль 9:16.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    width: 1080, height: 1920,
    safeTop: 180, safeBottom: 200, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
    hint: 'Сверху — аватар и имя, снизу — кнопка «Ещё».',
  },
  {
    id: 'vk',
    label: 'ВКонтакте',
    width: 1080, height: 1920,
    safeTop: 160, safeBottom: 220, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'jpg',
    hint: 'JPG предпочтительнее — меньше вес файла.',
  },
  {
    id: 'max',
    label: 'MAX',
    width: 1080, height: 1920,
    safeTop: 160, safeBottom: 200, safeLeft: 60, safeRight: 60,
    recommendedFormat: 'png',
  },
  {
    id: 'universal',
    label: 'Универсальный 9:16',
    width: 1080, height: 1920,
    safeTop: 120, safeBottom: 160, safeLeft: 40, safeRight: 40,
    recommendedFormat: 'png',
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