/**
 * MAINTENANCE LABELS
 *
 * Display strings for the maintenance and inspection enums, in one place so the
 * list, detail, approvals, and form pages cannot drift from each other.
 *
 * Kept separate from schemas.ts because these are imported by Client Components;
 * the schema module pulls in Zod, which those pages have no reason to bundle.
 */

import type {
  MaintenanceType,
  InspectionCondition,
} from '@/lib/types/ebike';

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  repair: 'Repair',
  inspection: 'Inspection',
  replacement: 'Part replacement',
  cleaning: 'Cleaning',
  other: 'Other',
};

export const INSPECTION_CONDITION_LABELS: Record<InspectionCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
};

/**
 * Badge variant per condition, so a bike's state reads at a glance.
 *
 * 'fair' is deliberately neutral rather than a warning: it is a working bike, and
 * colouring it amber would make a normal fleet look like it needs attention.
 */
export const INSPECTION_CONDITION_VARIANT: Record<
  InspectionCondition,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  excellent: 'default',
  good: 'default',
  fair: 'secondary',
  poor: 'destructive',
  damaged: 'destructive',
};
