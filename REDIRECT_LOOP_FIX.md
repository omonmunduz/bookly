# Redirect Loop Fix - Team Member Login

## Problem

After implementing password-based user creation, new team members got stuck in an infinite redirect loop when trying to log in:

```
Error: Throttling navigation to prevent the browser from hanging
```

Browser console showed the app bouncing between routes repeatedly.

---

## Root Cause

**The redirect loop happened because:**

1. **Admin creates user** → `createUser()` with `email_confirm: true`
2. **User profile created** → Links user to organization in database ✅
3. **JWT token issued** → But `app_metadata` has NO `organization_id` ❌

4. **User logs in** → Gets session with empty `app_metadata`

5. **Middleware runs** (checks JWT claims):
   ```typescript
   const hasOrgClaim = Boolean(claims?.app_metadata?.organization_id);
   // hasOrgClaim = false ❌
   ```
   → Redirects to `/onboarding/setup`

6. **Page guard runs** (checks database):
   ```typescript
   const state = await getAuthState(); // Queries user_profiles
   // state.status = 'authenticated' (has org in DB) ✅
   ```
   → Redirects to `/dashboard`

7. **Middleware runs again** → Redirects to `/onboarding/setup`

8. **Infinite loop** 🔄

---

## The Solution

**Update JWT claims immediately after creating the user:**

```typescript
// BEFORE: Only created user profile
await repository.create({
  id: authData.user.id,
  organization_id: user.organizationId,
  role: input.role || 'mechanic',
});

// AFTER: Also update JWT claims
await adminClient.auth.admin.updateUserById(authData.user.id, {
  app_metadata: {
    organization_id: user.organizationId,  // ← Middleware needs this
    role: input.role || 'mechanic',        // ← RLS policies need this
  },
});
```

**Why this works:**

1. User created with password
2. User profile created in database
3. **JWT claims updated with org_id and role** ✅
4. User logs in → JWT has `organization_id` in `app_metadata`
5. Middleware sees org claim → Allows through
6. Page guard sees org in database → Allows through
7. User lands on dashboard ✅

---

## Technical Details

### **JWT Claims (app_metadata)**

Supabase stores custom data in the JWT's `app_metadata` field:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "app_metadata": {
    "organization_id": "org-uuid",  // ← Middleware checks this
    "role": "mechanic"               // ← RLS policies use this
  }
}
```

**Why it matters:**
- Middleware can't query the database (too slow for every request)
- Middleware checks JWT claims for fast routing decisions
- If claims don't match database, you get redirect loops

### **When Claims Get Updated**

JWT claims are updated by calling:
```typescript
await adminClient.auth.admin.updateUserById(userId, {
  app_metadata: { ... }
});
```

This happens in:
1. **Onboarding** - When user creates their organization (`onboarding-service.ts`)
2. **Team creation** - When admin creates a team member (`users.ts`) ← **Our fix**
3. **Role changes** - When admin updates a user's role (future feature)

---

## Files Changed

**File:** `src/app/actions/users.ts`

Added `updateUserById` call after profile creation:

```typescript
// Create the user profile immediately
const createResult = await repository.create({...});

// CRITICAL: Update JWT claims to prevent redirect loops
const { error: updateError } = await adminClient.auth.admin.updateUserById(
  authData.user.id,
  {
    app_metadata: {
      organization_id: user.organizationId,
      role: input.role || 'mechanic',
    },
  }
);
```

---

## Testing

### ✅ **Before Fix (Broken)**
```
1. Admin creates user with password
2. User logs in
3. Redirect loop ❌
4. Browser throttles navigation
5. User stuck, can't access app
```

### ✅ **After Fix (Working)**
```
1. Admin creates user with password
2. User logs in
3. Middleware sees org_id in JWT ✅
4. Page guard sees org in database ✅
5. User lands on dashboard ✅
```

---

## Why This Pattern Matters

This is the **same pattern** used in onboarding:

**`onboarding-service.ts` (lines 122-135):**
```typescript
// Step 4: Update auth.users.app_metadata with JWT claims
const { error: metadataError } = await adminClient.auth.admin.updateUserById(
  input.userId,
  {
    app_metadata: {
      organization_id: org.id,
      role: 'admin',
    },
  }
);
```

**Key principle:** Whenever you create a user profile with an organization, **always update their JWT claims** to match.

---

## Related Issues Prevented

This fix also prevents:

1. **RLS policy failures** - Policies read `auth.jwt() ->> 'organization_id'`
2. **Permission errors** - Guards check role from database but RLS uses JWT
3. **Session refresh issues** - Outdated claims after organization changes

---

## Summary

**Problem:** New team members stuck in redirect loop after login

**Cause:** JWT had no `organization_id` in `app_metadata`

**Fix:** Update `app_metadata` immediately after creating user profile

**Result:** Team members can log in and access dashboard immediately ✅

---

*Last updated: 2026-08-27*
