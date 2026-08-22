# Migration Deployment Guide

## Option 1: Supabase Dashboard (Recommended for Safety)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Apply migrations in order:
   - Copy contents of `20260821000001_bikes_and_couriers_schema.sql`
   - Paste and run
   - Verify tables created (check Table Editor)
   - Repeat for migrations 002, 003, 004

## Option 2: Supabase CLI (If Available)

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Generate TypeScript types
npm run db:generate-types
```

## Option 3: Manual SQL Execution

If you have direct database access:

```bash
# Connect via psql
psql "postgresql://postgres:[password]@[host]:5432/postgres"

# Run each migration file
\i supabase/migrations/20260821000001_bikes_and_couriers_schema.sql
\i supabase/migrations/20260821000002_assignments_and_earnings.sql
\i supabase/migrations/20260821000003_maintenance_and_inspections.sql
\i supabase/migrations/20260821000004_roles_rls_and_cleanup.sql
```

## ⚠️ IMPORTANT: Pre-Migration Checklist

### Backup Existing Data

If you have any existing data you want to preserve:

```sql
-- Create backup tables (run BEFORE migration 4)
CREATE TABLE _backup_customers AS SELECT * FROM customers;
CREATE TABLE _backup_products AS SELECT * FROM products;
CREATE TABLE _backup_sales AS SELECT * FROM sales;
CREATE TABLE _backup_payments AS SELECT * FROM payments;
```

### User Role Migration

Migration 4 will convert existing user roles:
- `owner` → `admin`
- `admin` → `admin`
- `manager` → `manager`
- `employee` → `mechanic`

**Review your users before applying migration 4!**

```sql
-- Check current users
SELECT id, email, full_name, role FROM user_profiles;
```

## Post-Migration Verification

After applying all migrations, run these checks:

```sql
-- 1. Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('bikes', 'couriers', 'rental_plans', 'bike_assignments', 'earnings_periods', 'deductions', 'maintenance_records', 'bike_inspections');

-- 2. Check roles updated
SELECT DISTINCT role FROM user_profiles;
-- Should return: admin, manager, mechanic

-- 3. Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('bikes', 'couriers', 'rental_plans');
-- All should have rowsecurity = true

-- 4. Check storage buckets
SELECT id, name, public FROM storage.buckets WHERE id IN ('bike-images', 'maintenance-photos');
-- Should return 2 rows, both with public = false
```

## Rolling Back (Emergency Only)

If something goes wrong with migration 4:

```sql
-- Restore old tables
CREATE TABLE customers AS SELECT * FROM _backup_customers;
CREATE TABLE products AS SELECT * FROM _backup_products;
-- etc...

-- Drop new tables
DROP TABLE IF EXISTS bike_assignments CASCADE;
DROP TABLE IF EXISTS bikes CASCADE;
DROP TABLE IF EXISTS couriers CASCADE;
-- etc...
```

## Generate TypeScript Types

After migrations are applied successfully:

```bash
npm run db:generate-types
```

This will update `src/lib/database.types.ts` with the new schema.

## Deployment Status Checklist

- [ ] Backup created (if needed)
- [ ] Migration 1 applied (bikes, couriers, rental_plans)
- [ ] Migration 2 applied (assignments, earnings)
- [ ] Migration 3 applied (maintenance, inspections)
- [ ] Migration 4 applied (roles, RLS, cleanup)
- [ ] Post-migration checks passed
- [ ] TypeScript types regenerated
- [ ] Old code removed/updated
- [ ] Application tested

## Support

If migrations fail at any step:
1. Note the exact error message
2. Check which migration step failed
3. Do NOT proceed to next migration
4. Fix the issue before continuing
