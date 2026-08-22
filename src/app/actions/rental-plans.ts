/**
 * RENTAL PLAN SERVER ACTIONS
 *
 * The read/write surface for rental plans — the price and duration options a bike
 * can be assigned under. Client components call these; they never import the
 * repository or hold a Supabase client.
 *
 * Reads are open to any active user; writes are manager-or-above, since a plan
 * determines what couriers are charged.
 *
 * Editing a plan is safe by design: assignments snapshot the price and duration
 * they were created with, so a change here never rewrites history.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser, requireMinimumRole } from '@/features/auth/guards';
import { RentalPlansService } from '@/features/rental-plans/service';
import type {
  RentalPlan,
  CreateRentalPlanInput,
  UpdateRentalPlanInput,
  Result,
} from '@/lib/types/ebike';

/**
 * Build a service bound to the caller's organization.
 *
 * Pass a minimum role for writes; omit it for reads, which any active user may
 * perform. requireMinimumRole redirects rather than returning an error, so a
 * mechanic following a stale link lands on the dashboard.
 */
async function getService(minimumRole?: 'admin' | 'manager') {
  const user = minimumRole
    ? await requireMinimumRole(minimumRole)
    : await requireActiveUser();
  const supabase = await createClient();

  return {
    user,
    service: new RentalPlansService(supabase, user.organizationId),
  };
}

/** Message for an unexpected throw, so callers always get a readable string. */
function failure(error: unknown, fallback: string): Result<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

/** Paths that show plan data and must be refreshed after any write. */
function revalidatePlanPaths(id?: string) {
  revalidatePath('/rental-plans');
  if (id) {
    revalidatePath(`/rental-plans/${id}`);
  }
  // The assignment form lists active plans in its picker.
  revalidatePath('/assignments/new');
}

// ============================================================================
// READS
// ============================================================================

/**
 * List rental plans, optionally limited to active ones.
 */
export async function listRentalPlansAction(
  activeOnly: boolean = false
): Promise<Result<RentalPlan[]>> {
  try {
    const { service } = await getService();
    return await service.list(activeOnly);
  } catch (error) {
    return failure(error, 'Failed to list rental plans');
  }
}

/**
 * Active plans only. For the assignment form's plan picker.
 */
export async function getActiveRentalPlansAction(): Promise<
  Result<RentalPlan[]>
> {
  try {
    const { service } = await getService();
    return await service.getActive();
  } catch (error) {
    return failure(error, 'Failed to get active rental plans');
  }
}

/**
 * Get a single rental plan by ID.
 */
export async function getRentalPlanAction(
  id: string
): Promise<Result<RentalPlan>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get rental plan');
  }
}

// ============================================================================
// WRITES
// ============================================================================

/**
 * Create a rental plan.
 */
export async function createRentalPlanAction(
  input: CreateRentalPlanInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService('manager');
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePlanPaths();

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create rental plan');
  }
}

/**
 * Update a rental plan. Existing assignments keep their snapshotted terms.
 */
export async function updateRentalPlanAction(
  id: string,
  input: UpdateRentalPlanInput
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.update(id, input);

    if (!result.success) {
      return result;
    }

    revalidatePlanPaths(id);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update rental plan');
  }
}

/**
 * Activate or retire a plan. Retiring hides it from new assignments without
 * touching the ones already using it.
 */
export async function setRentalPlanActiveAction(
  id: string,
  isActive: boolean
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.setActive(id, isActive);

    if (!result.success) {
      return result;
    }

    revalidatePlanPaths(id);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update rental plan status');
  }
}

/**
 * Soft-delete a rental plan.
 */
export async function deleteRentalPlanAction(
  id: string
): Promise<Result<void>> {
  try {
    const { service } = await getService('manager');
    const result = await service.delete(id);

    if (result.success) {
      revalidatePlanPaths();
    }

    return result;
  } catch (error) {
    return failure(error, 'Failed to delete rental plan');
  }
}
