-- ============================================================================
-- E-BIKE RENTAL & COURIER MANAGEMENT — ASSIGNMENTS AND EARNINGS
-- ============================================================================
-- Migration 2 of 4: Bike assignments, earnings periods, and deductions
--
-- This migration creates the tables for tracking:
--   - Historical bike assignments (who had which bike when, with which plan)
--   - Courier earnings periods (weekly/monthly settlement)
--   - Deductions (rental fees, damage, other)
--
-- Business Rules Implemented:
--   - One bike per courier at a time (validated in trigger)
--   - Only 'available' bikes can be assigned
--   - Assignment snapshots rental plan (price changes don't affect history)
--   - Full rental charge applies regardless of return timing
--
-- Migration order:
--   20260821000001 - bikes, couriers, rental plans
--   20260821000002 - assignments and earnings (this file)
--   20260821000003 - maintenance and inspections
--   20260821000004 - update roles and RLS, remove old tables
-- ============================================================================

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE earnings_status AS ENUM (
    'draft',        -- Being prepared
    'approved',     -- Ready for payment
    'paid'          -- Payment completed
);

CREATE TYPE deduction_type AS ENUM (
    'rental',       -- Bike rental fee for the period
    'damage',       -- Damage charges (requires manager approval)
    'equipment',    -- Helmet, lock, accessories
    'other'         -- Miscellaneous
);

-- ============================================================================
-- BIKE ASSIGNMENTS (Historical tracking)
-- ============================================================================
-- CRITICAL: This is a historical table. NEVER update the current assignment.
-- Instead, close it (set returned_at) and create a new one for reassignment.
--
-- Every row captures:
--   - Who had the bike
--   - When (assigned_at to returned_at)
--   - Which rental plan (with price snapshot)
--   - Condition at both ends
--
-- This enables: "Who had bike EB-005 on August 15?" and "How many times has
-- courier COU-0023 rented bikes?"

CREATE TABLE bike_assignments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bike_id                  UUID NOT NULL REFERENCES bikes(id) ON DELETE RESTRICT,
    courier_id               UUID NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,
    rental_plan_id           UUID NOT NULL REFERENCES rental_plans(id) ON DELETE RESTRICT,

    -- Rental plan snapshot: price changes must not rewrite history
    plan_name                TEXT NOT NULL,
    plan_duration_value      INTEGER NOT NULL,
    plan_duration_unit       duration_unit NOT NULL,
    plan_price               DECIMAL(15, 2) NOT NULL,

    -- Timeline
    assigned_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by              UUID REFERENCES user_profiles(id),
    returned_at              TIMESTAMPTZ,
    returned_by              UUID REFERENCES user_profiles(id),

    -- Condition tracking
    condition_at_assignment  TEXT NOT NULL,              -- Required at assignment
    condition_at_return      TEXT,                       -- Filled on return

    -- Notes
    assignment_notes         TEXT,
    return_notes             TEXT,

    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW(),

    -- Business rule: returned_at must be after assigned_at
    CHECK (returned_at IS NULL OR returned_at >= assigned_at)
);

CREATE INDEX idx_bike_assignments_bike    ON bike_assignments(bike_id);
CREATE INDEX idx_bike_assignments_courier ON bike_assignments(courier_id);
CREATE INDEX idx_bike_assignments_org     ON bike_assignments(organization_id);

-- Critical for "currently assigned" queries: only one NULL returned_at per bike
CREATE UNIQUE INDEX idx_bike_assignments_active_bike
    ON bike_assignments(organization_id, bike_id)
    WHERE returned_at IS NULL;

-- Critical for "max 1 bike per courier" rule: only one NULL returned_at per courier
CREATE UNIQUE INDEX idx_bike_assignments_active_courier
    ON bike_assignments(organization_id, courier_id)
    WHERE returned_at IS NULL;

-- Timeline queries: "what was assigned during period X?"
CREATE INDEX idx_bike_assignments_timeline
    ON bike_assignments(organization_id, assigned_at, returned_at);

COMMENT ON TABLE bike_assignments IS
  'Historical bike assignments. Every row is immutable once created.
   To reassign: close the current assignment (set returned_at), create new row.

   Business rules enforced:
   - One active assignment per bike (idx_bike_assignments_active_bike)
   - One active assignment per courier (idx_bike_assignments_active_courier)
   - Only "available" bikes can be assigned (trigger validation)';

COMMENT ON COLUMN bike_assignments.plan_name IS
  'Snapshot from rental_plans at assignment time. Changing the plan later must NOT
   rewrite what this assignment actually cost.';

COMMENT ON COLUMN bike_assignments.condition_at_assignment IS
  'Required field. Manager/mechanic records condition when bike is handed over.
   Example: "Good", "Minor scratches on left side", "Excellent condition".';

