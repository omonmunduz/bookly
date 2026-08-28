-- ============================================================================
-- E-BIKE RENTAL SYSTEM — AUDIT LOGGING SYSTEM
-- ============================================================================
-- Migration: 20260828000002_create_audit_logs.sql
-- Purpose: Create unified audit trail for all business actions
--
-- Business Problem:
--   Currently, we can answer "who created this bike?" but not:
--   - "Who changed this courier's status on August 15?"
--   - "Show me everything Timur did today"
--   - "What happened to bike EB-001 on August 20?"
--
-- Solution:
--   Create audit_logs table that records WHO did WHAT, WHEN, with structured metadata.
--
-- Design Decisions:
--   1. Actor snapshots: Store actor name/role at time of action (not just ID)
--      - Rationale: If user changes name or role later, historical records stay clear
--   2. Structured metadata: JSONB field for action-specific details
--      - Rationale: Flexible schema, queryable with JSONB operators
--   3. No UPDATE/DELETE: Audit logs are append-only (immutable)
--      - Rationale: Tampering with audit trail defeats the purpose
--   4. Application-layer logging: Service methods call log() explicitly
--      - Rationale: More control, easier to test than triggers
-- ============================================================================

-- ============================================================================
-- STEP 1: Create audit_logs table
-- ============================================================================

CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Actor: WHO performed this action
  actor_user_id       UUID NOT NULL REFERENCES user_profiles(id),
  actor_name_snapshot TEXT NOT NULL,
  actor_role_snapshot user_role NOT NULL,

  -- Action: WHAT happened
  action              TEXT NOT NULL,          -- 'BIKE_CREATED', 'INSPECTION_APPROVED', etc.
  entity_type         TEXT NOT NULL,          -- 'bike', 'courier', 'inspection', etc.
  entity_id           UUID NOT NULL,          -- ID of affected entity
  entity_name_snapshot TEXT,                  -- Human-readable identifier (bike_number, courier name, etc.)

  -- Details: Context-specific data
  metadata            JSONB,

  -- Timestamp: WHEN this happened
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for common queries
-- ============================================================================

-- "Show me all actions in my organization, most recent first"
CREATE INDEX idx_audit_logs_org_time
  ON audit_logs(organization_id, created_at DESC);

-- "Show me everything this user did"
CREATE INDEX idx_audit_logs_actor_time
  ON audit_logs(actor_user_id, created_at DESC);

-- "Show me all actions on this entity"
CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- "Show me all actions of this type"
CREATE INDEX idx_audit_logs_action
  ON audit_logs(organization_id, action, created_at DESC);

-- "Query metadata fields" (GIN index for JSONB)
CREATE INDEX idx_audit_logs_metadata
  ON audit_logs USING GIN (metadata);

-- ============================================================================
-- STEP 3: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE audit_logs IS
  'Unified audit trail for all business actions.

   Records WHO (actor_user_id + snapshot of name/role at action time)
   did WHAT (action + entity_type + entity_id)
   WHEN (created_at)
   with structured details (metadata JSONB).

   Examples:
   - BIKE_CREATED: metadata = {model, status, bike_number}
   - COURIER_STATUS_CHANGED: metadata = {from_status, to_status}
   - INSPECTION_APPROVED: metadata = {condition, next_status}

   Immutable: No UPDATE or DELETE policies. Append-only.';

COMMENT ON COLUMN audit_logs.actor_name_snapshot IS
  'Actor''s full_name at time of action.

   Stored as snapshot so historical records remain readable even if the user
   changes their name later. Example: "Timur Abdullaev"';

COMMENT ON COLUMN audit_logs.actor_role_snapshot IS
  'Actor''s role at time of action.

   Stored as snapshot so we know what permissions they had when they performed
   the action. Example: If user was "mechanic" when they created an inspection,
   this will be "mechanic" even if they are promoted to "manager" later.';

COMMENT ON COLUMN audit_logs.action IS
  'Action identifier (uppercase with underscores).

   Examples:
   - BIKE_CREATED, BIKE_UPDATED, BIKE_STATUS_CHANGED, BIKE_DELETED
   - COURIER_CREATED, COURIER_UPDATED, COURIER_STATUS_CHANGED
   - INSPECTION_CREATED, INSPECTION_APPROVED
   - MAINTENANCE_CREATED, MAINTENANCE_APPROVED
   - ASSIGNMENT_CREATED, ASSIGNMENT_RETURNED';

COMMENT ON COLUMN audit_logs.entity_type IS
  'Type of entity affected (lowercase singular).

   Examples: bike, courier, inspection, maintenance, assignment, rental_plan, user';

COMMENT ON COLUMN audit_logs.entity_id IS
  'UUID of the affected entity.

   Combined with entity_type, this identifies exactly what was acted upon.';

