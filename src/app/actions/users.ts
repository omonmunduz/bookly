/**
 * USER MANAGEMENT SERVER ACTIONS
 *
 * Actions for managing team members and their roles.
 * Only accessible to managers and admins.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { UsersRepository } from '@/features/users/service';
import { getAppOrigin } from '@/lib/constants/app-url';
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
  password: string;
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
 * Create a new user by creating their account with a password.
 *
 * This uses Supabase Admin API to:
 * 1. Check if user already exists in auth.users
 * 2. Create auth user with the provided password
 * 3. Create a user_profile record with organization and role
 *
 * The admin will share the credentials with the new user.
 * The user can log in immediately and change their password.
 */
export async function createUserAction(
  input: CreateUserInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, repository } = await getRepository();
    const supabase = await createClient();
    const adminClient = createAdminClient();

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

    // Create the user with password using Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email,
      password: input.password,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name: input.full_name,
        organization_id: user.organizationId,
        role: input.role || 'mechanic',
        phone: input.phone || null,
      },
    });

    if (authError) {
      // Handle specific error cases
      if (authError.message?.includes('already registered') || authError.message?.includes('User already registered')) {
        return {
          success: false,
          error: 'This email is already registered.',
        };
      }

      return {
        success: false,
        error: `Failed to create user: ${authError.message}`,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user account.',
      };
    }

    // Create the user profile immediately
    const createResult = await repository.create({
      id: authData.user.id,
      organization_id: user.organizationId,
      email: email,
      full_name: input.full_name,
      phone: input.phone || undefined,
      role: input.role || 'mechanic',
    });

    if (!createResult.success) {
      // Profile creation failed - try to clean up the auth user
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return {
        success: false,
        error: `Failed to create user profile: ${createResult.error}`,
      };
    }

    // CRITICAL: Update the user's JWT app_metadata with organization_id and role
    // This prevents redirect loops - middleware checks app_metadata.organization_id
    // Without this, the new user's JWT has no org claim and they get stuck in
    // a redirect loop between /onboarding/setup and /dashboard
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      authData.user.id,
      {
        app_metadata: {
          organization_id: user.organizationId,
          role: input.role || 'mechanic',
        },
      }
    );

    if (updateError) {
      console.error('Failed to update user metadata:', updateError);
      // Don't fail the whole operation - user can still log in after token refresh
      // The profile exists and is correct, JWT just needs to refresh
    }

    revalidatePath('/team');

    return {
      success: true,
      data: { id: authData.user.id },
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

/**
 * Delete a user permanently.
 * This removes the user from both auth.users and user_profiles.
 *
 * IMPORTANT: Only use for cleaning up failed invitations or test users.
 * For normal operations, use deactivate instead (soft delete).
 */
export async function deleteUserAction(id: string): Promise<Result<void>> {
  try {
    const { repository, user } = await getRepository();
    const adminClient = createAdminClient();

    // Only admins can delete users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can delete users',
      };
    }

    // Prevent self-deletion
    if (id === user.id) {
      return {
        success: false,
        error: 'You cannot delete yourself',
      };
    }

    // Check if user has any activity (created records, etc.)
    // For now, we'll allow deletion but in production you might want to check:
    // - created_by references
    // - assigned records
    // - transaction history
    // If they have activity, force them to deactivate instead

    // Delete user profile first
    const deleteResult = await repository.delete(id);

    if (!deleteResult.success) {
      return deleteResult;
    }

    // Delete from auth.users (this also deletes the session)
    const { error: authError } = await adminClient.auth.admin.deleteUser(id);

    if (authError) {
      return {
        success: false,
        error: `Failed to delete auth user: ${authError.message}`,
      };
    }

    revalidatePath('/team');

    return { success: true, data: undefined };
  } catch (error) {
    return failure(error, 'Failed to delete user');
  }
}

/**
 * Resend invitation email to a user who hasn't accepted yet.
 *
 * This generates a new magic link for users whose invite expired or was lost.
 * The user must not have logged in yet (should still be in invited state).
 */
export async function resendInviteAction(id: string): Promise<Result<void>> {
  try {
    const { repository, user } = await getRepository();
    const adminClient = createAdminClient();

    // Only admins can resend invites
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can resend invitations',
      };
    }

    // Get the user to resend invite to
    const userResult = await repository.getById(id);

    if (!userResult.success) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const invitedUser = userResult.data;

    // Generate a new invite link using admin API
    // This will send a new email with a fresh token
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      invitedUser.email,
      {
        data: {
          full_name: invitedUser.full_name,
          organization_id: invitedUser.organization_id,
          role: invitedUser.role,
          phone: invitedUser.phone,
        },
        redirectTo: `${getAppOrigin()}/auth/callback?type=invite`,
      }
    );

    if (inviteError) {
      // If user already confirmed their email, they don't need a new invite
      if (inviteError.message?.includes('already registered') ||
          inviteError.message?.includes('User already registered')) {
        return {
          success: false,
          error: 'This user has already accepted their invitation and set a password. They can log in directly.',
        };
      }

      return {
        success: false,
        error: `Failed to resend invitation: ${inviteError.message}`,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    return failure(error, 'Failed to resend invitation');
  }
}
