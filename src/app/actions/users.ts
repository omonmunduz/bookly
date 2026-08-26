/**
 * USER MANAGEMENT SERVER ACTIONS
 *
 * Actions for managing team members and their roles.
 * Only accessible to managers and admins.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { UsersRepository } from '@/features/users/service';
import type {
  User,
  UpdateUserInput,
  UserFilter,
} from '@/features/users/types';
import type { Result } from '@/lib/types/common';

// Input for creating a user - organization_id is set by the action
interface CreateUserInput {
  email: string;
  full_name: string;
  phone?: string;
  role?: User['role'];
}

/**
 * Build a repository bound to the caller's organization.
 */
async function getRepository() {
  const user = await requireMinimumRole('manager');
  const supabase = await createClient();

  return {
    user,
    repository: new UsersRepository(supabase, user.organizationId),
  };
}

/** Message for an unexpected throw. */
function failure(error: unknown, fallback: string): Result<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

// ============================================================================
// USER CRUD
// ============================================================================

/**
 * List all users in the organization.
 */
export async function listUsersAction(
  filters?: Partial<UserFilter>
): Promise<Result<User[]>> {
  try {
    const { repository, user } = await getRepository();
    return await repository.list({
      organization_id: user.organizationId,
      ...filters,
    });
  } catch (error) {
    return failure(error, 'Failed to list users');
  }
}

/**
 * Get a single user by ID.
 */
export async function getUserAction(id: string): Promise<Result<User>> {
  try {
    const { repository } = await getRepository();
    return await repository.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get user');
  }
}

/**
 * Create a new user by sending an invitation email.
 *
 * This uses Supabase Admin API to:
 * 1. Check if user already exists in auth.users
 * 2. Send an invitation email via Supabase Auth
 * 3. Create a user_profile record with organization and role
 *
 * The invited user will receive an email with a link to set their password.
 * After setting their password, they'll be automatically added to the organization.
 */
export async function createUserAction(
  input: CreateUserInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, repository } = await getRepository();
    const supabase = await createClient();

    // Only admins can create users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can create users',
      };
    }

    const email = input.email.toLowerCase().trim();

    // Check if user already exists in this organization's user_profiles
    const existingUsers = await repository.list({
      organization_id: user.organizationId,
      search: email,
    });

    if (existingUsers.success) {
      // Check for exact email match (search is fuzzy)
      const exactMatch = existingUsers.data.find(u => u.email.toLowerCase() === email);
      if (exactMatch) {
        return {
          success: false,
          error: 'A user with this email already exists in your organization.',
        };
      }
    }

    // Try to invite the user via Supabase Admin API
    // If they already have an auth account, Supabase will return an error
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: input.full_name,
        organization_id: user.organizationId,
        role: input.role || 'mechanic',
        phone: input.phone || null,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=invite`,
    });

    if (inviteError) {
      // Handle specific error cases
      if (inviteError.message?.includes('already registered') || inviteError.message?.includes('already been invited')) {
        return {
          success: false,
          error: 'This email is already registered or has a pending invitation.',
        };
      }

      return {
        success: false,
        error: `Failed to send invitation: ${inviteError.message}`,
      };
    }

    if (!inviteData.user) {
      return {
        success: false,
        error: 'Failed to create user invitation.',
      };
    }

    // Create the user profile immediately
    // This ensures the profile exists when they accept the invitation
    const createResult = await repository.create({
      id: inviteData.user.id,
      organization_id: user.organizationId,
      email: email,
      full_name: input.full_name,
      phone: input.phone || undefined,
      role: input.role || 'mechanic',
    });

    if (!createResult.success) {
      // Profile creation failed - try to clean up the auth user
      await supabase.auth.admin.deleteUser(inviteData.user.id);
      return {
        success: false,
        error: `Failed to create user profile: ${createResult.error}`,
      };
    }

    revalidatePath('/team');

    return {
      success: true,
      data: { id: inviteData.user.id },
    };
  } catch (error) {
    return failure(error, 'Failed to create user');
  }
}

/**
 * Update a user's details.
 */
export async function updateUserAction(
  id: string,
  input: UpdateUserInput
): Promise<Result<{ id: string }>> {
  try {
    const { repository, user } = await getRepository();

    // Only admins can update users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can update users',
      };
    }

    const result = await repository.update(id, input);

    if (!result.success) {
      return result;
    }

    revalidatePath('/team');
    revalidatePath(`/team/${id}`);

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to update user');
  }
}

/**
 * Deactivate a user (soft delete).
 */
export async function deactivateUserAction(id: string): Promise<Result<void>> {
  try {
    const { repository, user } = await getRepository();

    // Only admins can deactivate users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can deactivate users',
      };
    }

    // Prevent self-deactivation
    if (id === user.id) {
      return {
        success: false,
        error: 'You cannot deactivate yourself',
      };
    }

    const result = await repository.update(id, { is_active: false });

    if (result.success) {
      revalidatePath('/team');
    }

    return result.success ? { success: true, data: undefined } : result;
  } catch (error) {
    return failure(error, 'Failed to deactivate user');
  }
}

/**
 * Reactivate a user.
 */
export async function reactivateUserAction(id: string): Promise<Result<void>> {
  try {
    const { repository, user } = await getRepository();

    // Only admins can reactivate users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can reactivate users',
      };
    }

    const result = await repository.update(id, { is_active: true });

    if (result.success) {
      revalidatePath('/team');
    }

    return result.success ? { success: true, data: undefined } : result;
  } catch (error) {
    return failure(error, 'Failed to reactivate user');
  }
}
