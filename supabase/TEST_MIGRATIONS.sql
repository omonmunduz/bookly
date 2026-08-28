-- ============================================================================
-- MIGRATION TESTING SCRIPT
-- ============================================================================
-- Purpose: Verify migrations 20260828000001 and 20260828000002 work correctly
-- Run this AFTER applying both migrations
-- ============================================================================

-- ============================================================================
-- TEST 1: Verify 'returned' status exists
-- ============================================================================

DO $$
DECLARE
  v_returned_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'bike_status'
      AND e.enumlabel = 'returned'
  ) INTO v_returned_exists;

  IF v_returned_exists THEN
    RAISE NOTICE '✓ TEST 1 PASSED: "returned" status exists in bike_status enum';
  ELSE
    RAISE EXCEPTION '✗ TEST 1 FAILED: "returned" status not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Verify bikes_awaiting_inspection view exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'bikes_awaiting_inspection') THEN
    RAISE NOTICE '✓ TEST 2 PASSED: bikes_awaiting_inspection view exists';
  ELSE
    RAISE EXCEPTION '✗ TEST 2 FAILED: bikes_awaiting_inspection view not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 3: Verify fn_bike_assignment_return trigger function updated
-- ============================================================================

DO $$
DECLARE
  v_function_source TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_function_source
  FROM pg_proc
  WHERE proname = 'fn_bike_assignment_return';

  IF v_function_source LIKE '%returned%' THEN
    RAISE NOTICE '✓ TEST 3 PASSED: fn_bike_assignment_return sets status to "returned"';
  ELSE
    RAISE EXCEPTION '✗ TEST 3 FAILED: function does not set "returned" status';
  END IF;
END $$;

-- ============================================================================
-- TEST 4: Verify audit_logs table exists with correct schema
-- ============================================================================

DO $$
DECLARE
  v_column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'audit_logs'
    AND column_name IN (
      'id', 'organization_id', 'actor_user_id', 'actor_name_snapshot',
      'actor_role_snapshot', 'action', 'entity_type', 'entity_id',
      'entity_name_snapshot', 'metadata', 'created_at'
    );

  IF v_column_count = 11 THEN
    RAISE NOTICE '✓ TEST 4 PASSED: audit_logs table has all required columns';
  ELSE
    RAISE EXCEPTION '✗ TEST 4 FAILED: audit_logs table missing columns (found % of 11)', v_column_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 5: Verify audit_logs indexes exist
-- ============================================================================

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename = 'audit_logs'
    AND indexname IN (
      'idx_audit_logs_org_time',
      'idx_audit_logs_actor_time',
      'idx_audit_logs_entity',
      'idx_audit_logs_action',
      'idx_audit_logs_metadata'
    );

  IF v_index_count = 5 THEN
    RAISE NOTICE '✓ TEST 5 PASSED: All 5 audit_logs indexes exist';
  ELSE
    RAISE EXCEPTION '✗ TEST 5 FAILED: Missing indexes (found % of 5)', v_index_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 6: Verify log_audit_event function exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
    RAISE NOTICE '✓ TEST 6 PASSED: log_audit_event function exists';
  ELSE
    RAISE EXCEPTION '✗ TEST 6 FAILED: log_audit_event function not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 7: Verify audit_logs RLS is enabled
-- ============================================================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO v_rls_enabled
  FROM pg_tables
  WHERE tablename = 'audit_logs';

  IF v_rls_enabled THEN
    RAISE NOTICE '✓ TEST 7 PASSED: RLS is enabled on audit_logs';
  ELSE
    RAISE EXCEPTION '✗ TEST 7 FAILED: RLS not enabled on audit_logs';
  END IF;
END $$;

-- ============================================================================
-- TEST 8: Verify audit_logs RLS policy exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND policyname = 'audit_logs_select_manager_or_above'
  ) THEN
    RAISE NOTICE '✓ TEST 8 PASSED: audit_logs_select_manager_or_above policy exists';
  ELSE
    RAISE EXCEPTION '✗ TEST 8 FAILED: RLS policy not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 9: Verify recent_audit_activity view exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'recent_audit_activity') THEN
    RAISE NOTICE '✓ TEST 9 PASSED: recent_audit_activity view exists';
  ELSE
    RAISE EXCEPTION '✗ TEST 9 FAILED: recent_audit_activity view not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 10: Test log_audit_event function (if organization/user exists)
-- ============================================================================

DO $$
DECLARE
  v_test_org_id UUID;
  v_test_user_id UUID;
  v_log_id UUID;
BEGIN
  -- Try to find a test organization and user
  SELECT id INTO v_test_org_id FROM organizations LIMIT 1;

  IF v_test_org_id IS NOT NULL THEN
    SELECT id INTO v_test_user_id
    FROM user_profiles
    WHERE organization_id = v_test_org_id
    LIMIT 1;

    IF v_test_user_id IS NOT NULL THEN
      -- Test creating an audit log
      SELECT log_audit_event(
        p_organization_id := v_test_org_id,
        p_actor_user_id := v_test_user_id,
        p_action := 'TEST_ACTION',
        p_entity_type := 'test',
        p_entity_id := gen_random_uuid(),
        p_entity_name := 'Test Entity',
        p_metadata := '{"test": true}'::jsonb
      ) INTO v_log_id;

      IF v_log_id IS NOT NULL THEN
        RAISE NOTICE '✓ TEST 10 PASSED: log_audit_event function works (log_id: %)', v_log_id;

        -- Clean up test log
        DELETE FROM audit_logs WHERE id = v_log_id;
      ELSE
        RAISE EXCEPTION '✗ TEST 10 FAILED: log_audit_event returned NULL';
      END IF;
    ELSE
      RAISE NOTICE '⊘ TEST 10 SKIPPED: No user found for testing';
    END IF;
  ELSE
    RAISE NOTICE '⊘ TEST 10 SKIPPED: No organization found for testing';
  END IF;
END $$;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION TEST SUMMARY';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests completed. Review results above.';
  RAISE NOTICE '';
  RAISE NOTICE 'If all tests passed:';
  RAISE NOTICE '  ✓ Migration 20260828000001 (returned status) is working';
  RAISE NOTICE '  ✓ Migration 20260828000002 (audit logs) is working';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test bike return workflow manually';
  RAISE NOTICE '  2. Verify audit logs populate on actions';
  RAISE NOTICE '  3. Test dashboard widget displays returned bikes';
  RAISE NOTICE '  4. Deploy application code';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