COMMENT ON COLUMN bike_assignments.condition_at_return IS
  'Filled when bike is returned. Compared with condition_at_assignment to assess damage.';

CREATE TRIGGER trg_bike_assignments_updated_at BEFORE UPDATE ON bike_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EARNINGS PERIODS
-- ============================================================================
-- Financial settlement for couriers. Typically weekly or monthly.
--
-- Formula: net_payout = gross_earnings - total_deductions
--
-- gross_earnings: Manual entry in MVP (what courier earned from Yandex Food)
-- total_deductions: SUM of deductions table (calculated by trigger)
-- net_payout: Calculated by trigger
--
-- Business rule: Full rental charge applies even if courier returned early.

CREATE TABLE earnings_periods (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    courier_id        UUID NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,

    -- Period boundaries
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,

    -- Financials
    gross_earnings    DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (gross_earnings >= 0),
    total_deductions  DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (total_deductions >= 0),
    net_payout        DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Workflow
    status            earnings_status DEFAULT 'draft',
    paid_at           TIMESTAMPTZ,

    notes             TEXT,
    created_by        UUID REFERENCES user_profiles(id),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    -- Business rule: period_end must be after period_start
    CHECK (period_end >= period_start),

    -- Business rule: paid_at can only be set when status = 'paid'
    CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR (status != 'paid' AND paid_at IS NULL))
);

