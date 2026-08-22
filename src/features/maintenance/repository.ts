/**
 * MAINTENANCE REPOSITORY
 *
 * Data access layer for maintenance records and bike inspections.
 * Handles maintenance history, inspection workflow, and approval process.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MaintenanceRecord,
  CreateMaintenanceRecordInput,
  ApproveMaintenanceInput,
  BikeInspection,
  CreateInspectionInput,
  MaintenancePendingApproval,
  OrganizationId,
} from '@/lib/types/ebike';

export class MaintenanceRepository {
  constructor(private supabase: SupabaseClient) {}

  // ============================================================================
  // MAINTENANCE RECORDS
  // ============================================================================

  /**
   * List maintenance records
   */
  async listMaintenance(organizationId: OrganizationId, bikeId?: string): Promise<MaintenanceRecord[]> {
    let query = this.supabase
      .from('maintenance_records')
      .select('*')
      .eq('organization_id', organizationId)
      .order('performed_at', { ascending: false });

    if (bikeId) {
      query = query.eq('bike_id', bikeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get maintenance record by ID
   */
  async getMaintenanceById(id: string, organizationId: OrganizationId): Promise<MaintenanceRecord | null> {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create maintenance record
   */
  async createMaintenance(
    input: CreateMaintenanceRecordInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<MaintenanceRecord> {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .insert({
        organization_id: organizationId,
        ...input,
        performed_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Approve maintenance (manager only)
   */
  async approveMaintenance(
    input: ApproveMaintenanceInput,
    organizationId: OrganizationId,
    managerId: string
  ): Promise<MaintenanceRecord> {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .update({
        approved_by: managerId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', input.maintenance_id)
      .eq('organization_id', organizationId)
      .eq('requires_approval', true)
      .is('approved_by', null)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get maintenance pending approval
   */
  async getPendingApproval(organizationId: OrganizationId): Promise<MaintenancePendingApproval[]> {
    const { data, error } = await this.supabase
      .from('maintenance_pending_approval')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get bike maintenance history
   */
  async getBikeMaintenanceHistory(bikeId: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .select(
        `
        *,
        performed_by_user:performed_by(full_name),
        approved_by_user:approved_by(full_name)
      `
      )
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .order('performed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get total maintenance cost for a bike
   */
  async getTotalMaintenanceCost(bikeId: string, organizationId: OrganizationId): Promise<number> {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .select('cost')
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .not('cost', 'is', null);

    if (error) throw error;

    return data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0;
  }

  // ============================================================================
  // BIKE INSPECTIONS
  // ============================================================================

  /**
   * List bike inspections
   */
  async listInspections(organizationId: OrganizationId, bikeId?: string): Promise<BikeInspection[]> {
    let query = this.supabase
      .from('bike_inspections')
      .select('*')
      .eq('organization_id', organizationId)
      .order('inspected_at', { ascending: false });

    if (bikeId) {
      query = query.eq('bike_id', bikeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get inspection by ID
   */
  async getInspectionById(id: string, organizationId: OrganizationId): Promise<BikeInspection | null> {
    const { data, error } = await this.supabase
      .from('bike_inspections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create inspection
   * Trigger will:
   *   1. Update bike.status to match inspection.next_status
   *   2. Update assignment.condition_at_return if linked
   *   3. Create maintenance task if damage found
   */
  async createInspection(
    input: CreateInspectionInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<BikeInspection> {
    const { data, error } = await this.supabase
      .from('bike_inspections')
      .insert({
        organization_id: organizationId,
        ...input,
        inspected_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get bike inspection history
   */
  async getBikeInspectionHistory(bikeId: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('bike_inspections')
      .select(
        `
        *,
        inspected_by_user:inspected_by(full_name),
        assignment:assignment_id(courier_id, assigned_at, returned_at)
      `
      )
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .order('inspected_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get latest inspection for a bike
   */
  async getLatestInspection(bikeId: string, organizationId: OrganizationId): Promise<BikeInspection | null> {
    const { data, error } = await this.supabase
      .from('bike_inspections')
      .select('*')
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .order('inspected_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get inspections requiring maintenance follow-up
   */
  async getInspectionsRequiringMaintenance(organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('bike_inspections')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model, status),
        inspected_by_user:inspected_by(full_name)
      `
      )
      .eq('organization_id', organizationId)
      .eq('requires_maintenance', true)
      .order('inspected_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Count maintenance records by type
   */
  async countMaintenanceByType(organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('maintenance_records')
      .select('maintenance_type')
      .eq('organization_id', organizationId);

    if (error) throw error;

    const counts: Record<string, number> = {};
    data?.forEach((record) => {
      const type = record.maintenance_type;
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  }
}
