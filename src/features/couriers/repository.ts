/**
 * COURIERS REPOSITORY
 *
 * Data access layer for couriers (delivery personnel who rent bikes).
 * Handles all database operations for the couriers table.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Courier,
  CreateCourierInput,
  UpdateCourierInput,
  CourierStatus,
  OrganizationId,
} from '@/lib/types/ebike';

export interface CourierFilters {
  status?: CourierStatus;
  search?: string; // Search courier_code, full_name, phone
}

export class CouriersRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List all couriers for an organization with optional filters
   */
  async list(organizationId: OrganizationId, filters?: CourierFilters): Promise<Courier[]> {
    let query = this.supabase
      .from('couriers')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('courier_code', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `courier_code.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get courier by ID
   */
  async getById(id: string, organizationId: OrganizationId): Promise<Courier | null> {
    const { data, error } = await this.supabase
      .from('couriers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get courier by courier code
   */
  async getByCourierCode(
    courierCode: string,
    organizationId: OrganizationId
  ): Promise<Courier | null> {
    const { data, error } = await this.supabase
      .from('couriers')
      .select('*')
      .eq('courier_code', courierCode)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create a new courier
   */
  async create(
    input: CreateCourierInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<Courier> {
    const { data, error } = await this.supabase
      .from('couriers')
      .insert({
        organization_id: organizationId,
        ...input,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a courier
   */
  async update(
    id: string,
    input: UpdateCourierInput,
    organizationId: OrganizationId
  ): Promise<Courier> {
    const { data, error } = await this.supabase
      .from('couriers')
      .update(input)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update courier status
   */
  async updateStatus(
    id: string,
    status: CourierStatus,
    organizationId: OrganizationId
  ): Promise<Courier> {
    return this.update(id, { status }, organizationId);
  }

  /**
   * Soft delete a courier
   */
  async delete(id: string, organizationId: OrganizationId): Promise<void> {
    const { error } = await this.supabase
      .from('couriers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Get couriers by status
   */
  async getByStatus(status: CourierStatus, organizationId: OrganizationId): Promise<Courier[]> {
    const { data, error } = await this.supabase
      .from('couriers')
      .select('*')
      .eq('status', status)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get active couriers
   */
  async getActive(organizationId: OrganizationId): Promise<Courier[]> {
    return this.getByStatus('active', organizationId);
  }

  /**
   * Count couriers by status
   */
  async countByStatus(
    organizationId: OrganizationId
  ): Promise<Record<CourierStatus, number>> {
    const { data, error } = await this.supabase
      .from('couriers')
      .select('status')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (error) throw error;

    const counts: Record<CourierStatus, number> = {
      active: 0,
      inactive: 0,
      suspended: 0,
    };

    data?.forEach((courier) => {
      counts[courier.status as CourierStatus]++;
    });

    return counts;
  }

  /**
   * Check if courier code is unique
   */
  async isCourierCodeUnique(
    courierCode: string,
    organizationId: OrganizationId,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('couriers')
      .select('id')
      .eq('courier_code', courierCode)
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return !data || data.length === 0;
  }

  /**
   * Check if courier has an active assignment
   */
  async hasActiveAssignment(id: string, organizationId: OrganizationId): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select('id')
      .eq('courier_id', id)
      .eq('organization_id', organizationId)
      .is('returned_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false; // Not found = no active assignment
      throw error;
    }

    return !!data;
  }

  /**
   * Get courier's current bike assignment
   */
  async getCurrentAssignment(id: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('bike_assignments')
      .select(
        `
        *,
        bikes:bike_id(bike_number, model, status),
        rental_plans:rental_plan_id(name, price)
      `
      )
      .eq('courier_id', id)
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
   * Get courier's assignment history
   */
  async getAssignmentHistory(id: string, organizationId: OrganizationId) {
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
      .eq('courier_id', id)
      .eq('organization_id', organizationId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get total count
   */
  async count(organizationId: OrganizationId, filters?: CourierFilters): Promise<number> {
    let query = this.supabase
      .from('couriers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `courier_code.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }

  /**
   * Search couriers by phone
   */
  async searchByPhone(phone: string, organizationId: OrganizationId): Promise<Courier[]> {
    const { data, error } = await this.supabase
      .from('couriers')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('phone', `%${phone}%`)
      .is('deleted_at', null)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
