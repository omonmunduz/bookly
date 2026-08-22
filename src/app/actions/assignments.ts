/**
 * ASSIGNMENT SERVER ACTIONS
 *
 * The read/write surface for bike assignments — the record of which courier has
 * which bike, under which rental plan. Client components call these; they never
 * import the repository or hold a Supabase client.
 *
 * Reads are open to any active user. Creating an assignment is manager-or-above,
 * since it commits a courier to a price. Returning a bike is open to mechanics,
 * because they are the ones taking bikes back in.
 *
 * An assignment snapshots the plan's price and duration at creation, so editing
 * a plan later never rewrites an assignment's terms.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser, requireMinimumRole } from '@/features/auth/guards';
import { AssignmentsService } from '@/features/assignments/service';
import type {
  BikeAssignment,
  CreateAssignmentInput,
  ReturnAssignmentInput,
  AssignmentFilters,
  Result,
} from '@/lib/types/ebike';

/**
 * Build a service bound to the caller's organization.
 *
 * Pass a minimum role for writes that commit money; omit it for reads and for
 * returns, which mechanics perform. requireMinimumRole redirects rather than
 * returning an error, so a mechanic following a stale link lands on the
 * dashboard instead of seeing a failure.
 */
async function getService(minimumRole?: 'admin' | 'manager') {
  const user = minimumRole
    ? await requireMinimumRole(minimumRole)
    : await requireActiveUser();
  const supabase = await createClient();

  return {
    user,
    service: new AssignmentsService(supabase, user.organizationId),
  };
}

/** Message for an unexpected throw, so callers always get a readable string. */
function failure(error: unknown, fallback: string): Result<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

/**
 * Paths that show assignment data and must be refreshed after any write.
 *
 * An assignment touches three records, so the bike and courier detail pages are
 * revalidated alongside the lists.
 */
function revalidateAssignmentPaths(bikeId?: string, courierId?: string) {
  revalidatePath('/assignments');
  revalidatePath('/bikes');
  revalidatePath('/couriers');
  revalidatePath('/dashboard');

  if (bikeId) {
    revalidatePath(`/bikes/${bikeId}`);
  }
  if (courierId) {
    revalidatePath(`/couriers/${courierId}`);
  }
}

// ============================================================================
// READS
// ============================================================================

/**
 * List assignments, optionally filtered by bike, courier, or active state.
 */
export async function listAssignmentsAction(
  filters?: AssignmentFilters
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.list(filters);
  } catch (error) {
    return failure(error, 'Failed to list assignments');
  }
}

/**
 * Get a single assignment by ID.
 */
export async function getAssignmentAction(
  id: string
): Promise<Result<BikeAssignment>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get assignment');
  }
}

/**
 * Every assignment that has not been returned yet.
 */
export async function getActiveAssignmentsAction(): Promise<
  Result<BikeAssignment[]>
> {
  try {
    const { service } = await getService();
    return await service.getActiveAssignments();
  } catch (error) {
    return failure(error, 'Failed to get active assignments');
  }
}

/**
 * The open assignment for a bike, or null if it is not out with anyone.
 */
export async function getActiveBikeAssignmentAction(
  bikeId: string
): Promise<Result<BikeAssignment | null>> {
  try {
    const { service } = await getService();
    return await service.getActiveBikeAssignment(bikeId);
  } catch (error) {
    return failure(error, 'Failed to get bike assignment');
  }
}

/**
 * The open assignment for a courier, or null if they are not holding a bike.
 */
export async function getActiveCourierAssignmentAction(
  courierId: string
): Promise<Result<BikeAssignment | null>> {
  try {
    const { service } = await getService();
    return await service.getActiveCourierAssignment(courierId);
  } catch (error) {
    return failure(error, 'Failed to get courier assignment');
  }
}

/**
 * Every assignment a bike has ever had, newest first.
 */
export async function getBikeAssignmentHistoryAction(
  bikeId: string
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.getBikeHistory(bikeId);
  } catch (error) {
    return failure(error, 'Failed to get bike assignment history');
  }
}

/**
 * Every assignment a courier has ever had, newest first.
 */
export async function getCourierAssignmentHistoryAction(
  courierId: string
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.getCourierHistory(courierId);
  } catch (error) {
    return failure(error, 'Failed to get courier assignment history');
  }
}

/**
 * Assignments starting within a date range. For reporting.
 */
export async function getAssignmentsByDateRangeAction(
  startDate: Date,
  endDate: Date
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.getByDateRange(startDate, endDate);
  } catch (error) {
    return failure(error, 'Failed to get assignments by date range');
  }
}

/**
 * Total rental revenue committed in a date range.
 */
export async function getTotalRevenueAction(
  startDate: Date,
  endDate: Date
): Promise<Result<number>> {
  try {
    const { service } = await getService();
    return await service.getTotalRevenue(startDate, endDate);
  } catch (error) {
    return failure(error, 'Failed to calculate revenue');
  }
}

/**
 * Assignments past their expected return date.
 */
export async function getOverdueAssignmentsAction(
  daysOverdue: number = 0
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.getOverdue(daysOverdue);
  } catch (error) {
    return failure(error, 'Failed to get overdue assignments');
  }
}

// ============================================================================
// WRITES
// ============================================================================

/**
 * Assign a bike to a courier under a rental plan.
 */
export async function createAssignmentAction(
  input: CreateAssignmentInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService('manager');
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidateAssignmentPaths(input.bike_id, input.courier_id);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create assignment');
  }
}

/**
 * Close an assignment by taking the bike back.
 *
 * Mechanics may do this, so no minimum role is required. The returned
 * assignment carries the bike and courier IDs used to refresh their pages.
 */
export async function returnBikeAction(
  input: ReturnAssignmentInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.returnBike(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidateAssignmentPaths(result.data.bike_id, result.data.courier_id);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to return bike');
  }
}
