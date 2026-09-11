-- ============================================================================
-- COURIER BALANCE LEDGER — TRANSACTION-BASED PAYMENT TRACKING
-- ============================================================================
-- Replaces the earnings_periods + income_entries + deductions model with a
-- running balance ledger. Every financial event is a separate transaction record.
--
-- Key changes:
--   - No more "pay period" as a gatekeeper for entering income/deductions
--   - Running balance per courier (sum of all transactions ever)
--   - Automatic rent_auto transaction when bike is assigned
--   - Manual transactions for payments, fines, and other adjustments
--   - Period fields for filtering/reporting, not for grouping
--
-- Migration order:
--   20260903000001 - courier balance ledger schema (this file)
--   20260903000002 - migrate existing earnings data to transactions
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE transaction_type AS ENUM (
    -- Debit (reduces balance, courier owes more)
    'rent_auto',                        -- Automatic: bike rental charge
    'fine_repair_part_manual',          -- Manual: violation or damage charge
    'prepayment_payout_manual',         -- Manual: promo fulfillment (courier gets money back)
    'other_debit_manual',               -- Manual: catch-all debit

    -- Credit (increases balance, courier pays or earns)
    'prepayment_manual',                -- Manual: courier paid rent
    'fine_repair_part_payment_manual',  -- Manual: courier paid fine/repair
    'other_credit_manual'               -- Manual: catch-all credit
);

CREATE TYPE transaction_direction AS ENUM ('debit', 'credit');

COMMENT ON TYPE transaction_type IS
  'Transaction types for courier balance ledger.

   Debit types reduce balance (courier owes):
   - rent_auto: automatic when bike assigned
   - fine_repair_part_manual: manager enters violation/damage charge
   - prepayment_payout_manual: manager returns money for promo fulfillment
   - other_debit_manual: catch-all

   Credit types increase balance (courier pays/earns):
   - prepayment_manual: manager confirms rent payment received
   - fine_repair_part_payment_manual: manager confirms fine/repair payment
   - other_credit_manual: catch-all';

-- ============================================================================
-- COURIER BALANCE TRANSACTIONS
-- ============================================================================
-- Immutable ledger of all financial transactions per courier.
-- Balance = SUM(credits) - SUM(debits)
--
-- Business rules:
--   - rent_auto transactions created automatically by assignment trigger
--   - Manual transaction types require a note
--   - Never UPDATE existing transactions (soft delete if correction needed)
--   - Period fields are for filtering, not grouping/gating

CREATE TABLE courier_balance_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    courier_id          UUID NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,

    -- Transaction classification
    type                transaction_type NOT NULL,
    direction           transaction_direction NOT NULL,
    amount              DECIMAL(15, 2) NOT NULL CHECK (amount > 0),

    -- Description
    note                TEXT,  -- Required for all manual types, optional for auto

    -- Period reference (for filtering/reporting, not a foreign key)
    period_start        DATE,
    period_end          DATE,

    -- Type-specific metadata (JSONB for flexibility)
    -- Examples:
    --   rent_auto: {"bike_number": "EB-005", "rental_plan": "Weekly", "assignment_id": "..."}
    --   fine_repair_part_manual: {"reason": "Damaged front brake", "repair_cost": 150}
    metadata            JSONB,

    -- Audit trail
    created_by          UUID REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete for corrections (create offsetting transaction instead of UPDATE)
    deleted_at          TIMESTAMPTZ,

    -- Business rule: manual transactions require a note
    CONSTRAINT note_required_for_manual CHECK (
        (type::TEXT LIKE '%_manual' AND note IS NOT NULL AND TRIM(note) != '')
        OR (type::TEXT NOT LIKE '%_manual')
    ),

    -- Business rule: period_end must be after period_start
    CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

