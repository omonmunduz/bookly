-- ============================================================================
-- MIGRATION 2: AUDIT LOGS SYSTEM (STEP-BY-STEP)
-- ============================================================================
-- Run each section separately in Supabase Dashboard SQL Editor
-- Wait for each to complete before running the next
-- ============================================================================

-- ============================================================================
-- STEP 2A: Create audit_logs table
-- ============================================================================
-- Run this first

CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id       UUID NOT NULL REFERENCES user_profiles(id),
  actor_name_snapshot TEXT NOT NULL,
  actor_role_snapshot user_role NOT NULL,
  action              TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID NOT NULL,
  entity_name_snapshot TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2B: Create indexes
-- ============================================================================
-- Run this second

CREATE INDEX idx_audit_logs_org_time
  ON audit_logs(organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_actor_time
  ON audit_logs(actor_user_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_logs_action
  ON audit_logs(organization_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_metadata
  ON audit_logs USING GIN (metadata);

-- ============================================================================
-- STEP 2C: Create log_audit_event function
-- ============================================================================
-- Run this third

CREATE OR REPLACE FUNCTION log_audit_event(
  p_organization_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_role user_role;
  v_log_id UUID;
BEGIN
  SELECT full_name, role
  INTO v_actor_name, v_actor_role
  FROM user_profiles
  WHERE id = p_actor_user_id
    AND organization_id = p_organization_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Unknown User';
    v_actor_role := 'mechanic';
  END IF;

  INSERT INTO audit_logs (
    organization_id,
    actor_user_id,
    actor_name_snapshot,
    actor_role_snapshot,
    action,
    entity_type,
    entity_id,
    entity_name_snapshot,
    metadata,
    created_at
  ) VALUES (
    p_organization_id,
    p_actor_user_id,
    v_actor_name,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2D: Enable RLS and create policies
-- ============================================================================
-- Run this fourth

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_manager_or_above"
ON audit_logs FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- ============================================================================
-- STEP 2E: Create recent_audit_activity view
-- ============================================================================
-- Run this fifth

CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT
  al.id,
  al.organization_id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.entity_name_snapshot,
  al.actor_user_id,
  al.actor_name_snapshot,
  al.actor_role_snapshot,
  al.metadata,
  al.created_at,
  CASE
    WHEN al.action LIKE '%_CREATED' THEN
      al.actor_name_snapshot || ' created ' || al.entity_type || ' ' || COALESCE(al.entity_name_snapshot, '')
    WHEN al.action LIKE '%_UPDATED' THEN
      al.actor_name_snapshot || ' updated ' || al.entity_type || ' ' || COALESCE(al.entity_name_snapshot, '')
    WHEN al.action LIKE '%_DELETED' THEN
      al.actor_name_snapshot || ' deleted ' || al.entity_type || ' ' || COALESCE(al.entity_name_snapshot, '')
    WHEN al.action LIKE '%_STATUS_CHANGED' THEN
      al.actor_name_snapshot || ' changed ' || al.entity_type || ' status'
    WHEN al.action LIKE '%_APPROVED' THEN
      al.actor_name_snapshot || ' approved ' || al.entity_type
    ELSE
      al.actor_name_snapshot || ' performed ' || al.action
  END AS description
FROM audit_logs al
ORDER BY al.created_at DESC
LIMIT 100;

-- ============================================================================
-- STEP 2F: Verify migration 2
-- ============================================================================
-- Run this to verify everything worked

SELECT 'Migration 2 verification:' as status;

-- Check table
SELECT COUNT(*) as table_exists
FROM pg_tables WHERE tablename = 'audit_logs';
-- Should return 1

-- Check indexes (should be 5)
SELECT COUNT(*) as index_count
FROM pg_indexes WHERE tablename = 'audit_logs';
-- Should return 5 or more

-- Check function
SELECT COUNT(*) as function_exists
FROM pg_proc WHERE proname = 'log_audit_event';
-- Should return 1

-- Check RLS enabled
SELECT rowsecurity as rls_enabled
FROM pg_tables WHERE tablename = 'audit_logs';
-- Should return true

-- Check view
SELECT COUNT(*) as view_exists
FROM pg_views WHERE viewname = 'recent_audit_activity';
-- Should return 1

SELECT '✓ Migration 2 complete' as result;
