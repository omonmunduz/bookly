/**
 * RENTAL PLANS REPOSITORY
 *
 * Data access layer for rental plans (pricing configurations).
 * Handles plan CRUD operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RentalPlan,
  CreateRentalPlanInput,
  UpdateRentalPlanInput,
  OrganizationId,
} from '@/lib/types/ebike';

export class RentalPlansRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List all rental plans
   */
  async list(organizationId: OrganizationId, activeOnly = false): Promise<RentalPlan[]> {
    let query = this.supabase
      .from('rental_plans')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('price', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get active rental plans
   */
  async getActive(organizationId: OrganizationId): Promise<RentalPlan[]> {
    return this.list(organizationId, true);
  }

  /**
   * Get rental plan by ID
   */
  async getById(id: string, organizationId: OrganizationId): Promise<RentalPlan | null> {
    const { data, error } = await this.supabase
      .from('rental_plans')
      .select('*')
      .eq('id', id)
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
   * Get rental plan by name
   */
  async getByName(name: string, organizationId: OrganizationId): Promise<RentalPlan | null> {
    const { data, error } = await this.supabase
      .from('rental_plans')
      .select('*')
      .eq('name', name)
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
   * Create a new rental plan
   */
  async create(
    input: CreateRentalPlanInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<RentalPlan> {
    const { data, error } = await this.supabase
      .from('rental_plans')
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
   * Update a rental plan
   */
  async update(
    id: string,
    input: UpdateRentalPlanInput,
    organizationId: OrganizationId
  ): Promise<RentalPlan> {
    const { data, error } = await this.supabase
      .from('rental_plans')
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
   * Activate/deactivate a rental plan
   */
  async setActive(
    id: string,
    isActive: boolean,
    organizationId: OrganizationId
  ): Promise<RentalPlan> {
    return this.update(id, { is_active: isActive }, organizationId);
  }

  /**
   * Soft delete a rental plan
   */
  async delete(id: string, organizationId: OrganizationId): Promise<void> {
    const { error } = await this.supabase
      .from('rental_plans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Check if plan name is unique
   */
  async isPlanNameUnique(
    name: string,
    organizationId: OrganizationId,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('rental_plans')
      .select('id')
      .eq('name', name)
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
   * Count total plans
   */
  async count(organizationId: OrganizationId): Promise<number> {
    const { count, error } = await this.supabase
      .from('rental_plans')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }
}
