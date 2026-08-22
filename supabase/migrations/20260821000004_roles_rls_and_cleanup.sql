-- ============================================================================
-- E-BIKE RENTAL & COURIER MANAGEMENT — ROLES, RLS, AND CLEANUP
-- ============================================================================
-- Migration 4 of 4: Update role system, create RLS policies, remove old tables
--
-- This migration:
--   1. Updates user_role enum (owner/admin/manager/employee → admin/manager/mechanic)
--   2. Creates RLS policies for new tables
--   3. Updates storage bucket RLS policies
--   4. Drops old tables (customers, products, sales, payments, inventory)
--   5. Drops old enums and functions
--
-- Business Rules Implemented:
--   - Admin: Full access
--   - Manager: Operational access (couriers, bikes, assignments, earnings)
--   - Mechanic: Maintenance-focused (view bikes, perform inspections, no financials)
--
-- Migration order:
--   20260821000001 - bikes, couriers, rental plans
--   20260821000002 - assignments and earnings
--   20260821000003 - maintenance and inspections
--   20260821000004 - roles, RLS, and cleanup (this file)
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP OLD TABLES FIRST
-- ============================================================================
-- Must drop old tables before we can drop the user_role enum they depend on.
-- Remove wholesale business domain tables.
-- Keep: organizations, user_profiles, expenses (business expenses still relevant)

-- Drop tables (in dependency order)
DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS inventory_adjustments CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS sale_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- Drop old functions that depend on user_role
DROP FUNCTION IF EXISTS public.record_customer_payment CASCADE;
DROP FUNCTION IF EXISTS public.create_sale_with_items CASCADE;
DROP FUNCTION IF EXISTS public.fn_recalc_sale_payment CASCADE;
DROP FUNCTION IF EXISTS public.fn_recalc_customer_balance CASCADE;
DROP FUNCTION IF EXISTS public.fn_allocations_recalc_sale CASCADE;
DROP FUNCTION IF EXISTS public.fn_payment_changed_recalc_sales CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_recalc_customer_balance CASCADE;
DROP FUNCTION IF EXISTS public.fn_recalculate_sale_totals CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale_payment_status CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_customer_balance CASCADE;
DROP FUNCTION IF EXISTS public.fn_decrease_inventory_on_sale_completed CASCADE;
DROP FUNCTION IF EXISTS public.fn_restore_inventory_on_sale_cancelled CASCADE;
DROP FUNCTION IF EXISTS public.fn_prevent_product_delete_with_sales CASCADE;
DROP FUNCTION IF EXISTS public.fn_check_sale_items_limit CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_inventory_for_product CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_inventory_for_item CASCADE;
DROP FUNCTION IF EXISTS public.fn_assign_sale_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_customer_code CASCADE;
DROP FUNCTION IF EXISTS public.generate_sale_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_payment_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_inventory_item_code CASCADE;

-- Drop auth helper functions that depend on user_role (will recreate later)
DROP FUNCTION IF EXISTS public.current_user_role CASCADE;
DROP FUNCTION IF EXISTS public.has_role_or_above CASCADE;

-- Drop RLS policies on storage.objects for product-images bucket
DROP POLICY IF EXISTS product_images_insert_manager_or_above ON storage.objects;
DROP POLICY IF EXISTS product_images_update_manager_or_above ON storage.objects;
DROP POLICY IF EXISTS product_images_delete_manager_or_above ON storage.objects;

-- Drop RLS policies on organizations and user_profiles that depend on user_role
DROP POLICY IF EXISTS org_update_owner_only ON organizations;
DROP POLICY IF EXISTS profiles_insert_admin_or_above ON user_profiles;
DROP POLICY IF EXISTS profiles_update_admin_or_above ON user_profiles;

-- Drop RLS policy on expenses
DROP POLICY IF EXISTS expenses_update_manager_or_above ON expenses;

-- Note: Old storage bucket 'product-images' should be manually deleted via Supabase dashboard
-- Direct deletion from storage.buckets is not allowed in migrations

-- ============================================================================
-- STEP 2: UPDATE USER ROLES
-- ============================================================================
-- Old roles: owner, admin, manager, employee
-- New roles: admin, manager, mechanic
--
-- Migration strategy:
--   - owner → admin
--   - admin → admin
--   - manager → manager
--   - employee → mechanic (default lowest privilege)

