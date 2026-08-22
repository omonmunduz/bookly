/**
 * BIKE ASSIGNMENTS REPOSITORY
 *
 * Data access layer for bike assignments (historical tracking of bike rentals).
 * Handles assignment creation, return processing, and history queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BikeAssignment,
  CreateAssignmentInput,
  ReturnAssignmentInput,
  OrganizationId,
} from '@/lib/types/ebike';

export interface AssignmentFilters {
  bikeId?: string;
  courierId?: string;
  active?: boolean; // If true, only unreturned assignments
}

export class BikeAssignmentsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List assignments with optional filters
   */
  async list(organizationId: OrganizationId, filters?: AssignmentFilters): Promise<BikeAssignment[]> {
    let query = this.supabase
      .from('bike_assignments')
      .select('*')
      .eq('organization_id', organizationId)
      .order('assigned_at', { ascending: false });

    if (filters?.bikeId) {
      query = query.eq('bike_id', filters.bikeId);
    }

    if (filters?.courierId) {
      query = query.eq('courier_id', filters.courierId);
    }

    if (filters?.active) {
      query = query.is('returned_at', null);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get assignment by ID
   */
  async getById(id: string, organizationId: OrganizationId): Promise<BikeAssignment | null> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
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
   * Create a new assignment
   * Triggers will:
   *   1. Validate bike is 'available'
   *   2. Validate courier has no active assignment
   *   3. Update bike status to 'assigned'
   */
  async create(
    input: CreateAssignmentInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<BikeAssignment> {
    // First, get the rental plan to snapshot its details
    const { data: plan, error: planError } = await this.supabase
      .from('rental_plans')
      .select('name, duration_value, duration_unit, price')
      .eq('id', input.rental_plan_id)
      .eq('organization_id', organizationId)
      .single();

    if (planError) throw planError;
    if (!plan) throw new Error('Rental plan not found');

    const { data, error } = await this.supabase
      .from('bike_assignments')
      .insert({
        organization_id: organizationId,
        bike_id: input.bike_id,
        courier_id: input.courier_id,
        rental_plan_id: input.rental_plan_id,
        plan_name: plan.name,
        plan_duration_value: plan.duration_value,
        plan_duration_unit: plan.duration_unit,
        plan_price: plan.price,
        condition_at_assignment: input.condition_at_assignment,
        assignment_notes: input.assignment_notes,
        assigned_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Return a bike (close the assignment)
   * Trigger will update bike status to 'available'
   * (or inspection will override to 'maintenance'/'damaged')
   */
  async returnBike(
    input: ReturnAssignmentInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<BikeAssignment> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .update({
        returned_at: new Date().toISOString(),
        returned_by: userId,
        condition_at_return: input.condition_at_return,
        return_notes: input.return_notes,
      })
      .eq('id', input.assignment_id)
      .eq('organization_id', organizationId)
      .is('returned_at', null) // Only update if not already returned
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get active assignment for a bike
   */
  async getActiveBikeAssignment(
    bikeId: string,
    organizationId: OrganizationId
  ): Promise<BikeAssignment | null> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select('*')
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .is('returned_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get active assignment for a courier
   */
  async getActiveCourierAssignment(
    courierId: string,
    organizationId: OrganizationId
  ): Promise<BikeAssignment | null> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select('*')
      .eq('courier_id', courierId)
      .eq('organization_id', organizationId)
      .is('returned_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get all active assignments
   */
  async getActiveAssignments(organizationId: OrganizationId): Promise<BikeAssignment[]> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model, status, image_url),
        couriers:courier_id(courier_code, full_name, phone),
        assigned_by_user:assigned_by(full_name)
      `
      )
      .eq('organization_id', organizationId)
      .is('returned_at', null)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get assignment history for a bike
   */
  async getBikeHistory(bikeId: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        couriers:courier_id(courier_code, full_name),
        assigned_by_user:assigned_by(full_name),
        returned_by_user:returned_by(full_name)
      `
      )
      .eq('bike_id', bikeId)
      .eq('organization_id', organizationId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get assignment history for a courier
   */
  async getCourierHistory(courierId: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model),
        assigned_by_user:assigned_by(full_name),
        returned_by_user:returned_by(full_name)
      `
      )
      .eq('courier_id', courierId)
      .eq('organization_id', organizationId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get assignments for a date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string,
    organizationId: OrganizationId
  ): Promise<BikeAssignment[]> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model),
        couriers:courier_id(courier_code, full_name)
      `
      )
      .eq('organization_id', organizationId)
      .gte('assigned_at', startDate)
      .lte('assigned_at', endDate)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Count active assignments
   */
  async countActive(organizationId: OrganizationId): Promise<number> {
    const { count, error } = await this.supabase
      .from('bike_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('returned_at', null);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get total rental revenue for a period
   */
  async getTotalRevenue(
    startDate: string,
    endDate: string,
    organizationId: OrganizationId
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select('plan_price')
      .eq('organization_id', organizationId)
      .gte('assigned_at', startDate)
      .lte('assigned_at', endDate);

    if (error) throw error;

    return data?.reduce((sum, assignment) => sum + (assignment.plan_price || 0), 0) || 0;
  }

  /**
   * Get assignments pending return (unreturned for > X days)
   */
  async getOverdue(daysOverdue: number, organizationId: OrganizationId) {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);

    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model),
        couriers:courier_id(courier_code, full_name, phone)
      `
      )
      .eq('organization_id', organizationId)
      .is('returned_at', null)
      .lte('assigned_at', overdueDate.toISOString())
      .order('assigned_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
