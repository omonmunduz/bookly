# MIGRATION ERROR TROUBLESHOOTING

If you encountered errors when running the migrations, try these solutions:

---

## SOLUTION 1: Use Step-by-Step Scripts

I've created broken-down versions of the migrations that are easier to run:

1. **For Migration 1 (Returned Status):**
   - Use: `supabase/migrations/MIGRATION_1_STEPWISE.sql`
   - Run each section (1A, 1B, 1C, 1D) separately
   - Wait for each to complete before running the next

2. **For Migration 2 (Audit Logs):**
   - Use: `supabase/migrations/MIGRATION_2_STEPWISE.sql`
   - Run each section (2A, 2B, 2C, 2D, 2E, 2F) separately
   - Wait for each to complete before running the next

---

## SOLUTION 2: Common Errors & Fixes

### Error: "syntax error at or near..."

**Cause:** SQL Editor doesn't handle multiple statements well

**Fix:** 
- Use the step-by-step scripts (MIGRATION_X_STEPWISE.sql)
- Copy only ONE section at a time
- Click "Run" after each section

---

### Error: "type bike_status already has value returned"

**Cause:** Migration 1 was already run partially

**Fix:** Skip step 1A, continue with 1B onwards

---

### Error: "relation audit_logs already exists"

**Cause:** Migration 2 was already run partially

**Fix:** Either:
1. Drop the table and start fresh:
   ```sql
   DROP TABLE IF EXISTS audit_logs CASCADE;
   ```
   Then re-run from step 2A

2. Or skip to the missing steps (check which ones failed)

---

### Error: "function ... does not exist"

**Cause:** Depends on other functions or tables

**Fix:** Check these exist first:
```sql
-- Check if helper functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('current_organization_id', 'has_role_or_above');
```

If missing, they should be in earlier migrations.

---

### Error: "relation ... does not exist"

**Cause:** Migration depends on tables from earlier migrations

**Fix:** Verify these tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bikes', 'bike_assignments', 'user_profiles', 'organizations', 'couriers');
```

All should exist. If not, earlier migrations need to be run first.

---

## SOLUTION 3: What Error Did You Get?

Please share the specific error message you received, and I can provide a targeted fix.

Common error patterns:
- **Syntax error** → Use step-by-step scripts
- **Already exists** → Skip that step or drop and recreate
- **Does not exist** → Missing dependency, check prerequisites
- **Permission denied** → Check you're using correct credentials

---

## SOLUTION 4: Manual Application via Supabase Dashboard

### For Migration 1:

**Step 1A - Add enum value:**
```sql
ALTER TYPE bike_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'assigned';
```

**Step 1B - Update function:**
```sql
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE bikes SET status = 'returned', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Step 1C - Create view:**
```sql
CREATE OR REPLACE VIEW bikes_awaiting_inspection AS
SELECT
  b.id, b.organization_id, b.bike_number, b.model, b.status, b.image_url,
  ba.returned_at, ba.returned_by, up.full_name AS returned_by_name,
  ba.courier_id, c.full_name AS courier_name, ba.condition_at_return
FROM bikes b
JOIN bike_assignments ba ON ba.bike_id = b.id
  AND ba.returned_at = (SELECT MAX(ba2.returned_at) FROM bike_assignments ba2 WHERE ba2.bike_id = b.id)
LEFT JOIN user_profiles up ON up.id = ba.returned_by
LEFT JOIN couriers c ON c.id = ba.courier_id
WHERE b.status = 'returned' AND b.deleted_at IS NULL
ORDER BY ba.returned_at ASC;
```

---

### For Migration 2:

Use the sections from `MIGRATION_2_STEPWISE.sql` one at a time.

---

## SOLUTION 5: Check Prerequisites

Before running migrations, verify:

```sql
-- 1. Check bike_status enum exists
SELECT typname FROM pg_type WHERE typname = 'bike_status';
-- Should return: bike_status

-- 2. Check bikes table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'bikes';
-- Should return: bikes

-- 3. Check user_role enum exists (needed for audit_logs)
SELECT typname FROM pg_type WHERE typname = 'user_role';
-- Should return: user_role

-- 4. Check organizations table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'organizations';
-- Should return: organizations
```

---

## NEXT STEPS

1. **Share the error message** you received
2. **Try the step-by-step scripts** (MIGRATION_X_STEPWISE.sql)
3. **Run verification queries** to check what's missing
4. **Apply only the missing parts**

I can provide more specific help once I know the exact error!
