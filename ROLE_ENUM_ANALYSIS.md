# 🔍 Analysis: user_role enum mismatch

## THE PROBLEM

**Error:** `"Failed to create user profile: invalid input value for enum user_role: 'owner'"`

**Root Cause:** Migration 20260821000004 changed the `user_role` enum from:
- OLD: `('owner', 'admin', 'manager', 'employee')`
- NEW: `('admin', 'manager', 'mechanic')`

But the **onboarding service** still tries to insert `role: 'owner'` when creating new users.

---

## FINDINGS

### 1. Database Schema (CORRECT - after migration)
**File:** `supabase/migrations/20260821000004_roles_rls_and_cleanup.sql:104`
```sql
CREATE TYPE user_role_new AS ENUM ('admin', 'manager', 'mechanic');
```

Migration maps old roles to new:
- `owner` → `admin`
- `admin` → `admin`
- `manager` → `manager`
- `employee` → `mechanic`

### 2. Onboarding Service (BROKEN - still uses 'owner')
**File:** `src/features/auth/onboarding-service.ts:114, 128`
```typescript
// Line 114 - inserting user profile
role: 'owner',

// Line 128 - updating app_metadata
role: 'owner',
```

### 3. TypeScript Types (OUTDATED)
**File:** `src/features/users/types.ts:20`
```typescript
export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';
```

**File:** `src/features/users/schemas.ts:10`
```typescript
export const userRoleSchema = z.enum(['owner', 'admin', 'manager', 'employee']);
```

**File:** `src/lib/database.types.ts:953`
```typescript
user_role: "owner" | "admin" | "manager" | "employee"
```

### 4. Business Logic (OUTDATED)
**File:** `src/features/users/business-rules.ts`
- Line 56: `if (actor.role === 'admin' && targetUser.role === 'owner')`
- Line 76: `if (newRole === 'owner' && actor.role !== 'owner')`
- Line 145: `if (targetUser.role === 'owner' && ownerCount <= 1)`
- Line 227: `owner: 'Owner',`

**File:** `src/features/auth/guards.ts:20`
```typescript
import { ROLE_LEVEL, hasRole, isOwner } from './roles';
```

**File:** `src/features/auth/roles.ts:38`
```typescript
return user.role === 'owner';
```

### 5. Old Migrations (HISTORICAL - no longer relevant)
- `20260726000001_schema.sql:28` - Original enum with 'owner'
- `20260726000002_auth_helpers.sql:61` - has_role_or_above function with 'owner'
- Multiple RLS policies referencing 'owner'

---

## DECISION: 'owner' is OBSOLETE

Based on the migration history and e-bike rental domain:
- ✅ The NEW enum (`admin`, `manager`, `mechanic`) is CORRECT for the e-bike rental system
- ❌ The 'owner' role is a leftover from the wholesale business domain
- ✅ Migration correctly maps `owner` → `admin`
- ❌ Application code was NOT updated to match

**The first user should be created as `'admin'`, not `'owner'`.**

---

## FIXES NEEDED

### 1. Fix Onboarding Service (CRITICAL - fixes the immediate error)
**File:** `src/features/auth/onboarding-service.ts`

Line 114:
```diff
- role: 'owner',
+ role: 'admin',
```

Line 128:
```diff
- role: 'owner',
+ role: 'admin',
```

### 2. Update TypeScript Types
**File:** `src/features/users/types.ts`
```diff
- export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';
+ export type UserRole = 'admin' | 'manager' | 'mechanic';
```

**File:** `src/features/users/schemas.ts`
```diff
- export const userRoleSchema = z.enum(['owner', 'admin', 'manager', 'employee']);
+ export const userRoleSchema = z.enum(['admin', 'manager', 'mechanic']);
```

**File:** `src/lib/database.types.ts` (regenerate from Supabase schema)

### 3. Update Business Logic
**File:** `src/features/users/business-rules.ts`
- Remove all 'owner' checks
- Update role hierarchy to: admin > manager > mechanic
- Update role labels

**File:** `src/features/auth/roles.ts`
- Remove `isOwner()` function
- Update role level hierarchy

**File:** `src/features/auth/guards.ts`
- Remove isOwner import/export

### 4. Regenerate Database Types
```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

---

## MIGRATION NOT NEEDED

The database is CORRECT. This is purely an application code fix.

---

## NEXT STEPS

1. Fix onboarding service (lines 114, 128) - **CRITICAL**
2. Update TypeScript types and schemas
3. Update business logic to remove 'owner' references
4. Regenerate database types from schema
5. Test user registration flow
