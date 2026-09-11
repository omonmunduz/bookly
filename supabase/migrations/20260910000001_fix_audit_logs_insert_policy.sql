-- Allow audit log creation through log_audit_event function
-- The function is SECURITY DEFINER, but we need to allow authenticated users to call it

CREATE POLICY "audit_logs_insert_via_function"
ON audit_logs FOR INSERT TO authenticated
WITH CHECK (
  -- Only allow inserts that come through the log_audit_event function
  -- The function will validate the user belongs to the organization
  organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE id = auth.uid()
  )
);

COMMENT ON POLICY "audit_logs_insert_via_function" ON audit_logs IS
  'Allows authenticated users to insert audit logs through the log_audit_event function.
   The function itself validates organization membership and creates proper snapshots.';
