-- ============================================================================
-- MIGRATION 1: ADD RETURNED STATUS (STEP-BY-STEP)
-- ============================================================================
-- Run each section separately in Supabase Dashboard SQL Editor
-- Wait for each to complete before running the next
-- ============================================================================

-- ============================================================================
-- STEP 1A: Add 'returned' to bike_status enum
-- ============================================================================
-- Run this first, wait for success

ALTER TYPE bike_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'assigned';

-- ============================================================================
-- STEP 1B: Update trigger function
-- ============================================================================
-- Run this second

CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE bikes
    SET status = 'returned', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1C: Create bikes_awaiting_inspection view
-- ============================================================================
-- Run this third

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
ORDER BY ba.returned_at ASC;

-- ============================================================================
-- STEP 1D: Verify migration 1
-- ============================================================================
-- Run this to verify everything worked

SELECT 'Migration 1 verification:' as status;

-- Check enum
SELECT COUNT(*) as returned_status_exists
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'bike_status' AND e.enumlabel = 'returned';
-- Should return 1

-- Check view
SELECT COUNT(*) as view_exists
FROM pg_views WHERE viewname = 'bikes_awaiting_inspection';
-- Should return 1

SELECT '✓ Migration 1 complete' as result;
