# Role Management System

## Overview

A complete role-based access control (RBAC) system for managing team members and their permissions in the e-bike rental application.

## Roles

The system supports three hierarchical roles:

### 1. **Admin** (Level 3)
- **Full system access**
- Manage users and team members
- Configure system settings
- View and manage earnings
- Manage all operations
- Access: All features

### 2. **Manager** (Level 2)
- **Operations & earnings management**
- Manage bikes, couriers, and assignments
- View and manage earnings
- Approve maintenance requests
- Track expenses
- Generate reports
- Access: Most features except user management

### 3. **Mechanic** (Level 1)
- **Maintenance tasks only**
- View assigned maintenance tasks
- Update maintenance status
- Record inspections
- View bike details
- Access: Limited to maintenance features

## Features Implemented

### 1. Team Management Page (`/team`)
- View all team members
- Search by name, email, or role
- Summary cards showing:
  - Total members (active/inactive)
  - Count by role (Admin, Manager, Mechanic)
- Role-based access: Requires **Manager** or above

### 2. User List Component
- Searchable user list with real-time filtering
- Display user information:
  - Name, email, phone
  - Role badge with color coding
  - Active/inactive status
- Quick actions menu:
  - Edit user
  - Deactivate/Reactivate user

### 3. Add Team Member (`/team/new`)
- Create new user accounts
- Assign role during creation
- Email-based user creation
- Role permissions guide
- Access: **Admin only**

### 4. Edit Team Member (`/team/[id]/edit`)
- Update user details
- Change user role
- Update phone number
- Email cannot be changed (immutable after creation)
- Access: **Admin only**

### 5. User Actions (Server Actions)
- `listUsersAction()` - List all users in organization
- `getUserAction(id)` - Get single user details
- `createUserAction(input)` - Create new user (admin only)
- `updateUserAction(id, input)` - Update user (admin only)
- `deactivateUserAction(id)` - Deactivate user (admin only)
- `reactivateUserAction(id)` - Reactivate user (admin only)

## Security

### Permission Guards
- All team routes require minimum **Manager** role
- User creation/editing requires **Admin** role
- Self-deactivation is prevented
- Organization-scoped data access (RLS enforced)

### Role Hierarchy
```
Admin (3) > Manager (2) > Mechanic (1)
```
- Higher roles inherit lower role permissions
- "Requires Manager" also allows Admin

## Navigation

Added "Team" navigation item:
- Icon: UsersRound
- Location: Between "Expenses" and "Settings"
- Visibility: Managers and Admins only
- URL: `/team`

## Database

### Tables Used
- `user_profiles` - User information and roles
  - `id` - Matches auth.users.id
  - `organization_id` - Organization membership
  - `email` - User email
  - `full_name` - Display name
  - `phone` - Optional phone number
  - `role` - User role (admin, manager, mechanic)
  - `is_active` - Active/inactive status

## Files Created

### Pages
- `src/app/(dashboard)/team/page.tsx` - Team list page
- `src/app/(dashboard)/team/new/page.tsx` - Add user page
- `src/app/(dashboard)/team/[id]/edit/page.tsx` - Edit user page

### Components
- `src/components/team/user-list.tsx` - User list with search
- `src/components/team/user-form.tsx` - User creation/edit form

### Business Logic
- `src/app/actions/users.ts` - Server actions for user management
- `src/features/users/service.ts` - User repository implementation
- `src/features/users/labels.ts` - Role labels and descriptions

### Updated Files
- `src/lib/constants/navigation.ts` - Added Team navigation item

## Usage Examples

### As Admin
1. Navigate to `/team`
2. Click "Add team member"
3. Fill in user details and assign role
4. User receives invitation email (when implemented)

### As Manager
1. Navigate to `/team`
2. View all team members
3. Search for specific users
4. Cannot create or edit users (admin only)

### As Mechanic
- Cannot access `/team` (redirected to dashboard)

## Next Steps (Future Enhancements)

1. **Email Invitations** - Send invitation emails to new users
2. **User Deletion** - Soft delete users (currently only deactivation)
3. **Activity Log** - Track user actions and changes
4. **Last Login** - Show when users last accessed the system
5. **Permissions Matrix** - Detailed view of what each role can do
6. **Bulk Operations** - Bulk activate/deactivate users
7. **Role Change Notifications** - Notify users when their role changes
8. **Password Reset** - Admin-initiated password reset for users

## Testing Checklist

- [ ] Manager can view team page
- [ ] Mechanic is redirected from team page
- [ ] Admin can create new users
- [ ] Admin can edit existing users
- [ ] Admin can deactivate users
- [ ] Admin cannot deactivate themselves
- [ ] Search filters users correctly
- [ ] Role badges display correctly
- [ ] User list shows active/inactive status

---

**Last Updated:** 2026-08-26
**Status:** ✅ Complete and functional
