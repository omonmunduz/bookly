/**
 * ASSIGNMENT DURATION MATH
 *
 * Pure helpers, no Supabase client and no Zod, so Server Components and the
 * service layer can share one definition of "when is this bike due back".
 *
 * An assignment stores its plan's duration as a value plus a unit rather than a
 * day count, because that is what the courier was quoted. Everything downstream
 * — the due date, the overdue badge — is derived from that snapshot, so editing
 * the plan later never moves a past assignment's deadline.
 */

import type { BikeAssignment } from '@/lib/types/ebike';

const DAYS_PER_UNIT = {
  days: 1,
  weeks: 7,
  // Approximate. Rental plans are quoted in whole months, and couriers are
  // charged per plan rather than per day, so the drift never reaches billing.
  months: 30,
} as const;

/** The plan's duration expressed in days. */
export function durationInDays(assignment: BikeAssignment): number {
  return (
    assignment.plan_duration_value *
    DAYS_PER_UNIT[assignment.plan_duration_unit]
  );
}

/** When the bike is due back, derived from the assignment's own snapshot. */
export function expectedReturnDate(assignment: BikeAssignment): Date {
  const dueDate = new Date(assignment.assigned_at);
  dueDate.setDate(dueDate.getDate() + durationInDays(assignment));
  return dueDate;
}

/** A returned bike is never overdue, however late it was. */
export function isOverdue(assignment: BikeAssignment, now: Date = new Date()) {
  if (assignment.returned_at) {
    return false;
  }
  return now > expectedReturnDate(assignment);
}

/** Whole days past due, or 0 when the assignment is not overdue. */
export function daysOverdue(
  assignment: BikeAssignment,
  now: Date = new Date()
): number {
  if (!isOverdue(assignment, now)) {
    return 0;
  }
  const elapsed = now.getTime() - expectedReturnDate(assignment).getTime();
  return Math.ceil(elapsed / (1000 * 60 * 60 * 24));
}

/**
 * How long the bike has actually been out: to the return date if it is back,
 * otherwise to now.
 */
export function daysHeld(
  assignment: BikeAssignment,
  now: Date = new Date()
): number {
  const end = assignment.returned_at ? new Date(assignment.returned_at) : now;
  const elapsed = end.getTime() - new Date(assignment.assigned_at).getTime();
  return Math.floor(elapsed / (1000 * 60 * 60 * 24));
}

/** Human label for a plan's terms, e.g. "1 month" or "7 days". */
export function formatPlanDuration(assignment: BikeAssignment): string {
  const { plan_duration_value: value, plan_duration_unit: unit } = assignment;
  const singular = unit.slice(0, -1);
  return `${value} ${value === 1 ? singular : unit}`;
}
