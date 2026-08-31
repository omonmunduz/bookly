-- ============================================================================
-- MIGRATION: Income Entries and Audit Trail
-- ============================================================================
-- Changes the earnings model from single editable gross_earnings to additive
-- income entries, plus adds comprehensive audit logging.
--
-- Changes:
--   1. New income_entries table (replaces editable gross_earnings field)
--   2. New earnings_activity table (audit trail)
--   3. Modify earnings_periods to make gross_earnings computed
--   4. Triggers to maintain gross_earnings as SUM(income_entries.amount)
--   5. Triggers to log all earnings actions
--
-- Migration path: Existing earnings_periods.gross_earnings values are migrated
-- to income_entries with a note "Migrated from legacy gross_earnings field".

-- ============================================================================
-- INCOME ENTRIES
-- ============================================================================
-- Individual income entries that make up gross earnings for a period.
-- Additive model: each entry adds to the total, never overwrites.

CREATE TABLE income_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    earnings_period_id  UUID NOT NULL REFERENCES earnings_periods(id) ON DELETE CASCADE,

    amount              DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    notes               TEXT,

    -- Audit
    created_by          UUID REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_income_entries_period ON income_entries(earnings_period_id);
CREATE INDEX idx_income_entries_org    ON income_entries(organization_id);
CREATE INDEX idx_income_entries_date   ON income_entries(created_at);

COMMENT ON TABLE income_entries IS
  'Individual income entries for an earnings period. Additive model: gross_earnings
   is the SUM of all entries. Manager adds income incrementally (e.g. 400, then 300,
   then 200) rather than editing a single field.

   Maintained by trigger: earnings_periods.gross_earnings = SUM(income_entries.amount).';

-- ============================================================================
-- EARNINGS ACTIVITY (AUDIT TRAIL)
-- ============================================================================
-- Comprehensive audit log for all actions on earnings periods.
-- Records who did what, when, and relevant details.

CREATE TYPE earnings_activity_type AS ENUM (
    'period_created',
    'period_updated',
    'period_deleted',
    'status_changed',
    'marked_as_paid',
    'income_added',
    'income_deleted',
    'deduction_added',
    'deduction_deleted'
);

CREATE TABLE earnings_activity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    earnings_period_id  UUID NOT NULL REFERENCES earnings_periods(id) ON DELETE CASCADE,

    activity_type       earnings_activity_type NOT NULL,

    -- The user who performed the action
    actor_id            UUID NOT NULL REFERENCES user_profiles(id),

    -- Contextual data about the action (JSONB for flexibility)
    -- Examples:
    --   income_added: {"amount": 400, "notes": "Week 1 earnings"}
    --   status_changed: {"from": "draft", "to": "approved"}
    --   marked_as_paid: {"amount": 1250.50}
    details             JSONB,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_earnings_activity_period ON earnings_activity(earnings_period_id);
CREATE INDEX idx_earnings_activity_org    ON earnings_activity(organization_id, created_at DESC);
CREATE INDEX idx_earnings_activity_actor  ON earnings_activity(actor_id);
CREATE INDEX idx_earnings_activity_type   ON earnings_activity(activity_type);

COMMENT ON TABLE earnings_activity IS
  'Audit trail for all actions on earnings periods. Records actor, action type,
   relevant details, and timestamp. Displayed as "History" in the UI.';

COMMENT ON COLUMN earnings_activity.details IS
  'JSONB context for the action. Structure varies by activity_type:
   - income_added: {"amount": 400, "notes": "..."}
   - status_changed: {"from": "draft", "to": "approved"}
   - marked_as_paid: {"amount": 1250.50}
   - deduction_added: {"type": "rental", "amount": 150, "description": "..."}';

-- ============================================================================
-- TRIGGER: Recalculate gross_earnings when income entries change
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalc_gross_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id UUID;
  v_org_id UUID;
  v_total DECIMAL(15, 2);
BEGIN
  -- Determine which period to recalculate
  IF TG_OP = 'DELETE' THEN
    v_period_id := OLD.earnings_period_id;
    v_org_id := OLD.organization_id;
  ELSE
    v_period_id := NEW.earnings_period_id;
    v_org_id := NEW.organization_id;
  END IF;

  -- Calculate total income for the period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM income_entries
  WHERE earnings_period_id = v_period_id
    AND organization_id = v_org_id;

  -- Update gross_earnings
  UPDATE earnings_periods
  SET gross_earnings = v_total
  WHERE id = v_period_id
    AND organization_id = v_org_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_income_entry_recalc_after_insert
AFTER INSERT ON income_entries
FOR EACH ROW
EXECUTE FUNCTION fn_recalc_gross_earnings();

CREATE TRIGGER trg_income_entry_recalc_after_delete
AFTER DELETE ON income_entries
FOR EACH ROW
EXECUTE FUNCTION fn_recalc_gross_earnings();

COMMENT ON FUNCTION fn_recalc_gross_earnings IS
  'Maintains earnings_periods.gross_earnings as SUM(income_entries.amount).
   Fires after INSERT/DELETE on income_entries.';

