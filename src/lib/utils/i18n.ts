/**
 * Translation utilities
 *
 * Helper functions for using translations throughout the app.
 * Uses next-intl for internationalization.
 */

import { useTranslations } from 'next-intl';

/**
 * Get translation function for a specific namespace in Client Components.
 *
 * Usage:
 *   const t = useT('earnings');
 *   return <h1>{t('title')}</h1>
 */
export function useT(namespace: string) {
  return useTranslations(namespace);
}

/**
 * Pluralization helper for Russian (3 forms: one/few/many)
 *
 * Russian has complex plural rules:
 * - 1, 21, 31, ... → one (1 запись)
 * - 2-4, 22-24, 32-34, ... → few (2 записи)
 * - 5-20, 25-30, 35-40, ... → many (5 записей)
 *
 * Usage:
 *   pluralRu(1, 'запись', 'записи', 'записей') → "запись"
 *   pluralRu(2, 'запись', 'записи', 'записей') → "записи"
 *   pluralRu(5, 'запись', 'записи', 'записей') → "записей"
 */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count);
  const n10 = n % 10;
  const n100 = n % 100;

  if (n10 === 1 && n100 !== 11) {
    return one;
  }
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
    return few;
  }
  return many;
}

/**
 * Format count with Russian pluralization.
 *
 * Usage:
 *   formatCount(1, 'велосипед', 'велосипеда', 'велосипедов') → "1 велосипед"
 *   formatCount(2, 'велосипед', 'велосипеда', 'велосипедов') → "2 велосипеда"
 *   formatCount(5, 'велосипед', 'велосипеда', 'велосипедов') → "5 велосипедов"
 */
export function formatCount(count: number, one: string, few: string, many: string): string {
  return `${count} ${pluralRu(count, one, few, many)}`;
}
