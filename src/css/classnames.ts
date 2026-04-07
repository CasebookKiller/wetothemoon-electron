export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Функция, которая соединяет переданные значения с пробелом в соответствии со следующими правилами:
 * 1. Если значение является непустой строкой, оно будет добавлено в выходные данные.
 * 2. Если значением является object, то будут добавлены только те ключи, значения которых являются истинными.
 * 3. Если значение равно array, то classNames будут вызываться с учетом этого разброса значений.
 * 4. Все остальные значения игнорируются.
 *
 * Вы можете найти эту функцию, аналогичной той, что есть в пакете {@link https://www.npmjs.com/package/classnames|classnames}.
 * @param values - массив значений.
 * @returns Окончательные имена классов.
 */
export function classNames(...values: any[]): string {
  return values
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      if (isRecord(value)) {
        return classNames(Object.entries(value).map((entry) => entry[1] && entry[0]));
      }

      if (Array.isArray(value)) {
        return classNames(...value);
      }
    })
    .filter(Boolean)
    .join(' ');
}

type UnionStringKeys<U> = U extends U
  ? { [K in keyof U]-?: U[K] extends string | undefined ? K : never }[keyof U]
  : never;

type UnionRequiredKeys<U> = U extends U
  ? { [K in UnionStringKeys<U>]: (object extends Pick<U, K> ? never : K) }[UnionStringKeys<U>]
  : never;

type UnionOptionalKeys<U> = Exclude<UnionStringKeys<U>, UnionRequiredKeys<U>>;

export type MergeClassNames<Tuple extends any[]> =
// Удаляет из union все типы, которые будут игнорироваться функцией mergeClassNames.
  Exclude<Tuple[number], number | string | null | undefined | any[] | boolean> extends infer Union
    ?
    & { [K in UnionRequiredKeys<Union>]: string; }
    & { [K in UnionOptionalKeys<Union>]?: string; }
    : never;

/**
 * Объединяет два набора имен классов.
 *
 * Функция ожидает передачи массива объектов со значениями, которые могут быть переданы в
 * функцию `classNames`.
 * @returns Объект, содержащий ключи от всех объектов с объединенными значениями.
 * @see classNames
 */
export function mergeClassNames<T extends any[]>(...partials: T): MergeClassNames<T> {
  return partials.reduce<MergeClassNames<T>>((acc, partial) => {
    if (isRecord(partial)) {
      Object.entries(partial).forEach(([key, value]) => {
        const className = classNames((acc as any)[key], value);
        if (className) {
          (acc as any)[key] = className;
        }
      });
    }
    return acc;
  }, {} as MergeClassNames<T>);
}