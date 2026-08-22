-- ============================================================================
-- E-BIKE RENTAL & COURIER MANAGEMENT — MAINTENANCE AND INSPECTIONS
-- ============================================================================
-- Migration 3 of 4: Maintenance records and bike inspections
--
-- This migration creates tables for:
--   - Maintenance records (repairs, replacements, service history)
--   - Bike inspections (condition assessment at return)
--
-- Business Rules Implemented:
--   - Photos REQUIRED for maintenance records
--   - Damage assessment requires manager approval
--   - Inspection determines next bike status (available/maintenance/damaged)
--
-- Migration order:
--   20260821000001 - bikes, couriers, rental plans
--   20260821000002 - assignments and earnings
--   20260821000003 - maintenance and inspections (this file)
--   20260821000004 - update roles and RLS, remove old tables
-- ============================================================================

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE maintenance_type AS ENUM (
    'repair',           -- Fixing broken components
    'inspection',       -- Scheduled check-up
    'replacement',      -- Replacing parts
    'cleaning',         -- Deep cleaning
    'other'
);

CREATE TYPE inspection_condition AS ENUM (
    'excellent',        -- Like new
    'good',            -- Normal wear
    'fair',            -- Visible wear but functional
    'poor',            -- Needs attention
    'damaged'          -- Requires repair
);

-- ============================================================================
-- MAINTENANCE RECORDS
-- ============================================================================
-- Every service performed on a bike. Tracks what was done, by whom, at what cost.
--
-- Business rule: Photos REQUIRED for maintenance work (proof of work).
-- Business rule: Damage repairs require manager approval (enforced in app layer).

CREATE TABLE maintenance_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bike_id           UUID NOT NULL REFERENCES bikes(id) ON DELETE RESTRICT,

    maintenance_type  maintenance_type NOT NULL,
    description       TEXT NOT NULL,
    cost              DECIMAL(15, 2) CHECK (cost IS NULL OR cost >= 0),

    -- Who performed the work
    performed_by      UUID REFERENCES user_profiles(id),  -- Typically mechanic
    performed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Details
    parts_replaced    TEXT,
    image_urls        TEXT[] NOT NULL,                    -- REQUIRED: Photos of work
    notes             TEXT,

    -- Approval tracking for damage repairs
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by       UUID REFERENCES user_profiles(id),  -- Manager who approved
    approved_at       TIMESTAMPTZ,

    created_at        TIMESTAMPTZ DEFAULT NOW(),

    -- Business rule: photos required
    CHECK (image_urls IS NOT NULL AND array_length(image_urls, 1) > 0),

    -- Business rule: if approved, must have approver
    CHECK (
        (requires_approval = FALSE)
        OR (requires_approval = TRUE AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    )
);

CREATE INDEX idx_maintenance_bike ON maintenance_records(bike_id, performed_at DESC);
CREATE INDEX idx_maintenance_org  ON maintenance_records(organization_id, performed_at DESC);
CREATE INDEX idx_maintenance_type ON maintenance_records(organization_id, maintenance_type);
CREATE INDEX idx_maintenance_pending_approval
    ON maintenance_records(organization_id, requires_approval)
    WHERE requires_approval = TRUE AND approved_by IS NULL;

COMMENT ON TABLE maintenance_records IS
  'Service history for bikes. Every repair, inspection, and maintenance event.

   Business rules:
   - Photos REQUIRED (image_urls must have at least one entry)
   - Damage repairs require manager approval before work begins
   - Cost tracking for expense reporting';

COMMENT ON COLUMN maintenance_records.image_urls IS
  'Array of storage paths to maintenance photos. REQUIRED field (min 1 photo).
   Stored in maintenance-photos bucket. Photos prove work was performed.';

COMMENT ON COLUMN maintenance_records.requires_approval IS
  'TRUE for damage repairs that need manager approval before proceeding.
   FALSE for routine maintenance. Enforced in application layer.';

COMMENT ON COLUMN maintenance_records.cost IS
  'Total cost of maintenance (parts + labor). NULL if not yet determined.
   Used for expense tracking and damage charge calculation.';

