/**
 * MAINTENANCE SERVER ACTIONS
 *
 * The read/write surface for maintenance records and bike inspections. Client
 * components call these; they never import the repository or hold a Supabase
 * client.
 *
 * Same conventions as the other action modules:
 * - Return Result<T> instead of throwing, so forms can render errors inline
 * - revalidatePath() after every write, since the pages are Server Components
 *
 * Recording maintenance and inspections is open to every role — a mechanic who
 * just finished a repair has to be able to log it. Approving is manager work,
 * matching the approval rule in MaintenanceService.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser, requireMinimumRole } from '@/features/auth/guards';
import { MaintenanceService } from '@/features/maintenance/service';
import type {
  MaintenanceRecord,
  BikeInspection,
  CreateMaintenanceRecordInput,
  ApproveMaintenanceInput,
  CreateInspectionInput,
  MaintenancePendingApproval,
  Result,
} from '@/lib/types/ebike';

/**
 * Build a service bound to the caller's organization.
 *
 * Every action needs the same three things — the user, a client, and a service
 * scoped to their org — so it lives here rather than being repeated fourteen
 * times. `minimumRole` covers the manager-only actions.
 */
async function getService(minimumRole?: 'admin' | 'manager') {
  const user = minimumRole
    ? await requireMinimumRole(minimumRole)
    : await requireActiveUser();
  const supabase = await createClient();

  return {
    user,
    service: new MaintenanceService(supabase, user.organizationId),
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
// MAINTENANCE RECORDS
// ============================================================================

/**
 * List maintenance records, newest first. Pass a bike ID to scope to one bike.
 */
export async function listMaintenanceRecordsAction(
  bikeId?: string
): Promise<Result<MaintenanceRecord[]>> {
  try {
    const { service } = await getService();
    return await service.listMaintenance(bikeId);
  } catch (error) {
    return failure(error, 'Failed to list maintenance records');
  }
}

/**
 * Get a single maintenance record by ID.
 */
export async function getMaintenanceRecordAction(
  id: string
): Promise<Result<MaintenanceRecord>> {
  try {
    const { service } = await getService();
    return await service.getMaintenanceById(id);
  } catch (error) {
    return failure(error, 'Failed to get maintenance record');
  }
}

/**
 * Create a maintenance record. Open to every role.
 */
export async function createMaintenanceRecordAction(
  input: CreateMaintenanceRecordInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.createMaintenance(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/maintenance');
    revalidatePath(`/bikes/${input.bike_id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create maintenance record');
  }
}

/**
 * Approve a maintenance record. Manager or admin only.
 */
export async function approveMaintenanceAction(
  input: ApproveMaintenanceInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService('manager');
    const result = await service.approveMaintenance(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/maintenance');
    revalidatePath(`/maintenance/${input.maintenance_id}`);
    revalidatePath('/maintenance/approvals');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to approve maintenance');
  }
}

/**
 * Records awaiting approval. Manager or admin only.
 */
export async function getMaintenancePendingApprovalAction(): Promise<
  Result<MaintenancePendingApproval[]>
> {
  try {
    const { service } = await getService('manager');
    return await service.getPendingApproval();
  } catch (error) {
    return failure(error, 'Failed to get pending approvals');
  }
}

/**
 * Total maintenance spend for one bike.
 */
export async function getTotalMaintenanceCostAction(
  bikeId: string
): Promise<Result<number>> {
  try {
    const { service } = await getService();
    return await service.getTotalMaintenanceCost(bikeId);
  } catch (error) {
    return failure(error, 'Failed to calculate maintenance cost');
  }
}

// ============================================================================
// INSPECTIONS
// ============================================================================

/**
 * List inspections, newest first. Pass a bike ID to scope to one bike.
 */
export async function listInspectionsAction(
  bikeId?: string
): Promise<Result<BikeInspection[]>> {
  try {
    const { service } = await getService();
    return await service.listInspections(bikeId);
  } catch (error) {
    return failure(error, 'Failed to list inspections');
  }
}

/**
 * Get a single inspection by ID.
 */
export async function getInspectionAction(
  id: string
): Promise<Result<BikeInspection>> {
  try {
    const { service } = await getService();
    return await service.getInspectionById(id);
  } catch (error) {
    return failure(error, 'Failed to get inspection');
  }
}

/**
 * Create an inspection. Open to every role.
 *
 * An inspection sets the bike's next status, so the bike pages are revalidated
 * alongside the inspection list.
 */
export async function createInspectionAction(
  input: CreateInspectionInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.createInspection(input, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath('/maintenance/inspections');
    revalidatePath(`/bikes/${input.bike_id}`);
    revalidatePath('/bikes');
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create inspection');
  }
}

/**
 * Most recent inspection for a bike, or null if it has never been inspected.
 */
export async function getLatestInspectionAction(
  bikeId: string
): Promise<Result<BikeInspection | null>> {
  try {
    const { service } = await getService();
    return await service.getLatestInspection(bikeId);
  } catch (error) {
    return failure(error, 'Failed to get latest inspection');
  }
}

/**
 * Inspections flagged as needing maintenance follow-up.
 */
export async function getInspectionsRequiringMaintenanceAction(): Promise<
  Result<BikeInspection[]>
> {
  try {
    const { service } = await getService();
    return await service.getInspectionsRequiringMaintenance();
  } catch (error) {
    return failure(error, 'Failed to get inspections requiring maintenance');
  }
}
