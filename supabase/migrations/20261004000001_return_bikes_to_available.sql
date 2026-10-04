-- ============================================================================
-- E-BIKE RENTAL SYSTEM — RETURN BIKES DIRECTLY TO AVAILABLE STATUS
-- ============================================================================
-- Migration: 20261004000001_return_bikes_to_available.sql
-- Purpose: Update bike return trigger to set status = 'available' instead of 'returned'
--
-- Business Decision:
--   Skip the inspection workflow for now. When bikes are returned, they should
--   immediately become available for the next assignment.
--
-- Changes:
--   1. Update fn_bike_assignment_return() to set status = 'available'
--   2. Update any existing 'returned' bikes to 'available'
--
-- Workflow After This Migration:
--   assigned → [return] → available
-- ============================================================================

-- ============================================================================
-- STEP 1: Update return trigger to set status = 'available'
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  -- Assignment was just closed (returned_at set from NULL to a timestamp)
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Set bike back to 'available' status immediately
    UPDATE bikes
    SET status = 'available', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_bike_assignment_return IS
  'When assignment is closed (returned_at set), marks bike as "available" immediately.

   Updated 2026-10-04: Changed from "returned" back to "available" to skip inspection workflow.

   Workflow:
   1. Manager/mechanic receives bike return (sets returned_at)
   2. Trigger sets bike.status = "available"
   3. Bike is immediately ready for next assignment';

-- ============================================================================
-- STEP 2: Update any existing bikes in 'returned' status to 'available'
-- ============================================================================

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Move all 'returned' bikes to 'available'
  UPDATE bikes
  SET status = 'available', updated_at = NOW()
  WHERE status = 'returned' AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '✓ Updated % bike(s) from "returned" to "available" status', v_updated_count;
  ELSE
    RAISE NOTICE '✓ No bikes in "returned" status (no updates needed)';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify no bikes are left in 'returned' status
  IF EXISTS (SELECT 1 FROM bikes WHERE status = 'returned' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Migration failed: bikes still in "returned" status';
  END IF;

  RAISE NOTICE '✓ Migration successful: bikes now return directly to "available" status';
END $$;