-- ============================================================================
-- TRIGGER: Log income entry actions
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_log_income_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      NEW.organization_id,
      NEW.earnings_period_id,
      'income_added',
      NEW.created_by,
      jsonb_build_object(
        'amount', NEW.amount,
        'notes', NEW.notes
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      OLD.organization_id,
      OLD.earnings_period_id,
      'income_deleted',
      current_setting('app.current_user_id', true)::UUID,
      jsonb_build_object(
        'amount', OLD.amount,
        'notes', OLD.notes
      )
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_income_entry_activity
AFTER INSERT OR DELETE ON income_entries
FOR EACH ROW
EXECUTE FUNCTION fn_log_income_entry_activity();

-- ============================================================================
-- TRIGGER: Log deduction actions
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_log_deduction_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      NEW.organization_id,
      NEW.earnings_period_id,
      'deduction_added',
      NEW.created_by,
      jsonb_build_object(
        'type', NEW.deduction_type,
        'amount', NEW.amount,
        'description', NEW.description
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      OLD.organization_id,
      OLD.earnings_period_id,
      'deduction_deleted',
      current_setting('app.current_user_id', true)::UUID,
      jsonb_build_object(
        'type', OLD.deduction_type,
        'amount', OLD.amount,
        'description', OLD.description
      )
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_deduction_activity
AFTER INSERT OR DELETE ON deductions
FOR EACH ROW
EXECUTE FUNCTION fn_log_deduction_activity();

-- ============================================================================
-- TRIGGER: Log earnings period actions
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_log_earnings_period_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  -- Get actor from created_by or current_user_id setting
  v_actor_id := COALESCE(
    NEW.created_by,
    OLD.created_by,
    current_setting('app.current_user_id', true)::UUID
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      'period_created',
      v_actor_id,
      jsonb_build_object(
        'courier_id', NEW.courier_id,
        'period_start', NEW.period_start,
        'period_end', NEW.period_end
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO earnings_activity (
        organization_id,
        earnings_period_id,
        activity_type,
        actor_id,
        details
      ) VALUES (
        NEW.organization_id,
        NEW.id,
        CASE
          WHEN NEW.status = 'paid' THEN 'marked_as_paid'::earnings_activity_type
          ELSE 'status_changed'::earnings_activity_type
        END,
        v_actor_id,
        jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status,
          'amount', CASE WHEN NEW.status = 'paid' THEN NEW.net_payout END
        )
      );
    END IF;

    -- Log other updates (notes, etc.)
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO earnings_activity (
        organization_id,
        earnings_period_id,
        activity_type,
        actor_id,
        details
      ) VALUES (
        NEW.organization_id,
        NEW.id,
        'period_updated',
        v_actor_id,
        jsonb_build_object('field', 'notes')
      );
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO earnings_activity (
      organization_id,
      earnings_period_id,
      activity_type,
      actor_id,
      details
    ) VALUES (
      OLD.organization_id,
      OLD.id,
      'period_deleted',
      v_actor_id,
      jsonb_build_object(
        'courier_id', OLD.courier_id,
        'period_start', OLD.period_start,
        'period_end', OLD.period_end
      )
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_earnings_period_activity
AFTER INSERT OR UPDATE OR DELETE ON earnings_periods
FOR EACH ROW
EXECUTE FUNCTION fn_log_earnings_period_activity();

-- ============================================================================
-- DATA MIGRATION: Migrate existing gross_earnings to income_entries
-- ============================================================================

-- For each existing earnings period with gross_earnings > 0, create an income
-- entry with the current value and a migration note.

INSERT INTO income_entries (
  organization_id,
  earnings_period_id,
  amount,
  notes,
  created_by,
  created_at
)
SELECT
  organization_id,
  id,
  gross_earnings,
  'Migrated from legacy gross_earnings field',
  created_by,
  created_at
FROM earnings_periods
WHERE gross_earnings > 0
  AND deleted_at IS NULL;

-- The trigger will have already recalculated gross_earnings, but we ensure
-- consistency by running the recalculation manually for all periods.

UPDATE earnings_periods
SET gross_earnings = (
  SELECT COALESCE(SUM(amount), 0)
  FROM income_entries
  WHERE income_entries.earnings_period_id = earnings_periods.id
    AND income_entries.organization_id = earnings_periods.organization_id
)
WHERE deleted_at IS NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_activity ENABLE ROW LEVEL SECURITY;

-- Income entries: same access as earnings_periods (manager+)
CREATE POLICY income_entries_access ON income_entries
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Earnings activity: read-only for managers, system writes via triggers
CREATE POLICY earnings_activity_read ON earnings_activity
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Allow inserts for the activity log (triggers will use this)
CREATE POLICY earnings_activity_insert ON earnings_activity
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TRIGGER trg_income_entry_recalc_after_insert ON income_entries IS
  'Recalculates earnings_periods.gross_earnings when income is added.';

COMMENT ON TRIGGER trg_income_entry_recalc_after_delete ON income_entries IS
  'Recalculates earnings_periods.gross_earnings when income is removed.';

COMMENT ON TRIGGER trg_log_income_entry_activity ON income_entries IS
  'Logs income additions/deletions to earnings_activity audit trail.';

COMMENT ON TRIGGER trg_log_deduction_activity ON deductions IS
  'Logs deduction additions/deletions to earnings_activity audit trail.';

COMMENT ON TRIGGER trg_log_earnings_period_activity ON earnings_periods IS
  'Logs period creation, updates, status changes, and deletions to audit trail.';
