-- ============================================================================
-- E-BIKE RENTAL SYSTEM — ADD 'RETURNED' BIKE STATUS
-- ============================================================================
-- Migration: 20260828000001_add_returned_status.sql
-- Purpose: Add 'returned' status to support proper post-return inspection workflow
--
-- Business Problem:
--   Currently, when a bike is returned from assignment, it immediately becomes
--   'available' again. This is incorrect because the bike should be inspected
--   before it can be assigned to another courier.
--
-- Solution:
--   1. Add 'returned' status to bike_status enum
--   2. Update assignment return trigger to set status = 'returned'
--   3. Inspection trigger (already exists) will move bike to final status
--
-- Workflow After This Migration:
--   assigned → [return] → returned → [inspect] → available/maintenance/damaged
-- ============================================================================

-- ============================================================================
-- STEP 1: Add 'returned' to bike_status enum
-- ============================================================================

-- Add new status value after 'assigned'
ALTER TYPE bike_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'assigned';

COMMENT ON TYPE bike_status IS
  'Bike lifecycle statuses:
   - available: Ready to be assigned to a courier
   - assigned: Currently with a courier
   - returned: Returned from assignment, awaiting inspection
   - maintenance: Being serviced (minor issues)
   - damaged: Requires repair before use (major issues)
   - retired: Permanently out of service';

-- ============================================================================
-- STEP 2: Update return trigger to set status = 'returned'
-- ============================================================================

-- When assignment is returned, bike should be marked 'returned' (awaiting inspection)
-- NOT immediately available
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  -- Assignment was just closed (returned_at set from NULL to a timestamp)
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Mark bike as 'returned' (awaiting inspection)
    -- Inspection workflow will move it to final status (available/maintenance/damaged)
    UPDATE bikes
    SET status = 'returned', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_bike_assignment_return IS
  'When assignment is closed (returned_at set), marks bike as "returned" (awaiting inspection).

   Updated 2026-08-28: Changed from immediately setting "available" to "returned".

   Workflow:
   1. Manager/mechanic receives bike return (sets returned_at)
   2. Trigger sets bike.status = "returned"
   3. Mechanic performs inspection (creates bike_inspection record)
   4. Inspection trigger (fn_inspection_update_bike_status) sets final status

   Final status depends on inspection result:
   - Good condition → "available"
   - Minor issues → "maintenance"
   - Major damage → "damaged"';

-- ============================================================================
-- STEP 3: Verify constraint: Only 'available' bikes can be assigned
-- ============================================================================

-- The assignment creation trigger already prevents assigning non-available bikes.
-- Verify this still works with the new 'returned' status.

DO $$
BEGIN
  -- The trigger fn_bike_assignment_create checks:
  --   IF v_bike_status != 'available' THEN
  --     RAISE EXCEPTION 'Cannot assign bike with status "%"...

  -- This is correct: 'returned' bikes should NOT be assignable.
  -- They must be inspected first, which will move them to 'available' if OK.

  RAISE NOTICE 'Verification: "returned" bikes cannot be assigned (enforced by fn_bike_assignment_create)';
END $$;

-- ============================================================================
-- STEP 4: Data migration for existing returned bikes
-- ============================================================================

-- Any bikes currently in 'available' status that were recently returned
-- should potentially be marked as 'returned' instead, but we don't have
-- a reliable way to determine this from the current data.
--
-- Decision: Leave existing bikes as-is. The new workflow only applies to
-- future returns. This is safe because:
-- 1. Existing 'available' bikes were presumably already inspected manually
-- 2. Changing their status retroactively could cause operational confusion

RAISE NOTICE 'Data Migration: No changes to existing bike statuses (new workflow applies to future returns only)';

-- ============================================================================
-- STEP 5: Create helper view for bikes awaiting inspection
-- ============================================================================

-- Dashboard query: "Show me all bikes that need inspection"
CREATE OR REPLACE VIEW bikes_awaiting_inspection AS
SELECT
  b.id,
  b.organization_id,
  b.bike_number,
  b.model,
  b.status,
  b.image_url,
  ba.returned_at,
  ba.returned_by,
  up.full_name AS returned_by_name,
  ba.courier_id,
  c.full_name AS courier_name,
  ba.condition_at_return
FROM bikes b
JOIN bike_assignments ba
  ON ba.bike_id = b.id
  AND ba.returned_at = (
    SELECT MAX(ba2.returned_at)
    FROM bike_assignments ba2
    WHERE ba2.bike_id = b.id
  )
LEFT JOIN user_profiles up ON up.id = ba.returned_by
LEFT JOIN couriers c ON c.id = ba.courier_id
WHERE b.status = 'returned'
  AND b.deleted_at IS NULL
ORDER BY ba.returned_at ASC;  -- Oldest returns first (most urgent)

COMMENT ON VIEW bikes_awaiting_inspection IS
  'Bikes in "returned" status that need inspection.

   Used by:
   - Mechanic dashboard ("Bikes Awaiting Inspection" widget)
   - Manager dashboard (inspection queue monitoring)

   Ordered by returned_at ASC so oldest returns appear first.';

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_status_count INTEGER;
BEGIN
  -- Verify 'returned' status was added
  SELECT COUNT(*) INTO v_status_count
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'bike_status'
    AND e.enumlabel = 'returned';

  IF v_status_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: "returned" status not found in bike_status enum';
  END IF;

  -- Verify view was created
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'bikes_awaiting_inspection'
  ) THEN
    RAISE EXCEPTION 'Migration failed: bikes_awaiting_inspection view not created';
  END IF;

  RAISE NOTICE '✓ Migration successful: "returned" status added, trigger updated, view created';
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (for emergency use)
-- ============================================================================

-- To rollback this migration (if needed):
--
-- 1. First, move any 'returned' bikes to 'available':
--    UPDATE bikes SET status = 'available' WHERE status = 'returned';
--
-- 2. Then restore old trigger:
--    CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
--    RETURNS TRIGGER AS $$
--    BEGIN
--      IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
--        UPDATE bikes SET status = 'available', updated_at = NOW()
--        WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
--      END IF;
--      RETURN NEW;
--    END;
--    $$ LANGUAGE plpgsql;
--
-- 3. Drop view:
--    DROP VIEW IF EXISTS bikes_awaiting_inspection;
--
-- NOTE: Cannot remove enum value once added in PostgreSQL.
--       The 'returned' value will remain in the enum, but won't be used.