-- ============================================================================
-- BIKE INSPECTIONS
-- ============================================================================
-- Condition assessment performed when bike is returned from assignment.
-- Inspection determines next status: available, maintenance, or damaged.
--
-- Linked to assignment so we know what condition courier received vs returned.

CREATE TABLE bike_inspections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bike_id               UUID NOT NULL REFERENCES bikes(id) ON DELETE RESTRICT,
    assignment_id         UUID REFERENCES bike_assignments(id) ON DELETE SET NULL,

    -- Who inspected
    inspected_by          UUID REFERENCES user_profiles(id),
    inspected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Overall assessment
    overall_condition     inspection_condition NOT NULL,

    -- Component-level checks (optional detail)
    brakes_condition      inspection_condition,
    tires_condition       inspection_condition,
    lights_condition      inspection_condition,
    frame_condition       inspection_condition,
    battery_condition     inspection_condition,

    -- Damage tracking
    damage_notes          TEXT,
    damage_photos         TEXT[],                        -- Photos of any damage found

    -- Outcome
    requires_maintenance  BOOLEAN DEFAULT FALSE,
    next_status           bike_status NOT NULL,          -- What status bike should move to

    notes                 TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspections_bike ON bike_inspections(bike_id, inspected_at DESC);
CREATE INDEX idx_inspections_org  ON bike_inspections(organization_id, inspected_at DESC);
CREATE INDEX idx_inspections_assignment ON bike_inspections(assignment_id);
CREATE INDEX idx_inspections_maintenance_required
    ON bike_inspections(organization_id, requires_maintenance)
    WHERE requires_maintenance = TRUE;

COMMENT ON TABLE bike_inspections IS
  'Bike condition assessments performed at return from assignment.

   Inspection determines next_status:
   - "available" if bike is in good condition
   - "maintenance" if minor service needed
   - "damaged" if repairs required

   Component checks help identify specific issues quickly.';

COMMENT ON COLUMN bike_inspections.next_status IS
  'Status bike should transition to after this inspection.
   Set by inspector based on overall_condition assessment.
   Trigger updates bikes.status to match this value.';

COMMENT ON COLUMN bike_inspections.damage_photos IS
  'Photos of any damage found. Optional if no damage, required if overall_condition = "damaged".';

-- ============================================================================
-- TRIGGERS: Update bike status based on inspection
-- ============================================================================

-- When inspection is created, update bike status to match inspection result
CREATE OR REPLACE FUNCTION fn_inspection_update_bike_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update bike status based on inspection result
  UPDATE bikes
  SET status = NEW.next_status, updated_at = NOW()
  WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;

  -- If inspection is linked to an assignment, update assignment's condition_at_return
  IF NEW.assignment_id IS NOT NULL THEN
    UPDATE bike_assignments
    SET
      condition_at_return = NEW.overall_condition::TEXT,
      return_notes = COALESCE(return_notes || E'\n\n', '') || 'Inspection: ' || NEW.overall_condition::TEXT,
      updated_at = NOW()
    WHERE id = NEW.assignment_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inspection_update_bike_status
AFTER INSERT ON bike_inspections
FOR EACH ROW
EXECUTE FUNCTION fn_inspection_update_bike_status();

COMMENT ON FUNCTION fn_inspection_update_bike_status IS
  'Updates bike.status based on inspection.next_status.
   Also updates assignment.condition_at_return if inspection is linked to an assignment.

   Flow:
   1. Manager/mechanic receives bike return
   2. Creates inspection record with next_status
   3. Trigger updates bike.status automatically
   4. Bike becomes available/maintenance/damaged as appropriate';

-- ============================================================================
-- TRIGGERS: Create maintenance task from damage inspection
-- ============================================================================

