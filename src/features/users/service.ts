/**
 * USERS REPOSITORY IMPLEMENTATION
 *
 * Supabase-backed data access for user profiles.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  UserFilter,
} from './types';
import type { OrganizationId, Result } from '@/lib/types/common';

export class UsersRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private organizationId: OrganizationId
  ) {}

  /**
   * List all users in the organization.
   */
  async list(filters?: Partial<UserFilter>): Promise<Result<User[]>> {
    let query = this.supabase
      .from('user_profiles')
      .select('*')
      .eq('organization_id', this.organizationId)
      .order('full_name', { ascending: true });

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.search) {
      const search = `%${filters.search}%`;
      query = query.or(`full_name.ilike.${search},email.ilike.${search}`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as User[] };
  }

  /**
   * Get a single user by ID.
   */
  async getById(id: string): Promise<Result<User>> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, data: data as User };
  }

  /**
   * Create a new user profile.
   * Note: This assumes the auth.users record already exists.
   */
  async create(input: CreateUserInput & { id: string }): Promise<Result<User>> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .insert({
        id: input.id,
        organization_id: input.organization_id,
        email: input.email,
        full_name: input.full_name,
        phone: input.phone || null,
        role: input.role || 'mechanic',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as User };
  }

  /**
   * Update a user's profile.
   */
  async update(id: string, input: UpdateUserInput): Promise<Result<User>> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update({
        ...(input.full_name !== undefined && { full_name: input.full_name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      })
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, data: data as User };
  }

  /**
   * Count active users in the organization.
   */
  async countActive(): Promise<Result<number>> {
    const { count, error } = await this.supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', this.organizationId)
      .eq('is_active', true);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: count || 0 };
  }
}
