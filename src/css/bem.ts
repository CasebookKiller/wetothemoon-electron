import { classNames, isRecord } from '@/css/classnames.js';

export interface BlockFn {
  (...mods: any): string;
}

export interface ElemFn {
  (elem: string, ...mods: any): string;
}

/**
 * Применяет изменения к указанному элементу.
 * @param element - наименование элемента.
 * @param mod - мод для применения.
 */
function applyMods(element: string, mod: any): string {
  if (Array.isArray(mod)) {
    return classNames(mod.map(m => applyMods(element, m)));
  }
  if (isRecord(mod)) {
    return classNames(
      Object.entries(mod).map(([mod, v]) => v && applyMods(element, mod)),
    );
  }
  const v = classNames(mod);
  return v && `${element}--${v}`;
}

/**
 * Вычисляет окончательное имя класса для указанного элемента.
 * @param element - наименованиеэлемента.
 * @param mods - мод для применения.
 */
function computeClassnames(element: string, ...mods: any): string {
  return classNames(element, applyMods(element, mods));
}

/**
 * @returns Кортеж, содержащий две функции. Первая генерирует список имен классов для блока,
 * вторая генерирует имена классов для его элементов.
 * @param block - Имя блока BEM.
 */
export function bem(block: string): [BlockFn, ElemFn] {
  return [
    (...mods) => computeClassnames(block, mods),
    (elem, ...mods) => computeClassnames(`${block}__${elem}`, mods),
  ];
}