-- When inspection finds damage, automatically create maintenance record placeholder
CREATE OR REPLACE FUNCTION fn_inspection_create_maintenance_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for damaged bikes or bikes requiring maintenance
  IF NEW.requires_maintenance = TRUE OR NEW.overall_condition = 'damaged' THEN
    INSERT INTO maintenance_records (
      organization_id,
      bike_id,
      maintenance_type,
      description,
      performed_by,
      performed_at,
      image_urls,
      requires_approval,
      notes
    ) VALUES (
      NEW.organization_id,
      NEW.bike_id,
      'repair',
      'Damage found during inspection: ' || COALESCE(NEW.damage_notes, NEW.overall_condition::TEXT),
      NEW.inspected_by,
      NOW(),
      COALESCE(NEW.damage_photos, ARRAY[]::TEXT[]),  -- Use inspection photos or empty array
      (NEW.overall_condition = 'damaged'),           -- Damage repairs need approval
      'Created automatically from inspection #' || NEW.id::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inspection_create_maintenance_task
AFTER INSERT ON bike_inspections
FOR EACH ROW
WHEN (NEW.requires_maintenance = TRUE OR NEW.overall_condition = 'damaged')
EXECUTE FUNCTION fn_inspection_create_maintenance_task();

COMMENT ON FUNCTION fn_inspection_create_maintenance_task IS
  'Auto-creates maintenance record when inspection finds damage or maintenance need.
   Maintenance record inherits inspection photos and notes.
   Damage repairs are flagged requires_approval = TRUE (manager must approve).';

-- ============================================================================
-- STORAGE BUCKET FOR MAINTENANCE PHOTOS
-- ============================================================================
-- Private bucket. Maintenance photos show bike condition, damage, repairs.
-- Photos are REQUIRED per business rules.
--
-- RLS policies will be added in migration 20260821000004 after role updates.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  FALSE,
  10485760,  -- 10 MB (maintenance photos may be detailed)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPER VIEWS: Bike current status with latest maintenance
-- ============================================================================

CREATE OR REPLACE VIEW bike_status_summary AS
SELECT
  b.id,
  b.organization_id,
  b.bike_number,
  b.model,
  b.status,

  -- Current assignment (if any)
  ba.id AS current_assignment_id,
  ba.courier_id,
  c.full_name AS courier_name,
  ba.assigned_at,

  -- Latest maintenance
  (
    SELECT performed_at
    FROM maintenance_records mr
    WHERE mr.bike_id = b.id
    ORDER BY mr.performed_at DESC
    LIMIT 1
  ) AS last_maintenance_at,

  -- Latest inspection
  (
    SELECT inspected_at
    FROM bike_inspections bi
    WHERE bi.bike_id = b.id
    ORDER BY bi.inspected_at DESC
    LIMIT 1
  ) AS last_inspection_at,

  -- Total maintenance cost (all time)
  (
    SELECT COALESCE(SUM(cost), 0)
    FROM maintenance_records mr
    WHERE mr.bike_id = b.id
      AND mr.cost IS NOT NULL
  ) AS total_maintenance_cost

FROM bikes b
LEFT JOIN bike_assignments ba
  ON ba.bike_id = b.id
  AND ba.returned_at IS NULL  -- Current assignment only
LEFT JOIN couriers c
  ON c.id = ba.courier_id
WHERE b.deleted_at IS NULL;

COMMENT ON VIEW bike_status_summary IS
  'Dashboard view: bike status with current assignment and maintenance summary.
   Used for "Bikes" list page and status widgets.';

-- ============================================================================
-- HELPER VIEWS: Maintenance pending approval
-- ============================================================================

CREATE OR REPLACE VIEW maintenance_pending_approval AS
SELECT
  mr.id,
  mr.organization_id,
  mr.bike_id,
  b.bike_number,
  b.model,
  mr.maintenance_type,
  mr.description,
  mr.cost,
  mr.performed_by,
  up.full_name AS performed_by_name,
  mr.performed_at,
  mr.created_at
FROM maintenance_records mr
JOIN bikes b ON b.id = mr.bike_id
LEFT JOIN user_profiles up ON up.id = mr.performed_by
WHERE mr.requires_approval = TRUE
  AND mr.approved_by IS NULL
  AND b.deleted_at IS NULL
ORDER BY mr.created_at ASC;

COMMENT ON VIEW maintenance_pending_approval IS
  'Maintenance records awaiting manager approval.
   Used for manager dashboard alerts and approval workflow.';