-- Create new enum
CREATE TYPE user_role_new AS ENUM ('admin', 'manager', 'mechanic');

-- Migrate existing users
ALTER TABLE user_profiles ADD COLUMN role_new user_role_new;

UPDATE user_profiles SET role_new =
  CASE role
    WHEN 'owner' THEN 'admin'::user_role_new
    WHEN 'admin' THEN 'admin'::user_role_new
    WHEN 'manager' THEN 'manager'::user_role_new
    WHEN 'employee' THEN 'mechanic'::user_role_new
  END;

-- Make new role NOT NULL
ALTER TABLE user_profiles ALTER COLUMN role_new SET NOT NULL;

-- Drop old column and rename new one
ALTER TABLE user_profiles DROP COLUMN role;
ALTER TABLE user_profiles RENAME COLUMN role_new TO role;

-- Drop old enum (now safe since old tables are gone)
DROP TYPE user_role;

-- Rename new enum to standard name
ALTER TYPE user_role_new RENAME TO user_role;

COMMENT ON COLUMN user_profiles.role IS
  'RBAC roles: admin > manager > mechanic.
   - admin: Full access, manage employees, company settings
   - manager: Operations (couriers, bikes, assignments, earnings)
   - mechanic: Maintenance (inspections, repairs, no financials)';

-- ============================================================================
-- STEP 3: UPDATE AUTH HELPERS FOR NEW ROLES
-- ============================================================================

-- Recreate current_user_role function with new enum
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles
  WHERE id = auth.uid()
    AND organization_id = public.current_organization_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.current_user_role IS
  'Returns the role of the current user in their current organization.';

-- Update role ranking function
CREATE OR REPLACE FUNCTION public.has_role_or_above(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT CASE public.current_user_role()
    WHEN 'admin'    THEN TRUE
    WHEN 'manager'  THEN required_role IN ('manager', 'mechanic')
    WHEN 'mechanic' THEN required_role = 'mechanic'
    ELSE FALSE
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.has_role_or_above IS
  'TRUE when caller''s role is at least required_role. admin > manager > mechanic.';

-- Recreate RLS policies for organizations
CREATE POLICY "org_update_admin_only"
ON organizations FOR UPDATE TO authenticated
USING      (id = public.current_organization_id() AND public.has_role_or_above('admin'))
WITH CHECK (id = public.current_organization_id() AND public.has_role_or_above('admin'));

-- Recreate RLS policies for user_profiles
CREATE POLICY "profiles_insert_admin_or_above"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('admin')
);

CREATE POLICY "profiles_update_admin_or_above"
ON user_profiles FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'));

-- Recreate RLS policy for expenses
CREATE POLICY "expenses_update_manager_or_above"
ON expenses FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 4: RLS POLICIES FOR BIKES
-- ============================================================================

ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;

-- Everyone can view bikes (mechanics need to see what needs maintenance)
CREATE POLICY "bikes_select_same_org"
ON bikes FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Admin and Manager can create bikes
CREATE POLICY "bikes_insert_manager_or_above"
ON bikes FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- Admin and Manager can update bikes
CREATE POLICY "bikes_update_manager_or_above"
ON bikes FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 5: RLS POLICIES FOR COURIERS
-- ============================================================================

ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- Everyone can view couriers (mechanics need to know who has bikes)
CREATE POLICY "couriers_select_same_org"
ON couriers FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Admin and Manager can create couriers
CREATE POLICY "couriers_insert_manager_or_above"
ON couriers FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- Admin and Manager can update couriers
CREATE POLICY "couriers_update_manager_or_above"
ON couriers FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 6: RLS POLICIES FOR RENTAL PLANS
-- ============================================================================

ALTER TABLE rental_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view plans (needed for assignment workflow)
CREATE POLICY "rental_plans_select_same_org"
ON rental_plans FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Admin and Manager can create/edit plans
CREATE POLICY "rental_plans_insert_manager_or_above"
ON rental_plans FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "rental_plans_update_manager_or_above"
ON rental_plans FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 7: RLS POLICIES FOR BIKE ASSIGNMENTS
-- ============================================================================

ALTER TABLE bike_assignments ENABLE ROW LEVEL SECURITY;

-- Everyone can view assignments (mechanics need to see bike history)
CREATE POLICY "bike_assignments_select_same_org"
ON bike_assignments FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Admin and Manager can create assignments
CREATE POLICY "bike_assignments_insert_manager_or_above"
ON bike_assignments FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- Admin, Manager, and Mechanic can update assignments (for returns/inspections)
CREATE POLICY "bike_assignments_update_all_roles"
ON bike_assignments FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id())
WITH CHECK (organization_id = public.current_organization_id());

