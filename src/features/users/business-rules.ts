/**
 * USER BUSINESS RULES
 *
 * Domain logic for user management and permissions
 */

import type { User, UserRole } from './types';
import type { Organization } from '@/features/organizations/types';
import type { Result } from '@/lib/types/common';

/**
 * Role hierarchy levels
 * Higher number = more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  mechanic: 1,
};

/**
 * Check if user has a specific role or higher
 */
export function hasRole(user: User, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can manage (invite/edit/remove) other users
 *
 * Rules:
 * - Only admins can manage users
 * - Users cannot change their own role
 */
export function canManageUser(actor: User, targetUser: User): Result<void> {
  // Must be admin
  if (!hasRole(actor, 'admin')) {
    return {
      success: false,
      error: 'Only admins can manage users',
    };
  }

  // Cannot manage yourself
  if (actor.id === targetUser.id) {
    return {
      success: false,
      error: 'You cannot manage your own account. Ask another admin.',
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if user can change role to a specific role
 *
 * Rules:
 * - Admin can assign admin/manager/mechanic
 * - Cannot escalate to role higher than your own
 */
export function canAssignRole(actor: User, newRole: UserRole): Result<void> {
  // Cannot assign role higher than your own
  if (ROLE_HIERARCHY[newRole] > ROLE_HIERARCHY[actor.role]) {
    return {
      success: false,
      error: `You cannot assign a role higher than your own (${actor.role})`,
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if user can invite new users to organization
 *
 * Rules:
 * - Only admins can invite
 * - Check organization user limits (Phase 2)
 */
export function canInviteUser(
  actor: User,
  organization: Organization,
  currentUserCount: number
): Result<void> {
  // Only admins can invite
  if (!hasRole(actor, 'admin')) {
    return {
      success: false,
      error: 'Only admins can invite users',
    };
  }

  // Check user limits (Phase 2)
  const maxUsers = organization.settings.limits?.max_users;
  if (maxUsers && currentUserCount >= maxUsers) {
    return {
      success: false,
      error: `User limit reached (${maxUsers}). Upgrade your plan to add more users.`,
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if user can delete another user
 *
 * Rules:
 * - Same as canManageUser
 * - Cannot delete the last admin
 */
export function canDeleteUser(
  actor: User,
  targetUser: User,
  adminCount: number
): Result<void> {
  // Check basic manage permission
  const manageResult = canManageUser(actor, targetUser);
  if (!manageResult.success) {
    return manageResult;
  }

  // Cannot delete last admin
  if (targetUser.role === 'admin' && adminCount <= 1) {
    return {
      success: false,
      error: 'Cannot delete the last admin. Assign another admin first.',
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if user can access a specific resource
 * Generic permission check for various resources
 */
export function canAccessResource(
  user: User,
  resource: 'products' | 'customers' | 'sales' | 'payments' | 'expenses' | 'reports',
  action: 'view' | 'create' | 'update' | 'delete'
): boolean {
  // All users can view all resources
  if (action === 'view') {
    return true;
  }

  // Resource-specific rules
  switch (resource) {
    case 'products':
      // Managers and above can manage products
      if (action === 'create' || action === 'update' || action === 'delete') {
        return hasRole(user, 'manager');
      }
      return true;

    case 'customers':
      // All users can create/update customers
      // Only managers+ can delete
      if (action === 'delete') {
        return hasRole(user, 'manager');
      }
      return true;

    case 'sales':
      // All users can create sales
      // Employees can only update their own sales (checked separately)
      // Managers+ can update any sale
      return true;

    case 'payments':
      // All users can record payments
      // Only managers+ can update/delete
      if (action === 'update' || action === 'delete') {
        return hasRole(user, 'manager');
      }
      return true;

    case 'expenses':
      // Only managers and above can manage expenses
      return hasRole(user, 'manager');

    case 'reports':
      // All users can view reports
      // Employees see limited reports (checked separately)
      return true;

    default:
      return false;
  }
}

/**
 * Get user's display name
 * Fallback to email if name not set
 */
export function getDisplayName(user: User): string {
  return user.full_name || user.email;
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    mechanic: 'Mechanic',
  };
  return names[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full access to all features and settings. Can manage users and all business data.',
    manager: 'Operational access. Can manage couriers, bikes, assignments, and earnings. Can view reports.',
    mechanic: 'Maintenance-focused. Can view bikes, perform inspections, and record maintenance. No financial access.',
  };
  return descriptions[role];
}

/**
 * Check if user account is usable
 */
export function isUserActive(user: User): Result<void> {
  if (!user.is_active) {
    return {
      success: false,
      error: 'This user account has been deactivated. Contact your administrator.',
    };
  }

  if (user.deleted_at) {
    return {
      success: false,
      error: 'This user account has been deleted.',
    };
  }

  return { success: true, data: undefined };
}