CREATE INDEX idx_courier_balance_txns_courier
    ON courier_balance_transactions(courier_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_courier_balance_txns_org
    ON courier_balance_transactions(organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_courier_balance_txns_type
    ON courier_balance_transactions(organization_id, type)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_courier_balance_txns_direction
    ON courier_balance_transactions(organization_id, direction)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_courier_balance_txns_period
    ON courier_balance_transactions(organization_id, period_start, period_end)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_courier_balance_txns_created
    ON courier_balance_transactions(organization_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE courier_balance_transactions IS
  'Immutable ledger of all courier financial transactions.

   Balance = SUM(credits) - SUM(debits)

   Business rules:
   - rent_auto created automatically on bike assignment
   - Manual types require a note
   - Never UPDATE (create offsetting transaction for corrections)
   - Period fields for filtering/reporting, not grouping';

COMMENT ON COLUMN courier_balance_transactions.type IS
  'Transaction classification. Determines whether it is automatic or manual,
   and what UI/validation applies.';

COMMENT ON COLUMN courier_balance_transactions.direction IS
  'debit = reduces balance (courier owes), credit = increases balance (courier paid/earned).';

COMMENT ON COLUMN courier_balance_transactions.note IS
  'Free-text description. REQUIRED for all manual types. For rent_auto, auto-generated
   with bike plate and rental period, but manager can append additional context.';

COMMENT ON COLUMN courier_balance_transactions.period_start IS
  'Optional period boundary for filtering/reporting. For rent_auto, copied from assignment
   dates. For manual transactions, manager can set or leave NULL.';

COMMENT ON COLUMN courier_balance_transactions.metadata IS
  'Type-specific structured data (JSONB). Examples:
   - rent_auto: {"bike_number": "EB-005", "rental_plan": "Weekly", "assignment_id": "..."}
   - fine_repair_part_manual: {"reason": "Damaged brake", "repair_cost": 150}';

-- ============================================================================
-- COURIER BALANCES VIEW
-- ============================================================================
-- Computed view showing current balance per courier.
-- Balance = SUM(credits) - SUM(debits)

CREATE OR REPLACE VIEW courier_balances AS
SELECT
    c.id AS courier_id,
    c.organization_id,
    c.courier_code,
    c.full_name,
    COALESCE(
        SUM(CASE
            WHEN t.direction = 'credit' THEN t.amount
            WHEN t.direction = 'debit' THEN -t.amount
            ELSE 0
        END),
        0
    ) AS balance,
    COUNT(t.id) AS transaction_count,
    MAX(t.created_at) AS last_transaction_at
FROM couriers c
LEFT JOIN courier_balance_transactions t
    ON t.courier_id = c.id
    AND t.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.courier_code, c.full_name;

COMMENT ON VIEW courier_balances IS
  'Current balance per courier. Balance = SUM(credits) - SUM(debits).
   Includes couriers with zero transactions (balance = 0).';

-- ============================================================================
-- TRIGGER: Auto-create rent_auto transaction on bike assignment
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_create_rent_transaction_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_note TEXT;
BEGIN
    -- Generate auto note with bike number and rental period
    v_note := format(
        'Аренда велосипеда %s за период %s - %s',
        (SELECT bike_number FROM bikes WHERE id = NEW.bike_id),
        TO_CHAR(NEW.assigned_at, 'DD.MM.YYYY'),
        TO_CHAR(
            NEW.assigned_at + (NEW.plan_duration_value || ' ' || NEW.plan_duration_unit)::INTERVAL,
            'DD.MM.YYYY'
        )
    );

    -- Create rent_auto debit transaction
    INSERT INTO courier_balance_transactions (
        organization_id,
        courier_id,
        type,
        direction,
        amount,
        note,
        period_start,
        period_end,
        metadata,
        created_by,
        created_at
    ) VALUES (
        NEW.organization_id,
        NEW.courier_id,
        'rent_auto',
        'debit',
        NEW.plan_price,
        v_note,
        NEW.assigned_at::DATE,
        (NEW.assigned_at + (NEW.plan_duration_value || ' ' || NEW.plan_duration_unit)::INTERVAL)::DATE,
        jsonb_build_object(
            'bike_number', (SELECT bike_number FROM bikes WHERE id = NEW.bike_id),
            'bike_id', NEW.bike_id,
            'rental_plan', NEW.plan_name,
            'rental_plan_id', NEW.rental_plan_id,
            'assignment_id', NEW.id,
            'duration_value', NEW.plan_duration_value,
            'duration_unit', NEW.plan_duration_unit
        ),
        NEW.assigned_by,
        NEW.assigned_at
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_rent_transaction_on_assignment
AFTER INSERT ON bike_assignments
FOR EACH ROW
WHEN (NEW.returned_at IS NULL)  -- Only for new active assignments
EXECUTE FUNCTION fn_create_rent_transaction_on_assignment();

COMMENT ON FUNCTION fn_create_rent_transaction_on_assignment IS
  'Automatically creates a rent_auto debit transaction when a bike is assigned.
   Transaction amount is the rental plan price, note includes bike number and dates,
   metadata captures assignment details for audit trail.';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE courier_balance_transactions ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view all transactions in their organization
CREATE POLICY courier_balance_transactions_read ON courier_balance_transactions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Managers and admins can create transactions (manual types via UI, auto via trigger)
CREATE POLICY courier_balance_transactions_create ON courier_balance_transactions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Soft delete only (managers and admins can soft-delete in their org)
CREATE POLICY courier_balance_transactions_delete ON courier_balance_transactions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM user_profiles WHERE id = auth.uid()
    ) IN ('admin', 'manager')
  );

COMMENT ON POLICY courier_balance_transactions_read ON courier_balance_transactions IS
  'Managers and admins can view all transactions in their organization.';

COMMENT ON POLICY courier_balance_transactions_create ON courier_balance_transactions IS
  'Managers and admins can create transactions (manual via UI, rent_auto via trigger).';

COMMENT ON POLICY courier_balance_transactions_delete ON courier_balance_transactions IS
  'Managers and admins can soft-delete transactions (set deleted_at) in their organization.';
