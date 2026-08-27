# Team User Management - Delete & Resend Invite Features

## Overview

Added two critical features to team management:

1. **Delete User Permanently** - Hard delete for cleaning up failed invitations or test users
2. **Resend Invitation** - Generate a new invite link when the original expires or is lost

---

## Problem: Expired Invite Links

### The Issue

When testing the invite flow, we discovered:

```
Error URL: /login?error=missing_code#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
```

**Root cause:** Supabase's `inviteUserByEmail` generates a magic link that expires after a short period (default: 1 hour). If the user doesn't click the link in time, they're locked out.

### The Solution

Added a **"Resend invite"** action that:
- Generates a fresh invite link
- Sends a new email to the user
- Works even if the previous link expired
- Detects if user already accepted (and shows appropriate error)

---

## Features Added

### 1. **Resend Invitation** ✅

**Purpose:** Send a new invite email when the previous one expired or was lost.

**File:** `src/app/actions/users.ts`

```typescript
export async function resendInviteAction(id: string): Promise<Result<void>>
```

**How it works:**
1. Admin clicks "Resend invite" from user dropdown
2. Backend calls `inviteUserByEmail` again with same user data
3. Supabase generates a fresh magic link
4. New email sent to user's inbox
5. User can click the new link and set their password

**Error handling:**
- ✅ Detects if user already confirmed their email
- ✅ Shows appropriate error: "This user has already accepted their invitation"
- ✅ Prevents duplicate invites to registered users

---

### 2. **Delete User Permanently** ✅

**Purpose:** Permanently remove users who haven't started using the system.

**File:** `src/app/actions/users.ts`

```typescript
export async function deleteUserAction(id: string): Promise<Result<void>>
```

**How it works:**
1. Deletes from `user_profiles` table
2. Deletes from `auth.users` table (Supabase Auth)
3. Removes all sessions
4. Cannot be undone

**Safety checks:**
- ✅ Only admins can delete users
- ✅ Cannot delete yourself
- ✅ Confirmation dialog with warning
- ✅ Suggests deactivation as safer alternative

**When to use:**
- Failed invitations (user never accepted)
- Test users created during development
- Duplicate accounts created by mistake
- Users who should never have been invited

**When NOT to use:**
- Users with activity/data in the system
- Users who have logged in before
- **Instead:** Use "Deactivate" (soft delete)

---

### 3. **Repository Delete Method** ✅

**File:** `src/features/users/service.ts`

Added permanent delete method to `UsersRepository`:

```typescript
async delete(id: string): Promise<Result<void>>
```

This allows the action to delete the user profile before removing from auth.users.

---

## UI Changes

### **User Dropdown Menu**

**File:** `src/components/team/user-list.tsx`

Added two new actions to the dropdown:

```
┌─────────────────────────┐
│ Actions                 │
├─────────────────────────┤
│ ✏️  Edit user           │
│ ✉️  Resend invite       │  ← NEW
│ ❌ Deactivate           │
├─────────────────────────┤
│ 🗑️  Delete permanently  │  ← NEW (destructive)
└─────────────────────────┘
```

**Visual cues:**
- "Resend invite" - Normal item with mail icon
- "Delete permanently" - Red text (destructive styling) at bottom

---

## User Experience

### **Resend Invite Flow**

1. Admin goes to `/team`
2. Finds user who hasn't accepted invite
3. Clicks "⋮" menu → "Resend invite"
4. Confirmation dialog appears:
   ```
   Resend invitation
   
   Send a new invitation email to user@example.com?
   This will generate a fresh link if their previous invite expired.
   
   [Cancel]  [Resend invite]
   ```
5. Admin clicks "Resend invite"
6. Loading spinner appears
7. On success:
   - Toast: "Invitation resent - A new invitation email has been sent to user@example.com"
   - User receives fresh email with new link
8. On error (user already accepted):
   - Error shown in dialog: "This user has already accepted their invitation and set a password. They can log in directly."

---

### **Delete User Flow**

1. Admin goes to `/team`
2. Clicks "⋮" menu → "Delete permanently"
3. **Warning dialog** appears:
   ```
   Delete user permanently
   
   Are you sure you want to permanently delete John Doe?
   This action cannot be undone. All their data and history will be removed.
   
   ⚠️ Warning: This action is irreversible!
   Consider deactivating the user instead to preserve their data.
   
   [Cancel]  [Delete permanently]
   ```
4. Admin reads warning
5. Admin clicks "Delete permanently"
6. Loading spinner appears
7. On success:
   - Toast: "User deleted - John Doe has been permanently deleted"
   - User removed from list
   - User removed from auth.users
   - All sessions invalidated

---

## Technical Implementation

### **Server Actions**

