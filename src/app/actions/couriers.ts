/**
 * COURIER SERVER ACTIONS
 *
 * The read/write surface for couriers and their bike assignment history. Client
 * components call these; they never import the repository or hold a Supabase
 * client.
 *
 * Reads are open to any active user — a mechanic servicing a bike needs to know
 * who is riding it. Writes are manager-or-above, since adding or deactivating a
 * courier changes who can be assigned a bike.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser, requireMinimumRole } from '@/features/auth/guards';
import { CouriersService } from '@/features/couriers/service';
import type {
  Courier,
  CreateCourierInput,
  UpdateCourierInput,
  CourierFilters,
  BikeAssignment,
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
    service: new CouriersService(supabase, user.organizationId),
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
 * List couriers with optional filters, ordered by courier code.
 */
export async function listCouriersAction(
  filters?: CourierFilters
): Promise<Result<Courier[]>> {
  try {
    const { service } = await getService();
    return await service.list(filters);
  } catch (error) {
    return failure(error, 'Failed to list couriers');
  }
}

/**
 * Get a single courier by ID.
 */
export async function getCourierAction(id: string): Promise<Result<Courier>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get courier');
  }
}

/**
 * Get a courier by their human-readable courier code.
 */
export async function getCourierByCodeAction(
  courierCode: string
): Promise<Result<Courier>> {
  try {
    const { service } = await getService();
    return await service.getByCourierCode(courierCode);
  } catch (error) {
    return failure(error, 'Failed to get courier');
  }
}

/**
 * Find couriers by phone number. The match is partial, so this can return more
 * than one — callers checking for a duplicate should compare exactly.
 */
export async function searchCourierByPhoneAction(
  phone: string
): Promise<Result<Courier[]>> {
  try {
    const { service } = await getService();
    return await service.searchByPhone(phone);
  } catch (error) {
    return failure(error, 'Failed to search courier');
  }
}

/**
 * Every active courier, unpaginated. For select inputs that need the full list.
 */
export async function getActiveCouriersAction(): Promise<Result<Courier[]>> {
  try {
    const { service } = await getService();
    return await service.getActive();
  } catch (error) {
    return failure(error, 'Failed to get active couriers');
  }
}

/**
 * The courier's open assignment, or null when they have no bike out.
 */
export async function getCourierCurrentAssignmentAction(
  courierId: string
): Promise<Result<BikeAssignment | null>> {
  try {
    const { service } = await getService();
    return await service.getCurrentAssignment(courierId);
  } catch (error) {
    return failure(error, 'Failed to get current assignment');
  }
}

/**
 * Every assignment the courier has held, newest first.
 */
export async function getCourierAssignmentHistoryAction(
  courierId: string
): Promise<Result<BikeAssignment[]>> {
  try {
    const { service } = await getService();
    return await service.getAssignmentHistory(courierId);
  } catch (error) {
    return failure(error, 'Failed to get assignment history');
  }
}

/**
 * Whether the courier is eligible for a bike — active, and not already holding
 * one. Checked before opening the assignment form so the user is not offered a
 * courier the service would then reject.
 */
export async function checkCourierCanBeAssignedAction(
  courierId: string
): Promise<Result<boolean>> {
  try {
    const { service } = await getService();
    return await service.canBeAssignedBike(courierId);
  } catch (error) {
    return failure(error, 'Failed to check courier eligibility');
  }
}

// ============================================================================
// WRITES
// ============================================================================

/**
 * Create a courier.
 */
export async function createCourierAction(
  input: CreateCourierInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService('manager');
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/couriers');
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create courier');
  }
}

/**
 * Update a courier's details.
 */
export async function updateCourierAction(
  id: string,
  input: UpdateCourierInput
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.update(id, input);

    if (!result.success) {
      return result;
    }

    revalidatePath('/couriers');
    revalidatePath(`/couriers/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update courier');
  }
}

/**
 * Change a courier's status, optionally recording why.
 */
export async function updateCourierStatusAction(
  id: string,
  data: { status: Courier['status']; notes?: string }
): Promise<Result<{ id: string }>> {
  try {
    const { service } = await getService('manager');
    const result = await service.updateStatus(id, data.status, data.notes);

    if (!result.success) {
      return result;
    }

    revalidatePath('/couriers');
    revalidatePath(`/couriers/${id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update courier status');
  }
}

/**
 * Soft-delete a courier.
 */
export async function deleteCourierAction(id: string): Promise<Result<void>> {
  try {
    const { service } = await getService('manager');
    const result = await service.delete(id);

    if (result.success) {
      revalidatePath('/couriers');
      revalidatePath('/dashboard');
    }

    return result;
  } catch (error) {
    return failure(error, 'Failed to delete courier');
  }
}

/** Alias kept for components importing the shorter name. */
export { updateCourierStatusAction as updateCourierStatus };
