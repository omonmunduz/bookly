/**
 * EARNINGS SERVER ACTIONS
 *
 * The read/write surface for courier earnings periods and deductions. Client
 * components call these; they never import the repository or hold a Supabase
 * client.
 *
 * Every action here is manager-or-above: these are payout figures, and a mechanic
 * has no reason to see what couriers are paid. requireMinimumRole redirects rather
 * than returning an error, so a mechanic following a stale link lands on the
 * dashboard instead of a permission message.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { EarningsService } from '@/features/earnings/service';
import type {
  EarningsPeriod,
  CreateEarningsPeriodInput,
  UpdateEarningsPeriodInput,
  CreateDeductionInput,
  EarningsFilters,
  EarningsPeriodWithDeductions,
  EarningsSummary,
  Result,
} from '@/lib/types/ebike';

/**
 * Build a service bound to the caller's organization, after checking they are a
 * manager or admin.
 */
async function getService() {
  const user = await requireMinimumRole('manager');
  const supabase = await createClient();

  return {
    user,
    service: new EarningsService(supabase, user.organizationId),
  };
}

/** Message for an unexpected throw, so callers always get a readable string. */
function failure(error: unknown, fallback: string): Result<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

// ============================================================================
// EARNINGS PERIODS
// ============================================================================

/**
 * List earnings periods, newest first.
 */
export async function listEarningsPeriodsAction(
  filters?: EarningsFilters
): Promise<Result<EarningsPeriod[]>> {
  try {
    const { service } = await getService();
    return await service.list(filters);
  } catch (error) {
    return failure(error, 'Failed to list earnings periods');
  }
}

/**
 * Get a single earnings period by ID.
 */
export async function getEarningsPeriodAction(
  id: string
): Promise<Result<EarningsPeriod>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get earnings period');
  }
}

/**
 * Get an earnings period with its courier and deductions joined in.
 */
export async function getEarningsPeriodWithDeductionsAction(
  id: string
): Promise<Result<EarningsPeriodWithDeductions>> {
  try {
    const { service } = await getService();
    return await service.getWithDeductions(id);
  } catch (error) {
    return failure(error, 'Failed to get earnings period');
  }
}

/**
 * Create an earnings period for a courier.
 */
export async function createEarningsPeriodAction(
  input: CreateEarningsPeriodInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/earnings');
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create earnings period');
  }
}

/**
 * Update an earnings period. Dates are fixed once created; only the figure,
 * status, and notes can change.
 */
export async function updateEarningsPeriodAction(
  id: string,
  input: UpdateEarningsPeriodInput
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService();
    const result = await service.update(id, input);

    if (!result.success) {
      return result;
    }

    revalidatePath('/earnings');
    revalidatePath(`/earnings/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update earnings period');
  }
}

/**
 * Move a period between draft, approved, and paid.
 */
export async function updateEarningsPeriodStatusAction(
  id: string,
  status: EarningsPeriod['status']
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService();
    const result = await service.updateStatus(id, status);

    if (!result.success) {
      return result;
    }

    revalidatePath('/earnings');
    revalidatePath(`/earnings/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update earnings period status');
  }
}

/**
 * Soft-delete an earnings period.
 */
export async function deleteEarningsPeriodAction(
  id: string
): Promise<Result<void>> {
  try {
    const { service } = await getService();
    const result = await service.delete(id);

    if (result.success) {
      revalidatePath('/earnings');
      revalidatePath('/dashboard');
    }

    return result;
  } catch (error) {
    return failure(error, 'Failed to delete earnings period');
  }
}

// ============================================================================
// DEDUCTIONS
// ============================================================================

/**
 * Add a deduction to a draft period.
 */
export async function createDeductionAction(
  input: CreateDeductionInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.createDeduction(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/earnings');
    revalidatePath(`/earnings/${input.earnings_period_id}`);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to add deduction');
  }
}

/**
 * Remove a deduction from a draft period.
 */
export async function deleteDeductionAction(id: string): Promise<Result<void>> {
  try {
    const { service } = await getService();
    const result = await service.deleteDeduction(id);

    if (result.success) {
      revalidatePath('/earnings');
    }

    return result;
  } catch (error) {
    return failure(error, 'Failed to delete deduction');
  }
}

// ============================================================================
// SUMMARIES
// ============================================================================

/**
 * Totals across a date range.
 */
export async function getEarningsSummaryAction(
  startDate: Date,
  endDate: Date
): Promise<Result<EarningsSummary>> {
  try {
    const { service } = await getService();
    return await service.getSummaryForPeriod(startDate, endDate);
  } catch (error) {
    return failure(error, 'Failed to get earnings summary');
  }
}

/**
 * Period counts per status, for the dashboard.
 */
export async function getEarningsCountByStatusAction(): Promise<
  Result<Record<EarningsPeriod['status'], number>>
> {
  try {
    const { service } = await getService();
    return await service.countByStatus();
  } catch (error) {
    return failure(error, 'Failed to get earnings count by status');
  }
}