Both actions follow the same security pattern:

```typescript
// 1. Get repository and current user
const { repository, user } = await getRepository();

// 2. Check admin permissions
if (user.role !== 'admin') {
  return { success: false, error: 'Only admins can...' };
}

// 3. Prevent self-targeting
if (id === user.id) {
  return { success: false, error: 'You cannot ... yourself' };
}

// 4. Perform action
// ...

// 5. Revalidate cache
revalidatePath('/team');
```

### **Error Handling**

**Resend Invite:**
- `already registered` → User already confirmed, show helpful message
- Other errors → Display Supabase error message

**Delete User:**
- Profile delete fails → Show error, don't proceed to auth.users
- Auth.users delete fails → Show error (profile already deleted, but auth remains)

### **UI State Management**

Each action uses React patterns:
- `useState` for dialog open/closed
- `useTransition` for pending state
- `useToast` for success notifications
- Inline error display in dialogs

---

## Database Impact

### **Delete User:**

```sql
-- 1. user_profiles deletion
DELETE FROM user_profiles 
WHERE id = $1 AND organization_id = $2;

-- 2. auth.users deletion (via Supabase Admin API)
-- This cascades to delete sessions automatically
```

**Foreign key references:**
- `created_by` columns → Set to NULL (already configured as `ON DELETE SET NULL`)
- No data loss on related records (sales, payments, etc.)

### **Resend Invite:**

No database changes - just triggers a new Supabase email with fresh token.

---

## Testing Checklist

### ✅ Resend Invite
- [ ] User hasn't accepted invite yet → New email sent successfully
- [ ] User's previous link expired → New link works
- [ ] User already accepted invite → Error: "already accepted"
- [ ] User already logged in → Error: "already accepted"
- [ ] Toast notification appears on success
- [ ] Email arrives with correct production URL

### ✅ Delete User
- [ ] Admin can delete inactive users
- [ ] Admin can delete users who never logged in
- [ ] Warning dialog shows with red styling
- [ ] Cannot delete yourself → Error shown
- [ ] Non-admin cannot see delete option
- [ ] User removed from team list after delete
- [ ] User cannot log in after being deleted
- [ ] Related records preserve audit trail (created_by = NULL)

### ✅ Edge Cases
- [ ] Deleting user who has assignments/sales → Should work (ON DELETE SET NULL)
- [ ] Resending to already-deleted user → Error
- [ ] Multiple rapid clicks → Button disabled while pending
- [ ] Network error during delete → Error shown, can retry

---

## Security Considerations

### **Admin Only**

Both actions are restricted to admin role:
```typescript
if (user.role !== 'admin') {
  return { success: false, error: 'Only admins can...' };
}
```

### **Self-Protection**

Cannot delete yourself:
```typescript
if (id === user.id) {
  return { success: false, error: 'You cannot delete yourself' };
}
```

### **Organization Isolation**

Repository scoped to organization:
```typescript
.eq('organization_id', this.organizationId)
```

Users can only delete team members from their own organization.

---

## Files Changed

1. ✅ `src/app/actions/users.ts` - Added `deleteUserAction` and `resendInviteAction`
2. ✅ `src/features/users/service.ts` - Added `delete()` method to repository
3. ✅ `src/components/team/user-list.tsx` - Added UI for both actions with confirmation dialogs

---

## Addressing the Original Issue

### **Problem:** Invite link showing expired error

```
error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
```

### **Solution:** Resend invite action

1. Admin sees user hasn't accepted
2. Admin clicks "Resend invite"
3. User gets new email with fresh link
4. User clicks new link → sets password → logs in ✅

### **Alternative:** Increase invite expiry (Supabase setting)

Go to Supabase Dashboard → Authentication → Email Templates:
- Default: 1 hour
- Can increase to 24 hours or 7 days
- Trade-off: Security vs convenience

---

## Best Practices

### **When to Delete:**
- ❌ User logged in before → Use **Deactivate** instead
- ❌ User has activity → Use **Deactivate** instead
- ✅ Failed invitation → **Delete** is appropriate
- ✅ Test account → **Delete** is appropriate
- ✅ Wrong email address → **Delete** and re-invite correctly

### **When to Resend:**
- ✅ User says "I never got the email"
- ✅ Link expired (after 1 hour)
- ✅ User accidentally deleted the email
- ❌ User already set password → They can use login page

---

## Future Enhancements

1. **Show invite status** - Badge: "Pending invite" vs "Active"
2. **Track invite attempts** - Log how many times invite was resent
3. **Custom invite expiry** - Let admin choose link lifetime
4. **Bulk invite** - Invite multiple users at once
5. **Invite history** - See when invites were sent and by whom

---

*Last updated: 2026-08-27*
