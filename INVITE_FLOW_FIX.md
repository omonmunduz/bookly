# Team Invitation Flow - Fix Documentation

## Problem Summary

The team invitation system had a critical bug where invited users could accidentally create a **separate organization** instead of joining the one that invited them.

### The Bug

1. Admin sends invitation to `newuser@example.com`
2. Backend creates a `user_profile` record with `organization_id` already set
3. Supabase sends invite email with a link to set password
4. **BUT**: If the invited user:
   - Ignored the email and went to `/signup` directly, OR
   - Clicked the invite link but was prompted to "sign in" (confusing UX)
   
   They would go through the normal signup flow and create a **brand new organization**, orphaning the pre-created profile.

### Root Causes

1. **No collision detection**: The `createOrganizationAction` didn't check if the user already had a profile from an invitation
2. **Inconsistent URL handling**: Invite redirects used a different base URL resolution than other auth flows
3. **Confusing UX**: Invite links redirected to a callback that assumed authentication, but users hadn't set their password yet

---

## The Fix

### 1. **Prevent Duplicate Organization Creation** ✅

**File:** `src/app/actions/auth.ts`

Added a check in `createOrganizationAction` to detect if the user was already invited:

```typescript
// CRITICAL: Check if this user was invited to an organization
const { data: existingProfile } = await supabase
  .from('user_profiles')
  .select('id, organization_id, organization:organizations(id, name, slug)')
  .eq('id', user.id)
  .maybeSingle();

if (existingProfile && existingProfile.organization_id) {
  // User was invited! Redirect to dashboard instead of creating new org
  redirect(ROUTES.dashboard.home);
}
```

**Impact:** If an invited user somehow reaches the onboarding setup page, they're immediately redirected to their organization's dashboard.

---

### 2. **Consistent URL Resolution** ✅

**File:** `src/app/actions/users.ts`

Changed from manual URL building to using `getAppOrigin()`:

```typescript
// Before (inconsistent)
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// After (consistent with other auth flows)
redirectTo: `${getAppOrigin()}/auth/callback?type=invite`
```

**Impact:** Invite links now use the same production URL resolution as password reset and email verification.

---

### 3. **Guard-Level Protection** ✅

**File:** `src/features/auth/guards.ts`

Enhanced the `requireOnboardingUser` guard with better documentation:

```typescript
/**
 * IMPORTANT: This also blocks invited users who already have a profile
 * (with organization) from accidentally creating a new organization.
 */
```

The guard already had the correct logic (`authenticated` → redirect to dashboard), but now it's explicitly documented that this protects invited users.

---

### 4. **Better Documentation** ✅

**File:** `src/app/auth/callback/route.ts`

Added comprehensive comments explaining what happens during invite acceptance:

```typescript
// Team invitation accepted
// The invited user has:
// 1. Clicked the invite link from their email
// 2. Set their password (handled by Supabase's invite email flow)
// 3. Been automatically logged in with a session
// Their user_profile was pre-created with the organization_id
```

---

## How It Works Now

### **Successful Invite Flow**

1. **Admin sends invite**
   - `inviteUserByEmail` creates auth user
   - `user_profile` created with `organization_id` already set
   - Supabase sends invite email

2. **User clicks invite link**
   - Link includes magic token: `/auth/callback?type=invite&code=...`
   - Supabase's invite email includes password-setting UI
   - After setting password, user is logged in automatically
   - Callback exchanges code for session
   - User redirected to dashboard

3. **User sees their organization**
   - `getAuthState()` loads their profile with `organization_id`
   - They're immediately a member of the inviting organization
   - No onboarding flow, no new organization created

---

### **Protection Against Wrong Path**

If an invited user somehow tries to create a new organization:

```
User → /signup (instead of clicking invite link)
  ↓
Signs up with email
  ↓
/onboarding/setup loads
  ↓
requireOnboardingUser() runs
  ↓
getAuthState() returns 'authenticated' (profile exists with org)
  ↓
Guard redirects to /dashboard ✅
  ↓
User lands in their invited organization
```

**Secondary protection:**

```
User → somehow bypasses guard
  ↓
Submits organization name
  ↓
createOrganizationAction() runs
  ↓
Checks for existing profile with organization_id
  ↓
Finds one! → redirect(/dashboard) ✅
```

---

## Required Configuration

### **Environment Variables (Vercel)**

Set in Vercel project settings → Environment Variables:

```env
NEXT_PUBLIC_APP_URL=https://bookly-six-beige.vercel.app
```

**Why:** The `getAppOrigin()` function requires this to build absolute URLs for invite emails. Without it, invites will fail with an error instead of silently using localhost.

---

### **Supabase Dashboard Configuration**

1. Go to **Authentication → URL Configuration**
2. Add to **Redirect URLs**:
   - `https://bookly-six-beige.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)

**Why:** Supabase only allows redirects to whitelisted URLs. If the callback URL isn't whitelisted, Supabase silently substitutes the project's default Site URL (which might be localhost).

---

## Testing Checklist

### ✅ Scenario 1: Normal Invite (Happy Path)
1. Admin invites `newuser@example.com`
2. User receives email
3. User clicks link → sets password
4. User lands on dashboard
5. **Verify:** User sees the inviting organization's name
6. **Verify:** User's role is what admin set (not "owner")

### ✅ Scenario 2: Invited User Goes to Signup Instead
1. Admin invites `newuser@example.com`
2. User ignores email
3. User goes to `/signup` directly
4. User signs up with same email
5. **Verify:** User is redirected to dashboard (NOT onboarding)
6. **Verify:** User sees the inviting organization (NOT a new one)

### ✅ Scenario 3: Invited User Tries Onboarding URL
1. Admin invites `newuser@example.com`
2. User somehow navigates to `/onboarding/setup`
3. **Verify:** User is immediately redirected to dashboard
4. **Verify:** No second organization is created

### ✅ Scenario 4: Production URL in Emails
1. Admin invites user from production
2. User receives email
3. **Verify:** Email link points to `bookly-six-beige.vercel.app` (NOT localhost)

---

## Known Limitations

### **Supabase Invite Email Template**

Supabase sends a default email template that includes:
- A link to set password
- The redirect URL after password is set

**Customization:** You can customize this template in the Supabase dashboard under **Authentication → Email Templates → Invite user**. Consider adding:
- Your branding
- A clear message: "You've been invited to join [Organization Name]"
- Instructions about what happens next

---

## Related Files Changed

- ✅ `src/app/actions/auth.ts` - Added invite collision detection
- ✅ `src/app/actions/users.ts` - Consistent URL resolution + import `getAppOrigin`
- ✅ `src/app/auth/callback/route.ts` - Better documentation
- ✅ `src/features/auth/guards.ts` - Enhanced comments

---

## Next Steps

After this fix is deployed:

1. **Test in production** with the checklist above
2. **Customize invite email** in Supabase dashboard (optional)
3. **Monitor for edge cases** - watch for users reporting confusion
4. **Consider UX improvement**: Add a "check your email" message after admin sends invite

---

*Last updated: 2026-08-27*
