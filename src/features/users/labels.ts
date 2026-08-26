/**
 * USER ROLE LABELS AND CONSTANTS
 *
 * Centralized display labels and descriptions for user roles.
 */

import type { UserRole } from './types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  mechanic: 'Mechanic',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full system access',
  manager: 'Manage operations & earnings',
  mechanic: 'Handle maintenance tasks',
};

export const ROLE_VARIANTS = {
  admin: 'default' as const,
  manager: 'secondary' as const,
  mechanic: 'outline' as const,
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'Manage users and team members',
    'Full access to all features',
    'Configure system settings',
    'View and manage earnings',
    'Manage all operations',
  ],
  manager: [
    'Manage bikes, couriers, and assignments',
    'View and manage earnings',
    'Approve maintenance requests',
    'Track expenses',
    'Generate reports',
  ],
  mechanic: [
    'View assigned maintenance tasks',
    'Update maintenance status',
    'Record inspections',
    'View bike details',
  ],
};
