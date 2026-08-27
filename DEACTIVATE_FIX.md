# Deactivate/Reactivate User Fix

## Problem

The team member list had "Deactivate" and "Reactivate" actions that linked to non-existent pages:
- `/team/[id]/deactivate` → 404
- `/team/[id]/reactivate` → 404

These pages were never created, causing a broken user experience.

---

## Solution

Replaced navigation to separate pages with **inline confirmation dialogs**.

### Benefits
1. **No navigation** - Users stay on the team list page
2. **Immediate feedback** - Toast notifications confirm success
3. **Better UX** - Fewer clicks, faster actions
4. **Error handling** - Errors shown in the dialog without losing context
5. **Simpler codebase** - No need to create/maintain separate pages

---

## Changes Made

### **File: `src/components/team/user-list.tsx`**

#### **1. Added Dependencies**
```typescript
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deactivateUserAction, reactivateUserAction } from '@/app/actions/users';
import { useToast } from '@/hooks/use-toast';
```

#### **2. Replaced Navigation Links with Click Handlers**

**Before:**
```typescript
<DropdownMenuItem asChild>
  <Link href={`/team/${user.id}/deactivate`}>
    <UserX className="mr-2 h-4 w-4" />
    Deactivate
  </Link>
</DropdownMenuItem>
```

**After:**
```typescript
<DropdownMenuItem onClick={() => setDeactivateDialogOpen(true)}>
  <UserX className="mr-2 h-4 w-4" />
  Deactivate
</DropdownMenuItem>
```

#### **3. Added State Management**
```typescript
const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
const [isPending, startTransition] = useTransition();
const [error, setError] = useState<string | null>(null);
const { toast } = useToast();
```

#### **4. Added Action Handlers**
```typescript
const handleDeactivate = () => {
  setError(null);
  startTransition(async () => {
    const result = await deactivateUserAction(user.id);

    if (!result.success) {
      setError(result.error);
    } else {
      setDeactivateDialogOpen(false);
      toast({
        title: 'User deactivated',
        description: `${user.full_name} has been deactivated.`,
      });
    }
  });
};
```

#### **5. Added Confirmation Dialogs**
```typescript
<ConfirmDialog
  open={deactivateDialogOpen}
  onOpenChange={setDeactivateDialogOpen}
  title="Deactivate user"
  description={`Are you sure you want to deactivate ${user.full_name}? They will lose access to the system but their data will be preserved.`}
  confirmLabel="Deactivate"
  destructive
  isPending={isPending}
  error={error}
  onConfirm={handleDeactivate}
/>
```

---

## How It Works Now

### **Deactivate Flow**

1. Admin clicks "Deactivate" from dropdown menu
2. **Confirmation dialog appears** with user's name
3. Admin clicks "Deactivate" button
4. Button shows loading spinner
5. Server action executes
6. On success:
   - Dialog closes
   - Toast notification appears: "User deactivated"
   - Page automatically refreshes (via `revalidatePath`)
   - User row shows "Inactive" badge
7. On error:
   - Dialog stays open
   - Error message displayed inline
   - Admin can retry or cancel

### **Reactivate Flow**

Same as deactivate, but:
- Different confirmation message
- Non-destructive styling (default button, not red)
- Toast: "User reactivated"
- User row shows active state

---

## User Experience Improvements

| Before | After |
|--------|-------|
| Click "Deactivate" → Navigate to new page → Confirm → Navigate back | Click "Deactivate" → Confirm in dialog → Done |
| 404 error on click | Smooth inline confirmation |
| Lost context (left the team list) | Stays on team list |
| No feedback on success | Toast notification |
| Errors required back navigation | Errors shown inline, can retry |

---

## Technical Details

### **Server Actions Used**
- `deactivateUserAction(id: string)` - Sets `is_active = false`
- `reactivateUserAction(id: string)` - Sets `is_active = true`

Both actions:
- ✅ Check admin permissions
- ✅ Prevent self-deactivation
- ✅ Return `Result<void>` for error handling
- ✅ Call `revalidatePath('/team')` to refresh the UI

### **React Patterns**
- **`useTransition`** - For pending state without blocking UI
- **`useState`** - For dialog open/closed state and errors
- **`useToast`** - For success notifications
- **Controlled dialogs** - Open state managed by parent component

### **Accessibility**
- ✅ Confirmation required before destructive action
- ✅ Clear labels ("Deactivate user" not just "Confirm")
- ✅ Keyboard navigation (Escape to cancel)
- ✅ Focus management (dialog traps focus)
- ✅ Loading states (buttons disabled while pending)

---

## Testing Checklist

### ✅ Deactivate User
- [ ] Click "Deactivate" from dropdown
- [ ] Dialog appears with user's full name
- [ ] "Deactivate" button is red (destructive)
- [ ] Click "Cancel" → dialog closes, nothing happens
- [ ] Click "Deactivate" → button shows spinner
- [ ] On success: toast appears, user shows "Inactive" badge
- [ ] Dropdown now shows "Reactivate" option
- [ ] Cannot deactivate yourself (error in dialog)

### ✅ Reactivate User
- [ ] Inactive user has "Reactivate" option
- [ ] Click "Reactivate" → dialog appears
- [ ] Click "Reactivate" → button shows spinner
- [ ] On success: toast appears, "Inactive" badge removed
- [ ] Dropdown now shows "Deactivate" option

### ✅ Error Handling
- [ ] If server action fails, error shows in dialog
- [ ] Dialog stays open after error
- [ ] Can click "Deactivate" again to retry
- [ ] Can click "Cancel" to close without retrying

### ✅ Permission Checks
- [ ] Only admins can deactivate users
- [ ] Non-admins don't see deactivate option

---

## Files Changed

- ✅ `src/components/team/user-list.tsx` - Updated to use inline dialogs

---

## Related Components

- `src/components/ui/confirm-dialog.tsx` - Reusable confirmation dialog (already existed)
- `src/hooks/use-toast.ts` - Toast notification system (already existed)
- `src/app/actions/users.ts` - Server actions for deactivate/reactivate (already existed)

---

## Future Enhancements (Optional)

1. **Bulk actions** - Deactivate multiple users at once
2. **Activity log** - Show when user was deactivated and by whom
3. **Soft delete grace period** - Allow undoing deactivation for 24 hours
4. **Email notification** - Notify user when they're deactivated
5. **Reason field** - Require admin to provide reason for deactivation

---

*Last updated: 2026-08-27*
