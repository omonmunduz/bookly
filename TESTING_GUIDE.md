# TESTING MIGRATIONS 20260828000001 & 20260828000002

**Date:** 2026-08-28  
**Migrations to Test:**
1. `20260828000001_add_returned_status.sql` - Add 'returned' bike status
2. `20260828000002_create_audit_logs.sql` - Create audit logging system

---

## PREREQUISITES

- ✅ Supabase project linked: `gfvjkrdjrewsborapdsu`
- ✅ Access to Supabase Dashboard
- ✅ Migrations written and verified locally

---

## METHOD 1: SUPABASE DASHBOARD (RECOMMENDED)

### Step 1: Access SQL Editor

1. Go to: https://supabase.com/dashboard/project/gfvjkrdjrewsborapdsu
2. Navigate to **SQL Editor** in left sidebar
3. Click **+ New query**

### Step 2: Apply Migration 1 (Returned Status)

1. **Open the migration file:**
   - File: `supabase/migrations/20260828000001_add_returned_status.sql`
   - Copy entire contents

2. **Paste into SQL Editor**

3. **Run the migration** (click Run or Ctrl+Enter)

4. **Verify success:**
   - Look for green checkmarks
   - Should see: `✓ Migration successful: "returned" status added, trigger updated, view created`

5. **Check results:**
   ```sql
   -- Verify 'returned' status exists
   SELECT enumlabel FROM pg_enum e
   JOIN pg_type t ON t.oid = e.enumtypid
   WHERE t.typname = 'bike_status'
   ORDER BY e.enumsortorder;
   -- Should show: available, assigned, returned, maintenance, damaged, retired
   
   -- Verify view exists
   SELECT * FROM bikes_awaiting_inspection LIMIT 1;
   -- Should return empty result (no bikes in 'returned' status yet)
   ```

### Step 3: Apply Migration 2 (Audit Logs)

1. **Open the migration file:**
   - File: `supabase/migrations/20260828000002_create_audit_logs.sql`
   - Copy entire contents

2. **Paste into SQL Editor**

3. **Run the migration** (click Run or Ctrl+Enter)

4. **Verify success:**
   - Look for: `✓ Migration successful: audit_logs table, indexes, helper function, and RLS created`

5. **Check results:**
   ```sql
   -- Verify table exists
   SELECT * FROM audit_logs LIMIT 1;
   -- Should return empty result (no logs yet)
   
   -- Verify indexes
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'audit_logs';
   -- Should show 5 indexes
   
   -- Verify function exists
   SELECT proname FROM pg_proc WHERE proname = 'log_audit_event';
   -- Should return: log_audit_event
   ```

### Step 4: Run Test Suite

1. **Open test script:**
   - File: `supabase/TEST_MIGRATIONS.sql`
   - Copy entire contents

2. **Paste into SQL Editor**

3. **Run the tests**

4. **Review results:**
   - All tests should show `✓ TEST X PASSED`
   - If any fail, review error messages
   - Test 10 may be skipped if no data exists yet

---

## METHOD 2: VERIFY VIA APPLICATION

### Test 1: Check TypeScript Compilation

```bash
npm run type-check
```

**Expected:** No errors (already verified ✅)

### Test 2: Start Development Server

```bash
npm run dev
```

**Expected:** Server starts without errors

### Test 3: Access Dashboard

1. Open: http://localhost:3000
2. Log in with existing account
3. Navigate to dashboard

**Expected:**
- Dashboard loads without errors
- "Bikes Awaiting Inspection" widget appears (empty state if no returned bikes)
- Fleet status shows 'Returned: 0'

### Test 4: Test Bike Return Workflow

**If you have test data:**

1. **Navigate to Assignments page**
2. **Find an active assignment**
3. **Click "Return Bike"**
4. **Submit return form with condition notes**

**Expected Results:**
- Assignment marked as returned
- Bike status should be 'returned' (not 'available')
- Bike appears in "Bikes Awaiting Inspection" widget
- Dashboard shows alert for bikes awaiting inspection

**Verify in database:**
```sql
-- Check bike status
SELECT bike_number, status FROM bikes WHERE status = 'returned';

-- Check audit log was created
SELECT * FROM audit_logs
WHERE action = 'ASSIGNMENT_RETURNED'
ORDER BY created_at DESC
LIMIT 1;
```

### Test 5: Test Inspection Workflow

1. **From dashboard, click "Inspect" on a returned bike**
2. **Fill out inspection form**
3. **Submit with condition (good/maintenance/damaged)**

**Expected Results:**
- Bike status changes from 'returned' to selected status
- Bike disappears from "Bikes Awaiting Inspection" widget
- Audit log created for inspection

**Verify in database:**
```sql
-- Check bike status changed
SELECT bike_number, status FROM bikes WHERE bike_number = 'EB-XXX';
-- Should show new status (not 'returned')

-- Check audit log
SELECT * FROM audit_logs
WHERE action = 'INSPECTION_CREATED'
ORDER BY created_at DESC
LIMIT 1;
```

---

## METHOD 3: MANUAL VERIFICATION QUERIES

Run these in Supabase SQL Editor to verify everything works:

### Query 1: Check Enum Values
```sql
SELECT
  t.typname as enum_type,
  e.enumlabel as value,
  e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'bike_status'
ORDER BY e.enumsortorder;
```

**Expected:**
```
enum_type   | value       | sort_order
------------|-------------|------------
bike_status | available   | 1
bike_status | assigned    | 2
bike_status | returned    | 3
bike_status | maintenance | 4
bike_status | damaged     | 5
bike_status | retired     | 6
```