COMMENT ON COLUMN audit_logs.entity_name_snapshot IS
  'Human-readable identifier of the entity at time of action.

   Examples:
   - Bike: "EB-001"
   - Courier: "Bakyt Aliyev"
   - Rental Plan: "Weekly Plan"

   Makes audit logs readable without JOINing back to entity tables.';

COMMENT ON COLUMN audit_logs.metadata IS
  'Action-specific details as JSONB.

   Structure varies by action type:

   BIKE_CREATED: {model, status, bike_number}
   BIKE_UPDATED: {changed_fields: {model: {from, to}, ...}}
   BIKE_STATUS_CHANGED: {from_status, to_status, reason}
   COURIER_STATUS_CHANGED: {from_status, to_status}
   INSPECTION_CREATED: {condition, next_status, requires_maintenance}
   MAINTENANCE_APPROVED: {cost, maintenance_type}

   Use JSONB operators for queries:
   - metadata->>''next_status'' = ''available''
   - metadata @> ''{"requires_maintenance": true}''';

-- ============================================================================
-- STEP 4: Create helper function for logging
-- ============================================================================

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
  -- Get actor details from user_profiles
  SELECT full_name, role
  INTO v_actor_name, v_actor_role
  FROM user_profiles
  WHERE id = p_actor_user_id
    AND organization_id = p_organization_id;

  -- If user not found, use fallback (shouldn't happen, but be defensive)
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Unknown User';
    v_actor_role := 'mechanic';
  END IF;

  -- Insert audit log
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

COMMENT ON FUNCTION log_audit_event IS
  'Helper function for creating audit log entries.

   Automatically looks up actor name and role, creates snapshot.

   Usage:
     SELECT log_audit_event(
       p_organization_id := ''...'',
       p_actor_user_id := ''...'',
       p_action := ''BIKE_CREATED'',
       p_entity_type := ''bike'',
       p_entity_id := ''...'',
       p_entity_name := ''EB-001'',
       p_metadata := ''{"model": "Giant E-Bike Pro", "status": "available"}''::jsonb
     );

   Returns: ID of created audit log entry';

-- ============================================================================
-- STEP 5: Create RLS policies (read-only for managers+, no writes)
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view audit logs
CREATE POLICY "audit_logs_select_manager_or_above"
ON audit_logs FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- No INSERT/UPDATE/DELETE policies
-- Audit logs are created ONLY via:
-- 1. Application layer (AuditService calling log_audit_event)
-- 2. Database triggers (for critical actions)
--
-- Direct INSERT by users is not allowed (RLS blocks it)

COMMENT ON POLICY "audit_logs_select_manager_or_above" ON audit_logs IS
  'Managers and admins can view audit logs in their organization.
   Mechanics cannot (financial/personnel privacy).

   No write policies: audit logs are append-only via service layer.';

-- ============================================================================
-- STEP 6: Create view for recent activity
-- ============================================================================

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
  -- Human-readable description
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

COMMENT ON VIEW recent_audit_activity IS
  'Last 100 audit events with human-readable descriptions.
   Used for dashboard "Recent Activity" widget.';

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs'
  ) THEN
    RAISE EXCEPTION 'Migration failed: audit_logs table not created';
  END IF;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_org_time'
  ) THEN
    RAISE EXCEPTION 'Migration failed: indexes not created';
  END IF;

  -- Verify helper function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event'
  ) THEN
    RAISE EXCEPTION 'Migration failed: log_audit_event function not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on audit_logs';
  END IF;

  RAISE NOTICE '✓ Migration successful: audit_logs table, indexes, helper function, and RLS created';
END $$;

-- ============================================================================
-- STANDARD ACTION NAMES (for application layer)
-- ============================================================================

-- This is documentation only. Application layer should use these consistent names.

/*
BIKES:
  BIKE_CREATED
  BIKE_UPDATED
  BIKE_STATUS_CHANGED
  BIKE_DELETED

COURIERS:
  COURIER_CREATED
  COURIER_UPDATED
  COURIER_STATUS_CHANGED
  COURIER_DELETED

ASSIGNMENTS:
  ASSIGNMENT_CREATED
  ASSIGNMENT_RETURNED

INSPECTIONS:
  INSPECTION_CREATED
  INSPECTION_RESULT_RECORDED

MAINTENANCE:
  MAINTENANCE_CREATED
  MAINTENANCE_APPROVED
  MAINTENANCE_COMPLETED

RENTAL_PLANS:
  PLAN_CREATED
  PLAN_UPDATED
  PLAN_ACTIVATED
  PLAN_DEACTIVATED

EARNINGS:
  EARNINGS_CREATED
  EARNINGS_UPDATED
  EARNINGS_APPROVED
  EARNINGS_PAID
  DEDUCTION_ADDED
  DEDUCTION_REMOVED

EMPLOYEES:
  EMPLOYEE_CREATED
  EMPLOYEE_UPDATED
  EMPLOYEE_ROLE_CHANGED
  EMPLOYEE_DEACTIVATED
  EMPLOYEE_REACTIVATED
*/
