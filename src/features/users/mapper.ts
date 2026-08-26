/**
 * USER MAPPER
 *
 * Converts Supabase rows to domain User objects.
 * Handles branded IDs and date parsing.
 */

import type { Database } from '@/lib/database.types';
import type { User } from './types';
import { brandId } from '@/lib/types/common';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

export function mapUserFromRow(row: UserProfileRow): User {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role as 'admin' | 'manager' | 'mechanic',
    is_active: row.is_active ?? true,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}