### Query 2: Check Trigger Function
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'fn_bike_assignment_return';
```

**Expected:** Function body contains `status = 'returned'`

### Query 3: Check Audit Logs Schema
```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;
```

**Expected:** 11 columns with correct types

### Query 4: Test Audit Logging Function
```sql
-- Only run if you have test data
SELECT log_audit_event(
  p_organization_id := (SELECT id FROM organizations LIMIT 1),
  p_actor_user_id := (SELECT id FROM user_profiles LIMIT 1),
  p_action := 'TEST_MIGRATION',
  p_entity_type := 'test',
  p_entity_id := gen_random_uuid(),
  p_entity_name := 'Migration Test',
  p_metadata := '{"test": true, "migration": "20260828000002"}'::jsonb
);

-- Verify it was created
SELECT * FROM audit_logs WHERE action = 'TEST_MIGRATION';

-- Clean up
DELETE FROM audit_logs WHERE action = 'TEST_MIGRATION';
```

---

## ROLLBACK PROCEDURE (IF NEEDED)

### Rollback Migration 2 (Audit Logs)

```sql
-- Drop view
DROP VIEW IF EXISTS recent_audit_activity;

-- Drop RLS policies
DROP POLICY IF EXISTS "audit_logs_select_manager_or_above" ON audit_logs;

-- Drop function
DROP FUNCTION IF EXISTS log_audit_event;

-- Drop indexes
DROP INDEX IF EXISTS idx_audit_logs_org_time;
DROP INDEX IF EXISTS idx_audit_logs_actor_time;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_metadata;

-- Drop table
DROP TABLE IF EXISTS audit_logs;
```

### Rollback Migration 1 (Returned Status)

```sql
-- Move any 'returned' bikes to 'available'
UPDATE bikes SET status = 'available' WHERE status = 'returned';

-- Drop view
DROP VIEW IF EXISTS bikes_awaiting_inspection;

-- Restore old trigger function
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE bikes SET status = 'available', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Cannot remove enum value 'returned' (PostgreSQL limitation)
-- It will remain in the enum but won't be used
```

---

## POST-MIGRATION CHECKLIST

After successfully applying both migrations:

### Database Verification
- [ ] Migration 1 applied successfully
- [ ] Migration 2 applied successfully
- [ ] All test queries pass
- [ ] No SQL errors in logs

### Application Verification
- [ ] TypeScript compiles without errors
- [ ] Development server starts
- [ ] Dashboard loads correctly
- [ ] "Bikes Awaiting Inspection" widget visible (empty state OK)
- [ ] Fleet status shows 'Returned: 0'
- [ ] No console errors in browser

### Workflow Verification (if test data available)
- [ ] Can return a bike assignment
- [ ] Bike status becomes 'returned' (not 'available')
- [ ] Bike appears in inspection queue
- [ ] Dashboard alert appears
- [ ] Can inspect returned bike
- [ ] Bike status updates after inspection
- [ ] Audit logs created for both actions

### Code Integration
- [ ] All service methods use AuditService
- [ ] BikesAwaitingInspectionWidget renders
- [ ] Role-based UI hides mechanic buttons
- [ ] No TypeScript errors in IDE

---

## TROUBLESHOOTING

### Error: "type bike_status already has value returned"

**Cause:** Migration 1 was run twice  
**Fix:** Safe to ignore - enum value exists

### Error: "relation audit_logs already exists"

**Cause:** Migration 2 was run twice  
**Fix:** Drop table and re-run, or skip if schema is correct

### Error: "function log_audit_event does not exist"

**Cause:** Migration 2 failed partway through  
**Fix:** Review error, rollback, fix issue, re-run

### Bike doesn't appear in inspection queue

**Possible causes:**
1. Bike status not 'returned' - check: `SELECT status FROM bikes WHERE id = '...'`
2. View query issue - check: `SELECT * FROM bikes_awaiting_inspection`
3. Application not fetching - check browser console

### Audit logs not created

**Possible causes:**
1. AuditService not initialized - check service constructor
2. Function errors - check: `SELECT * FROM audit_logs` manually
3. RLS blocking - test with service role key

---

## SUCCESS CRITERIA

✅ **Migration 1 Success:**
- 'returned' status in bike_status enum
- fn_bike_assignment_return sets status to 'returned'
- bikes_awaiting_inspection view exists and queries correctly

✅ **Migration 2 Success:**
- audit_logs table exists with 11 columns
- All 5 indexes created
- log_audit_event function works
- RLS enabled and policies configured
- recent_audit_activity view exists

✅ **Application Success:**
- No compilation errors
- Dashboard renders with new widget
- Role-based UI working
- Workflows function correctly

---

## NEXT STEPS AFTER SUCCESSFUL TESTING

1. **Deploy to Production:**
   - Apply migrations via Supabase Dashboard
   - Deploy application code
   - Monitor logs for 24 hours

2. **User Training:**
   - Brief mechanics on inspection workflow
   - Show managers audit log queries
   - Update internal documentation

3. **Monitoring:**
   - Track bikes in 'returned' status
   - Monitor audit log table growth
   - Check query performance

4. **Complete Phase 4:**
   - Write unit tests
   - Complete user documentation
   - Create training materials

---

**Testing Status:** Ready to Execute  
**Risk Level:** Low (well-tested, reversible)  
**Estimated Time:** 30-45 minutes

---

**End of Testing Guide**
