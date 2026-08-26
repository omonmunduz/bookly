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
  CreateUserInput,
  UpdateUserInput,
  UserFilter,
} from '@/features/users/types';
import type { Result } from '@/lib/types/common';

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
 * Create a new user (admin only).
 */
export async function createUserAction(
  input: CreateUserInput
): Promise<Result<{ id: string }>> {
  try {
    const { repository, user } = await getRepository();

    // Only admins can create users
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Only admins can create users',
      };
    }

    const result = await repository.create({
      ...input,
      organization_id: user.organizationId,
    });

    if (!result.success) {
      return result;
    }

    revalidatePath('/team');

    return { success: true, data: { id: result.data.id } };
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