-- ============================================================================
-- STEP 8: RLS POLICIES FOR EARNINGS AND DEDUCTIONS
-- ============================================================================
-- Mechanics should NOT see financial data

ALTER TABLE earnings_periods ENABLE ROW LEVEL SECURITY;

-- Admin and Manager can view earnings (NOT mechanics)
CREATE POLICY "earnings_select_manager_or_above"
ON earnings_periods FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- Admin and Manager can create/edit earnings
CREATE POLICY "earnings_insert_manager_or_above"
ON earnings_periods FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "earnings_update_manager_or_above"
ON earnings_periods FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- Deductions follow same pattern as earnings
ALTER TABLE deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deductions_select_manager_or_above"
ON deductions FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "deductions_insert_manager_or_above"
ON deductions FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "deductions_update_manager_or_above"
ON deductions FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 9: RLS POLICIES FOR MAINTENANCE AND INSPECTIONS
-- ============================================================================

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Everyone can view maintenance (transparency about bike condition)
CREATE POLICY "maintenance_select_same_org"
ON maintenance_records FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Everyone can create maintenance records (mechanics do most maintenance)
CREATE POLICY "maintenance_insert_any_role"
ON maintenance_records FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

-- Only Admin and Manager can update/approve maintenance
CREATE POLICY "maintenance_update_manager_or_above"
ON maintenance_records FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- Inspections: similar pattern
ALTER TABLE bike_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select_same_org"
ON bike_inspections FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Everyone can create inspections (mechanics and managers both inspect)
CREATE POLICY "inspections_insert_any_role"
ON bike_inspections FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

-- Only Manager+ can update inspections
CREATE POLICY "inspections_update_manager_or_above"
ON bike_inspections FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- STEP 10: STORAGE BUCKET RLS POLICIES
-- ============================================================================

-- Bike images: everyone can view, manager+ can upload/modify
CREATE POLICY "bike_images_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bike-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "bike_images_insert_manager_or_above"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bike-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "bike_images_update_manager_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bike-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
)
WITH CHECK (
  bucket_id = 'bike-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "bike_images_delete_manager_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bike-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

-- Maintenance photos: everyone can view and upload (mechanics need to document work)
CREATE POLICY "maintenance_photos_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "maintenance_photos_insert_any_role"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "maintenance_photos_update_manager_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
)
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "maintenance_photos_delete_manager_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

COMMENT ON SCHEMA public IS
  'E-bike rental and courier management system.

   Domain model:
   - Companies own bikes (assets)
   - Couriers rent bikes
   - Assignments track bike usage history
   - Earnings periods settle courier payments
   - Maintenance tracks bike service history

   Roles: admin > manager > mechanic';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify critical constraints
DO $$
BEGIN
  -- Check that all active bikes are either available or assigned
  IF EXISTS (
    SELECT 1 FROM bikes
    WHERE deleted_at IS NULL
      AND status NOT IN ('available', 'assigned', 'maintenance', 'damaged', 'retired')
  ) THEN
    RAISE EXCEPTION 'Invalid bike status found';
  END IF;

  -- Check that no courier has more than 1 active assignment
  IF EXISTS (
    SELECT courier_id, COUNT(*)
    FROM bike_assignments
    WHERE returned_at IS NULL
    GROUP BY courier_id, organization_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Courier with multiple active assignments found (max 1 allowed)';
  END IF;

  -- Check that all bikes with status 'assigned' have an active assignment
  IF EXISTS (
    SELECT b.id
    FROM bikes b
    WHERE b.status = 'assigned'
      AND b.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM bike_assignments ba
        WHERE ba.bike_id = b.id
          AND ba.returned_at IS NULL
      )
  ) THEN
    RAISE WARNING 'Bikes marked "assigned" but no active assignment found - will be auto-fixed';

    -- Auto-fix: mark as available
    UPDATE bikes
    SET status = 'available', updated_at = NOW()
    WHERE status = 'assigned'
      AND deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM bike_assignments ba
        WHERE ba.bike_id = bikes.id
          AND ba.returned_at IS NULL
      );
  END IF;

  RAISE NOTICE 'Migration complete. All constraints verified.';
END $$;
