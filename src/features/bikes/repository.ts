/**
 * BIKES REPOSITORY
 *
 * Data access layer for bikes (e-bike assets).
 * Handles all database operations for the bikes table.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Bike,
  CreateBikeInput,
  UpdateBikeInput,
  BikeStatus,
  BikeStatusSummary,
  OrganizationId,
} from '@/lib/types/ebike';

export interface BikeFilters {
  status?: BikeStatus;
  search?: string; // Search bike_number, model, serial_number
}

export class BikesRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List all bikes for an organization with optional filters
   */
  async list(organizationId: OrganizationId, filters?: BikeFilters): Promise<Bike[]> {
    let query = this.supabase
      .from('bikes')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('bike_number', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `bike_number.ilike.%${filters.search}%,model.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get bike by ID
   */
  async getById(id: string, organizationId: OrganizationId): Promise<Bike | null> {
    const { data, error } = await this.supabase
      .from('bikes')
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
   * Get bike by bike number
   */
  async getByBikeNumber(bikeNumber: string, organizationId: OrganizationId): Promise<Bike | null> {
    const { data, error } = await this.supabase
      .from('bikes')
      .select('*')
      .eq('bike_number', bikeNumber)
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
   * Create a new bike
   */
  async create(
    input: CreateBikeInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<Bike> {
    const { data, error } = await this.supabase
      .from('bikes')
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
   * Update a bike
   */
  async update(
    id: string,
    input: UpdateBikeInput,
    organizationId: OrganizationId
  ): Promise<Bike> {
    const { data, error } = await this.supabase
      .from('bikes')
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
   * Update bike status
   */
  async updateStatus(
    id: string,
    status: BikeStatus,
    organizationId: OrganizationId
  ): Promise<Bike> {
    return this.update(id, { status }, organizationId);
  }

  /**
   * Soft delete a bike
   */
  async delete(id: string, organizationId: OrganizationId): Promise<void> {
    const { error } = await this.supabase
      .from('bikes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Get bikes by status
   */
  async getByStatus(status: BikeStatus, organizationId: OrganizationId): Promise<Bike[]> {
    const { data, error } = await this.supabase
      .from('bikes')
      .select('*')
      .eq('status', status)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('bike_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get available bikes (for assignment)
   */
  async getAvailable(organizationId: OrganizationId): Promise<Bike[]> {
    return this.getByStatus('available', organizationId);
  }

  /**
   * Count bikes by status
   */
  async countByStatus(
    organizationId: OrganizationId
  ): Promise<Record<BikeStatus, number>> {
    const { data, error } = await this.supabase
      .from('bikes')
      .select('status')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (error) throw error;

    const counts: Record<BikeStatus, number> = {
      available: 0,
      assigned: 0,
      maintenance: 0,
      damaged: 0,
      retired: 0,
    };

    data?.forEach((bike) => {
      counts[bike.status as BikeStatus]++;
    });

    return counts;
  }

  /**
   * Get bike status summary (with current assignment and maintenance info)
   */
  async getStatusSummary(organizationId: OrganizationId): Promise<BikeStatusSummary[]> {
    const { data, error } = await this.supabase
      .from('bike_status_summary')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get bike status summary by ID
   */
  async getStatusSummaryById(
    id: string,
    organizationId: OrganizationId
  ): Promise<BikeStatusSummary | null> {
    const { data, error } = await this.supabase
      .from('bike_status_summary')
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
   * Check if bike number is unique
   */
  async isBikeNumberUnique(
    bikeNumber: string,
    organizationId: OrganizationId,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('bikes')
      .select('id')
      .eq('bike_number', bikeNumber)
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
   * Get bikes needing maintenance (status = 'maintenance' or 'damaged')
   */
  async getNeedingMaintenance(organizationId: OrganizationId): Promise<Bike[]> {
    const { data, error } = await this.supabase
      .from('bikes')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['maintenance', 'damaged'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get total count
   */
  async count(organizationId: OrganizationId, filters?: BikeFilters): Promise<number> {
    let query = this.supabase
      .from('bikes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `bike_number.ilike.%${filters.search}%,model.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`
      );
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }
}