CREATE INDEX idx_earnings_org     ON earnings_periods(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_earnings_courier ON earnings_periods(courier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_earnings_status  ON earnings_periods(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_earnings_period  ON earnings_periods(organization_id, period_start, period_end);

-- Prevent overlapping periods for the same courier
CREATE UNIQUE INDEX idx_earnings_no_overlap
    ON earnings_periods(organization_id, courier_id, period_start, period_end)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE earnings_periods IS
  'Financial settlement periods for couriers. Typically weekly or monthly.

   MVP: gross_earnings entered manually (Yandex integration in Phase 2).
   total_deductions and net_payout calculated by trigger from deductions table.

   Business rule: Full rental charge applies regardless of early return.';

COMMENT ON COLUMN earnings_periods.gross_earnings IS
  'Total earnings from deliveries. Manual entry in MVP (manager keys in Yandex data).
   Phase 2: auto-fetch from Yandex Food API.';

COMMENT ON COLUMN earnings_periods.total_deductions IS
  'SUM of deductions table. Calculated by trigger, never written by application.';

COMMENT ON COLUMN earnings_periods.net_payout IS
  'gross_earnings - total_deductions. Calculated by trigger.';

CREATE TRIGGER trg_earnings_periods_updated_at BEFORE UPDATE ON earnings_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEDUCTIONS
-- ============================================================================
-- Individual deductions applied to an earnings period.
--
-- Types:
--   - rental: bike rental fee (links to assignment via reference_id)
--   - damage: damage charges (requires manager approval before adding)
--   - equipment: helmet, lock, etc.
--   - other: miscellaneous
--
-- Business rule: Damage deductions require manager approval (validated in app layer).

CREATE TABLE deductions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    earnings_period_id  UUID NOT NULL REFERENCES earnings_periods(id) ON DELETE CASCADE,

    deduction_type      deduction_type NOT NULL,
    amount              DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    description         TEXT NOT NULL,

    -- Optional reference to source record
    reference_id        UUID,                         -- bike_assignment_id for rental deductions

    -- Audit
    created_by          UUID REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deductions_period ON deductions(earnings_period_id);
CREATE INDEX idx_deductions_org    ON deductions(organization_id);
CREATE INDEX idx_deductions_type   ON deductions(organization_id, deduction_type);

COMMENT ON TABLE deductions IS
  'Individual deductions applied to earnings periods.

   Business rule: damage deductions require manager approval (enforced in app layer).

   SUM(amount) per earnings_period_id is maintained in earnings_periods.total_deductions
   by trigger.';

COMMENT ON COLUMN deductions.reference_id IS
  'Optional link to source record:
   - rental deductions: bike_assignment.id
   - damage deductions: maintenance_record.id (added in migration 3)
   NULL for equipment and other types.';

-- ============================================================================
-- TRIGGERS: Maintain bike status during assignments
-- ============================================================================

-- When assignment is created, change bike status to 'assigned'
CREATE OR REPLACE FUNCTION fn_bike_assignment_create()
RETURNS TRIGGER AS $$
DECLARE
  v_bike_status bike_status;
  v_active_count INTEGER;
BEGIN
  -- Business rule: bike must be 'available' to be assigned
  SELECT status INTO v_bike_status
  FROM bikes
  WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;

  IF v_bike_status IS NULL THEN
    RAISE EXCEPTION 'Bike not found in this organization.';
  END IF;

  IF v_bike_status != 'available' THEN
    RAISE EXCEPTION 'Cannot assign bike with status "%". Only "available" bikes can be assigned.', v_bike_status;
  END IF;

  -- Business rule: courier can have max 1 bike at a time
  -- (The unique index idx_bike_assignments_active_courier enforces this at DB level,
  -- but we provide a friendlier error message here)
  SELECT COUNT(*) INTO v_active_count
  FROM bike_assignments
  WHERE courier_id = NEW.courier_id
    AND organization_id = NEW.organization_id
    AND returned_at IS NULL;

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Courier already has an active bike assignment. Max 1 bike per courier.';
  END IF;

  -- Update bike status to 'assigned'
  UPDATE bikes
  SET status = 'assigned', updated_at = NOW()
  WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bike_assignment_create
AFTER INSERT ON bike_assignments
FOR EACH ROW
WHEN (NEW.returned_at IS NULL)  -- Only for new active assignments
EXECUTE FUNCTION fn_bike_assignment_create();

-- When assignment is returned, change bike status back to 'available'
-- (or 'maintenance'/'damaged' if inspection reveals issues - handled in migration 3)
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  -- Assignment was just closed (returned_at set from NULL to a timestamp)
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Default: return bike to 'available' status
    -- Inspection (migration 3) may override this to 'maintenance' or 'damaged'
    UPDATE bikes
    SET status = 'available', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bike_assignment_return
AFTER UPDATE ON bike_assignments
FOR EACH ROW
WHEN (OLD.returned_at IS DISTINCT FROM NEW.returned_at)
EXECUTE FUNCTION fn_bike_assignment_return();

COMMENT ON FUNCTION fn_bike_assignment_create IS
  'Validates bike status is "available" and courier has no active assignments,
   then updates bike status to "assigned". Enforces 1-bike-per-courier rule.';

COMMENT ON FUNCTION fn_bike_assignment_return IS
  'When assignment is closed (returned_at set), returns bike to "available" status.
   Inspection workflow (migration 3) may override to "maintenance" or "damaged".';

-- ============================================================================
-- TRIGGERS: Calculate earnings period totals
-- ============================================================================

-- Recalculate total_deductions and net_payout when deductions change
CREATE OR REPLACE FUNCTION fn_recalc_earnings_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id UUID;
  v_total_deductions DECIMAL(15,2);
  v_gross DECIMAL(15,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_period_id := OLD.earnings_period_id;
  ELSE
    v_period_id := NEW.earnings_period_id;
  END IF;

  -- Sum all deductions for this period
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deductions
  FROM deductions
  WHERE earnings_period_id = v_period_id;

  -- Get gross earnings
  SELECT gross_earnings INTO v_gross
  FROM earnings_periods
  WHERE id = v_period_id;

  IF v_gross IS NULL THEN
    RETURN COALESCE(NEW, OLD);  -- Period was deleted
  END IF;

  -- Update totals
  UPDATE earnings_periods
  SET
    total_deductions = v_total_deductions,
    net_payout = v_gross - v_total_deductions,
    updated_at = NOW()
  WHERE id = v_period_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_earnings_on_deduction
AFTER INSERT OR UPDATE OR DELETE ON deductions
FOR EACH ROW
EXECUTE FUNCTION fn_recalc_earnings_totals();

-- Also recalculate when gross_earnings changes
CREATE OR REPLACE FUNCTION fn_recalc_earnings_on_gross_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_payout := NEW.gross_earnings - NEW.total_deductions;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_earnings_on_gross_change
BEFORE UPDATE OF gross_earnings ON earnings_periods
FOR EACH ROW
WHEN (OLD.gross_earnings IS DISTINCT FROM NEW.gross_earnings)
EXECUTE FUNCTION fn_recalc_earnings_on_gross_change();

COMMENT ON FUNCTION fn_recalc_earnings_totals IS
  'Recalculates earnings_periods.total_deductions and net_payout when deductions change.
   Maintains denormalized totals for fast dashboard queries.';

COMMENT ON FUNCTION fn_recalc_earnings_on_gross_change IS
  'Updates net_payout when gross_earnings is manually edited by manager.';

-- ============================================================================
-- HELPER FUNCTION: Generate earnings period number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_earnings_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(notes FROM 'EARN-' || current_year || '-([0-9]+)') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM earnings_periods
  WHERE organization_id = org_id;

  RETURN 'EARN-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_earnings_number IS
  'Generates earnings period reference: EARN-2026-0001. Optional, can be stored in notes.';
