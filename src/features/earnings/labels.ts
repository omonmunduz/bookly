/**
 * EARNINGS LABELS
 *
 * Display strings for the earnings and deduction enums, in one place so the list,
 * detail, and form pages cannot drift from each other.
 *
 * Kept separate from schemas.ts because these are imported by Client Components;
 * the schema module pulls in Zod, which those pages have no reason to bundle.
 */

import type { DeductionType, EarningsStatus } from '@/lib/types/ebike';

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  rental: 'Аренда велосипеда',
  damage: 'Возмещение ущерба',
  equipment: 'Стоимость оборудования',
  other: 'Прочее',
};

export const EARNINGS_STATUS_LABELS: Record<EarningsStatus, string> = {
  draft: 'Черновик',
  approved: 'Утвержден',
  paid: 'Оплачен',
};

/** Badge variant per status. Paid is the settled, finished state. */
export const EARNINGS_STATUS_VARIANT: Record<
  EarningsStatus,
  'default' | 'secondary' | 'outline'
> = {
  draft: 'outline',
  approved: 'secondary',
  paid: 'default',
};
