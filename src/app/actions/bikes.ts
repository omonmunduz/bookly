/**
 * BIKE SERVER ACTIONS
 *
 * The read/write surface for the bike fleet. Client components call these; they
 * never import the repository or hold a Supabase client.
 *
 * Reads are open to any active user — a mechanic needs to see the fleet to work
 * on it. Writes are manager-or-above, since adding or retiring a bike changes
 * what can be assigned.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser, requireMinimumRole } from '@/features/auth/guards';
import { BikesService } from '@/features/bikes/service';
import type {
  Bike,
  CreateBikeInput,
  UpdateBikeInput,
  BikeFilters,
  BikeStatusSummary,
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
    service: new BikesService(supabase, user.organizationId),
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
// READS
// ============================================================================

/**
 * List bikes with optional filters, ordered by bike number.
 */
export async function listBikesAction(
  filters?: BikeFilters
): Promise<Result<Bike[]>> {
  try {
    const { service } = await getService();
    return await service.list(filters);
  } catch (error) {
    return failure(error, 'Failed to list bikes');
  }
}

/**
 * Get a single bike by ID.
 */
export async function getBikeAction(id: string): Promise<Result<Bike>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get bike');
  }
}

/**
 * Get a bike by its human-readable fleet number.
 */
export async function getBikeByNumberAction(
  bikeNumber: string
): Promise<Result<Bike>> {
  try {
    const { service } = await getService();
    return await service.getByBikeNumber(bikeNumber);
  } catch (error) {
    return failure(error, 'Failed to get bike');
  }
}

/**
 * Bikes free to assign right now. For the assignment form's bike picker.
 */
export async function getAvailableBikesAction(): Promise<Result<Bike[]>> {
  try {
    const { service } = await getService();
    return await service.getAvailable();
  } catch (error) {
    return failure(error, 'Failed to get available bikes');
  }
}

/**
 * Bikes flagged as needing service, for the maintenance queue.
 */
export async function getBikesNeedingMaintenanceAction(): Promise<
  Result<Bike[]>
> {
  try {
    const { service } = await getService();
    return await service.getNeedingMaintenance();
  } catch (error) {
    return failure(error, 'Failed to get bikes needing maintenance');
  }
}

/**
 * Bikes awaiting inspection after return (returned status).
 */
export async function getBikesAwaitingInspectionAction(): Promise<
  Result<Bike[]>
> {
  try {
    const { service } = await getService();
    return await service.getAwaitingInspection();
  } catch (error) {
    return failure(error, 'Failed to get bikes awaiting inspection');
  }
}

/**
 * Fleet counts per status, for the dashboard.
 */
export async function getBikeCountByStatusAction(): Promise<
  Result<Record<Bike['status'], number>>
> {
  try {
    const { service } = await getService();
    return await service.countByStatus();
  } catch (error) {
    return failure(error, 'Failed to get bike count by status');
  }
}

/**
 * Every bike with its current assignment joined in.
 */
export async function getBikeStatusSummaryAction(): Promise<
  Result<BikeStatusSummary[]>
> {
  try {
    const { service } = await getService();
    return await service.getStatusSummary();
  } catch (error) {
    return failure(error, 'Failed to get bike status summary');
  }
}

// ============================================================================
// WRITES
// ============================================================================

/**
 * Add a bike to the fleet.
 */
export async function createBikeAction(
  input: CreateBikeInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService('manager');
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/bikes');
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create bike');
  }
}

/**
 * Update a bike's details.
 */
export async function updateBikeAction(
  id: string,
  input: UpdateBikeInput
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.update(id, input);

    if (!result.success) {
      return result;
    }

    revalidatePath('/bikes');
    revalidatePath(`/bikes/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update bike');
  }
}

/**
 * Change a bike's status, optionally recording why.
 *
 * Cannot be used to set 'assigned' or to move a bike off 'assigned' — those
 * transitions belong to the assignment workflow, which the service enforces.
 */
export async function updateBikeStatusAction(
  id: string,
  data: { status: Bike['status']; notes?: string }
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.updateStatus(id, data.status, data.notes);

    if (!result.success) {
      return result;
    }

    revalidatePath('/bikes');
    revalidatePath(`/bikes/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update bike status');
  }
}

/**
 * Soft-delete a bike.
 */
export async function deleteBikeAction(id: string): Promise<Result<void>> {
  try {
    const { service } = await getService('manager');
    const result = await service.delete(id);

    if (result.success) {
      revalidatePath('/bikes');
      revalidatePath('/dashboard');
    }

    return result;
  } catch (error) {
    return failure(error, 'Failed to delete bike');
  }
}

/** Alias kept for components importing the shorter name. */
export { updateBikeStatusAction as updateBikeStatus };
