# E-BIKE SYSTEM ANALYSIS & PROPOSED CHANGES

**Date:** 2026-08-28  
**Status:** Analysis Complete - Awaiting Approval

---

## EXECUTIVE SUMMARY

The current e-bike rental system has several critical gaps:

1. **Mechanic permissions are too broad** — mechanics can create/edit bikes and couriers through the UI
2. **Incorrect lifecycle enforcement** — inspections/maintenance only work on AVAILABLE bikes
3. **Missing returned-bike workflow** — bikes immediately become AVAILABLE after return
4. **No audit trail** — cannot answer "who performed this action?"
5. **Maintenance/inspection are not fully historical** — some data gets overwritten
6. **RLS exists but has gaps** — database-level security needs refinement

---

## A. CURRENT ARCHITECTURE

### Database Schema

**Tables:**
- `bikes` — bike master records
- `couriers` — courier master records
- `rental_plans` — pricing plans
- `bike_assignments` — historical assignments (good: immutable history)
- `earnings_periods` — courier financials
- `deductions` — financial deductions
- `maintenance_records` — maintenance history (good: already historical)
- `bike_inspections` — inspection history (good: already historical)

**Enums:**
- `user_role`: `admin`, `manager`, `mechanic`
- `bike_status`: `available`, `assigned`, `maintenance`, `damaged`, `retired`

**Actor Tracking (Current State):**
- `bikes.created_by` — WHO created bike ✅
- `couriers.created_by` — WHO created courier ✅
- `bike_assignments.assigned_by` — WHO assigned ✅
- `bike_assignments.returned_by` — WHO received return ✅
- `maintenance_records.performed_by` — WHO performed maintenance ✅
- `maintenance_records.approved_by` — WHO approved ✅
- `bike_inspections.inspected_by` — WHO inspected ✅
- `earnings_periods.created_by` — WHO created earnings ✅
- `deductions.created_by` — WHO created deduction ✅

**✅ FINDING:** Actor tracking already exists at the database level for most operations.

---

## B. PROBLEMS FOUND

### **PROBLEM 1: Mechanic Permissions Too Broad**

**Current RLS Policies:**

```sql
-- Bikes: Everyone can view, Manager+ can create/update
bikes_select_same_org           — ✅ mechanics can view
bikes_insert_manager_or_above   — ✅ mechanics CANNOT create (correct)
bikes_update_manager_or_above   — ✅ mechanics CANNOT update (correct)

-- Couriers: Everyone can view, Manager+ can create/update
couriers_select_same_org           — ✅ mechanics can view
couriers_insert_manager_or_above   — ✅ mechanics CANNOT create (correct)
couriers_update_manager_or_above   — ✅ mechanics CANNOT update (correct)

-- Maintenance: Everyone can view and create, Manager+ can approve
maintenance_insert_any_role     — ✅ mechanics CAN create (correct)
maintenance_update_manager_or_above — ✅ mechanics CANNOT approve (correct)

-- Inspections: Everyone can create, Manager+ can update
inspections_insert_any_role     — ✅ mechanics CAN create (correct)
inspections_update_manager_or_above — ✅ mechanics CANNOT update (correct)

-- Assignments: Everyone can view, Manager+ can create, Everyone can update
bike_assignments_update_all_roles — ⚠️ mechanics CAN update assignments
```

**Application-Level Guards:**

```typescript
// src/app/actions/bikes.ts
async function getService(minimumRole?: 'admin' | 'manager') {
  const user = minimumRole
    ? await requireMinimumRole(minimumRole)  // Redirects if insufficient
    : await requireActiveUser();              // Any authenticated user
}

createBikeAction()   → getService('manager')  ✅ Blocked for mechanics
updateBikeAction()   → getService('manager')  ✅ Blocked for mechanics
listBikesAction()    → getService()           ✅ Mechanics can view
```

**✅ FINDING:** Database RLS is CORRECT. Server actions are CORRECT.

**❌ GAP:** UI components may render forms/buttons that mechanics cannot submit.

**RISK:** Low — mechanics hitting blocked actions get redirected to dashboard.

---

### **PROBLEM 2: Incorrect Bike Lifecycle**

**Current Business Rules (from service layer):**

```typescript
// maintenance/service.ts:126-132
if (bike.status === 'assigned') {
  return {
    success: false,
    error: 'Cannot create maintenance record for an assigned bike. 
            Return the bike first.',
  };
}

// maintenance/service.ts:368-373
if (bike.status === 'assigned') {
  return {
    success: false,
    error: 'Cannot inspect an assigned bike. Return the bike first or 
            perform inspection during assignment/return.',
  };
}
```

**❌ INCORRECT BUSINESS RULE:**
- Maintenance can only be performed on non-assigned bikes
- Inspections can only be performed on non-assigned bikes

**CORRECT BUSINESS RULE SHOULD BE:**
- Maintenance can be performed on bikes in ANY status except `retired`
- Inspections can be performed on bikes in ANY status except `retired`

**Current Return Workflow:**

```sql
-- From migration 20260821000002_assignments_and_earnings.sql:308-321
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Default: return bike to 'available' status
    UPDATE bikes
    SET status = 'available', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**❌ PROBLEM:** When `returned_at` is set, bike immediately becomes `available`.

**No intermediate inspection state.**

---

### **PROBLEM 3: Missing "Returned / Awaiting Inspection" Status**

**Current bike_status enum:**
```sql
CREATE TYPE bike_status AS ENUM (
    'available',
    'assigned',
    'maintenance',
    'damaged',
    'retired'
);
```

**❌ MISSING:** `returned` status for bikes awaiting post-return inspection.

**Required Workflow:**
```
COURIER RETURNS BIKE
        ↓
BIKE STATUS = 'returned'  ← MISSING
        ↓
MECHANIC INSPECTS
        ↓
INSPECTION RESULT:
  - OK         → status = 'available'
  - Minor      → status = 'maintenance'
  - Damaged    → status = 'damaged'
```

**Current Reality:**
```
COURIER RETURNS BIKE
        ↓
BIKE STATUS = 'available'  ← WRONG
        ↓
(Bike can be immediately assigned to another courier)
```

---

### **PROBLEM 4: No Unified Audit Log**

**Current State:**
- Actor tracking exists at the RECORD level (created_by, performed_by, etc.)
- NO unified audit log for business actions
- Cannot answer: "Show me everything Timur did today"
- Cannot answer: "Who changed this courier's status on August 15?"

**What Exists:**
- `bikes.created_by` — WHO created
- BUT: No record of WHO changed status, WHO edited fields, WHO deleted

**What's Missing:**
- Audit trail for bike status changes
- Audit trail for courier status changes  
- Audit trail for bike edits
- Audit trail for courier edits
- Audit trail for role changes
- Audit trail for rental plan changes

---

### **PROBLEM 5: Historical Records Are Good, But Incomplete**

**✅ GOOD: These are already historical:**
- `bike_assignments` — immutable, never updated after creation
- `maintenance_records` — append-only
- `bike_inspections` — append-only

**❌ GAP: These lack full history:**
- `bikes` table — edits overwrite previous values (no history of model changes, etc.)
- `couriers` table — edits overwrite previous values
- `rental_plans` table — edits overwrite previous values

**EXAMPLE SCENARIO:**

```
Bike EB-001:
- Created: Aug 1, model = "Giant E-Bike Pro"
- Edited:  Aug 10, model = "Giant E-Bike Pro V2"

Question: What model was this bike on August 5?
Answer: CANNOT DETERMINE (history was overwritten)
```

**However:** This may be acceptable for an MVP. Full change-data-capture is expensive.

---

## C. PROPOSED CHANGES

### **C.1: Add 'returned' Bike Status**

**Database Migration:**

```sql
-- Add 'returned' to bike_status enum
ALTER TYPE bike_status ADD VALUE 'returned' AFTER 'assigned';
```

**Updated enum:**
```sql
bike_status: 'available', 'assigned', 'returned', 'maintenance', 'damaged', 'retired'
```

**Update trigger:**

```sql
-- When assignment is returned, set bike to 'returned' status
CREATE OR REPLACE FUNCTION fn_bike_assignment_return()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Set bike to 'returned' status (awaiting inspection)
    UPDATE bikes
    SET status = 'returned', updated_at = NOW()
    WHERE id = NEW.bike_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Inspection trigger already handles next status:**
```sql
-- From migration 20260821000003: fn_inspection_update_bike_status
-- Already updates bike.status based on inspection.next_status
-- No changes needed
```

---

### **C.2: Remove Incorrect Status Checks**

**Changes to MaintenanceService:**

```typescript
// CURRENT (lines 126-132)
if (bike.status === 'assigned') {
  return { success: false, error: 'Cannot create maintenance...' };
}

// PROPOSED
if (bike.status === 'retired') {
  return { success: false, error: 'Cannot create maintenance for retired bike' };
}
// Allow maintenance on: available, assigned, returned, maintenance, damaged
```

```typescript
// CURRENT (lines 368-373)
if (bike.status === 'assigned') {
  return { success: false, error: 'Cannot inspect assigned bike...' };
}

// PROPOSED
if (bike.status === 'retired') {
  return { success: false, error: 'Cannot inspect retired bike' };
}
// Allow inspection on: available, assigned, returned, maintenance, damaged
```

**Rationale:** A bike that's out on assignment can break. The mechanic must be able to create a maintenance record that says "courier reported brake failure" even while bike is still assigned.

---

### **C.3: Prevent Assigning 'returned' Bikes**

**Update assignment validation trigger:**

```sql
-- Current check (line 274)
IF v_bike_status != 'available' THEN
  RAISE EXCEPTION 'Cannot assign bike with status "%". Only "available" bikes can be assigned.', v_bike_status;
END IF;

-- NO CHANGE NEEDED
-- 'returned' bikes cannot be assigned ✅
```

**Validation is already correct** — only `available` bikes can be assigned.

---

### **C.4: Create Audit Log System**

**New Table:**

```sql
CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Actor
  actor_user_id       UUID NOT NULL REFERENCES user_profiles(id),
  actor_name_snapshot TEXT NOT NULL,  -- Name at time of action
  actor_role_snapshot user_role NOT NULL,  -- Role at time of action
  
  -- Action
  action              TEXT NOT NULL,  -- 'BIKE_CREATED', 'INSPECTION_APPROVED', etc.
  entity_type         TEXT NOT NULL,  -- 'bike', 'courier', 'inspection', etc.
  entity_id           UUID NOT NULL,  -- ID of affected entity
  entity_name_snapshot TEXT,  -- Human-readable identifier (bike number, courier name)
  
  -- Details
  metadata            JSONB,  -- Structured action details
  
  -- Timestamp
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(organization_id, action);
```

**Actions to Log:**

```
BIKES:
- BIKE_CREATED
- BIKE_UPDATED (with changed fields in metadata)
- BIKE_STATUS_CHANGED (from → to)
- BIKE_ASSIGNED
- BIKE_RETURNED
- BIKE_DELETED

COURIERS:
- COURIER_CREATED
- COURIER_UPDATED
- COURIER_STATUS_CHANGED
- COURIER_ASSIGNED_BIKE
- COURIER_RETURNED_BIKE

INSPECTIONS:
- INSPECTION_CREATED
- INSPECTION_RESULT_RECORDED (condition, next_status)

MAINTENANCE:
- MAINTENANCE_CREATED
- MAINTENANCE_APPROVED
- MAINTENANCE_COMPLETED

RENTAL PLANS:
- PLAN_CREATED
- PLAN_UPDATED
- PLAN_ACTIVATED
- PLAN_DEACTIVATED

EMPLOYEES:
- EMPLOYEE_CREATED
- EMPLOYEE_UPDATED
- EMPLOYEE_ROLE_CHANGED
- EMPLOYEE_DEACTIVATED

EARNINGS:
- EARNINGS_CREATED
- EARNINGS_APPROVED
- EARNINGS_PAID
- DEDUCTION_ADDED
```

---

### **C.5: Audit Logging Implementation Strategy**

**Option A: Application-Layer Logging**

**Pros:**
- Easy to implement
- Full control over what's logged
- Can log computed fields easily

**Cons:**
- Can be bypassed if someone uses raw SQL
- Must remember to call logging in every service method

**Implementation:**

```typescript
// src/features/audit/service.ts
export class AuditService {
  async log(params: {
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    metadata?: Record<string, any>;
  }) {
    const user = await getCurrentUser();
    
    await this.repository.create({
      organization_id: user.organizationId,
      actor_user_id: user.id,
      actor_name_snapshot: user.fullName,
      actor_role_snapshot: user.role,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      entity_name_snapshot: params.entityName,
      metadata: params.metadata,
    });
  }
}

// Usage in BikesService.create():
const bike = await this.repository.create(...);
await this.auditService.log({
  action: 'BIKE_CREATED',
  entityType: 'bike',
  entityId: bike.id,
  entityName: bike.bike_number,
  metadata: { model: bike.model, status: bike.status },
});
```

**Option B: Database Triggers**

**Pros:**
- Cannot be bypassed
- Automatic — no manual calls needed
- Captures all changes including direct SQL

**Cons:**
- Harder to exclude fields (e.g., don't log updated_at changes)
- More complex trigger code
- Harder to test

**Recommendation:** Start with Option A (application-layer). Add triggers later if needed.

---

### **C.6: Enhanced Bike History View**

**Create unified history query:**

```typescript
// src/features/bikes/service.ts
async getBikeTimeline(bikeId: string): Promise<BikeTimelineEvent[]> {
  // Combine:
  // 1. Audit logs for this bike
  // 2. Assignments
  // 3. Inspections
  // 4. Maintenance records
  // Sort by timestamp DESC
  // Return unified timeline
}
```

**Timeline Event Type:**

```typescript
type BikeTimelineEvent = {
  timestamp: string;
  eventType: 'created' | 'assigned' | 'returned' | 'inspected' | 'maintenance' | 'status_changed' | 'edited';
  actor: { id: string; name: string; role: string };
  description: string;
  metadata?: Record<string, any>;
};
```

**Example Output:**

```
Bike EB-001 Timeline:

Aug 28, 11:30 — Status changed to 'available'
  by Timur Abdullaev (mechanic)
  from 'returned' to 'available'

Aug 28, 11:15 — Inspection completed
  by Timur Abdullaev (mechanic)
  Result: Good condition, approved

Aug 28, 10:45 — Bike returned
  by Manager A (manager)
  Courier: Bakyt

Aug 20, 09:00 — Bike assigned
  by Manager A (manager)
  Courier: Bakyt, Plan: Weekly Plan

Aug 15, 14:30 — Maintenance completed
  by Timur Abdullaev (mechanic)
  Type: Brake adjustment

Aug 1, 10:00 — Bike created
  by Omurbek Nazarov (admin)
  Model: Giant E-Bike Pro
```

---

## D. PROPOSED PERMISSION MATRIX

| Action | Admin | Manager | Mechanic |
|--------|-------|---------|----------|
| **BIKES** |
| View bikes | ✅ | ✅ | ✅ |
| View available bikes | ✅ | ✅ | ✅ |
| Create bike | ✅ | ✅ | ❌ |
| Edit bike master info | ✅ | ✅ | ❌ |
| Change bike status (manual) | ✅ | ✅ | ❌ |
| Delete bike | ✅ | ✅ | ❌ |
| **COURIERS** |
| View couriers | ✅ | ✅ | ✅ |
| Create courier | ✅ | ✅ | ❌ |
| Edit courier info | ✅ | ✅ | ❌ |
| Change courier status | ✅ | ✅ | ❌ |
| Delete courier | ✅ | ✅ | ❌ |
| **ASSIGNMENTS** |
| View assignments | ✅ | ✅ | ✅ |
| Assign bike to courier | ✅ | ✅ | ❌ |
| Return bike | ✅ | ✅ | ✅* |
| View assignment history | ✅ | ✅ | ✅ |
| **INSPECTIONS** |
| View inspections | ✅ | ✅ | ✅ |
| Create inspection | ✅ | ✅ | ✅ |
| Approve inspection result | ✅ | ✅ | ❌ |
| **MAINTENANCE** |
| View maintenance records | ✅ | ✅ | ✅ |
| Create maintenance record | ✅ | ✅ | ✅ |
| Approve maintenance (damage) | ✅ | ✅ | ❌ |
| View maintenance history | ✅ | ✅ | ✅ |
| **RENTAL PLANS** |
| View plans | ✅ | ✅ | ✅ |
| Create plan | ✅ | ✅ | ❌ |
| Edit plan | ✅ | ✅ | ❌ |
| Activate/deactivate plan | ✅ | ✅ | ❌ |
| **EARNINGS** |
| View earnings | ✅ | ✅ | ❌ |
| Create earnings period | ✅ | ✅ | ❌ |
| Add deductions | ✅ | ✅ | ❌ |
| Approve/pay earnings | ✅ | ✅ | ❌ |
| **EMPLOYEES** |
| View employees | ✅ | ✅ | ❌ |
| Invite employee | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Deactivate employee | ✅ | ❌ | ❌ |
| **AUDIT** |
| View audit logs | ✅ | ✅ | ❌ |

**Notes:**
- ✅* Mechanics can record bike returns (they receive returned bikes)
- Current RLS already enforces most of these
- Application layer needs minor adjustments

---

## E. PROPOSED BIKE STATE MACHINE

```
[AVAILABLE]
    ↓ (assign to courier)
[ASSIGNED]
    ↓ (courier returns bike)
[RETURNED] ← NEW STATUS
    ↓ (mechanic inspects)
    ├─→ [AVAILABLE] (if OK)
    ├─→ [MAINTENANCE] (if minor issues)
    └─→ [DAMAGED] (if major damage)

[MAINTENANCE]
    ↓ (maintenance completed)
[AVAILABLE]

[DAMAGED]
    ↓ (repair completed)
[AVAILABLE]

[Any status except RETIRED]
    ↓ (manually retire)
[RETIRED] (terminal state)
```

**State Transition Rules:**

| From | To | Trigger | Who |
|------|-----|---------|-----|
| available | assigned | Assignment created | Manager |
| assigned | returned | Assignment returned | Manager/Mechanic |
| returned | available | Inspection: good condition | Mechanic |
| returned | maintenance | Inspection: needs service | Mechanic |
| returned | damaged | Inspection: damaged | Mechanic |
| maintenance | available | Maintenance completed | Mechanic |
| damaged | maintenance | Repair started | Manager |
| damaged | available | Repair completed | Manager |
| any | retired | Manual retirement | Admin |

---

## F. DATABASE MIGRATION STRATEGY

### Migration 1: Add 'returned' status

```sql
-- 001_add_returned_status.sql
ALTER TYPE bike_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'assigned';
```

### Migration 2: Update return trigger

```sql
-- 002_update_return_trigger.sql
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
```

### Migration 3: Create audit_logs table

```sql
-- 003_create_audit_logs.sql
-- (See C.4 above for full DDL)
```

### Migration 4: Add audit logging functions

```sql
-- 004_audit_log_helpers.sql
CREATE OR REPLACE FUNCTION log_audit(
  p_organization_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_role user_role;
BEGIN
  -- Get actor details
  SELECT full_name, role
  INTO v_actor_name, v_actor_role
  FROM user_profiles
  WHERE id = p_actor_user_id;
  
  -- Insert audit log
  INSERT INTO audit_logs (
    organization_id,
    actor_user_id,
    actor_name_snapshot,
    actor_role_snapshot,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_organization_id,
    p_actor_user_id,
    v_actor_name,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 5: RLS for audit_logs

```sql
-- 005_audit_logs_rls.sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view audit logs
CREATE POLICY "audit_logs_select_manager_or_above"
ON audit_logs FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- No INSERT policy — audit logs created via service layer or triggers only
-- No UPDATE/DELETE policies — audit logs are immutable
```

---

## G. UI CHANGES

### G.1: Dashboard for Mechanics

**NEW: "Bikes Awaiting Inspection" Widget**

```
┌──────────────────────────────────────┐
│ Bikes Awaiting Inspection           │
├──────────────────────────────────────┤
│ EB-001  Giant Pro    Returned 2h ago │
│ EB-005  Trek E-MTB   Returned 5h ago │
│ EB-012  Specialized  Returned 1d ago │
└──────────────────────────────────────┘
```

**Filter bikes by status = 'returned'**

### G.2: Inspection Form

**REMOVE status check** — allow inspection of bikes in any status except 'retired'

**Current error:**
```
"Cannot inspect an assigned bike. Return the bike first."
```

**After fix:**
```
(No error — inspection form works for all non-retired bikes)
```

### G.3: Bike Detail Page

**Add "History" tab:**

```
┌─────────────────────────────────────────────┐
│ Bike EB-001                                 │
├─────────────────────────────────────────────┤
│ [Details] [History] [Maintenance]           │
├─────────────────────────────────────────────┤
│ Aug 28, 11:30                               │
│ Status changed to 'available'               │
│ by Timur Abdullaev (mechanic)              │
│                                             │
│ Aug 28, 11:15                               │
│ Inspection completed                        │
│ by Timur Abdullaev (mechanic)              │
│ Result: Good condition                      │
│                                             │
│ Aug 28, 10:45                               │
│ Bike returned                               │
│ by Manager A (manager)                      │
│ Courier: Bakyt                              │
└─────────────────────────────────────────────┘
```

### G.4: Hide Buttons for Mechanics

**Current issue:** Mechanics see disabled "Add Bike" button

**Solution:** Conditionally render based on role

```typescript
{hasRole(user, 'manager') && (
  <Button onClick={() => setShowCreateForm(true)}>
    Add Bike
  </Button>
)}
```

**Apply to:**
- Add Bike button
- Edit Bike button
- Add Courier button
- Edit Courier button
- Assign Bike button
- Create Rental Plan button

---

## H. TESTING STRATEGY

### H.1: Database Tests

```sql
-- Test 1: Returned bikes cannot be assigned
DO $$
BEGIN
  -- Set bike to 'returned'
  UPDATE bikes SET status = 'returned' WHERE bike_number = 'EB-001';
  
  -- Try to assign (should fail)
  INSERT INTO bike_assignments (bike_id, courier_id, ...) 
  VALUES (...);
  
  -- Expected: EXCEPTION "Cannot assign bike with status 'returned'"
END $$;

-- Test 2: Inspection transitions bike from 'returned' to 'available'
-- Set bike to 'returned'
-- Create inspection with next_status = 'available'
-- Verify bike.status = 'available'

-- Test 3: Mechanics cannot create bikes
SET ROLE mechanic_test_user;
INSERT INTO bikes (...);
-- Expected: RLS violation
```

### H.2: Service Layer Tests

```typescript
describe('MaintenanceService', () => {
  it('allows maintenance on returned bikes', async () => {
    // Set bike status to 'returned'
    // Create maintenance record
    // Should succeed
  });
  
  it('allows inspection on assigned bikes', async () => {
    // Set bike status to 'assigned'
    // Create inspection
    // Should succeed
  });
  
  it('prevents maintenance on retired bikes', async () => {
    // Set bike status to 'retired'
    // Try to create maintenance
    // Should fail with error message
  });
});
```

### H.3: Permission Tests

```typescript
describe('Mechanic permissions', () => {
  it('mechanics cannot create bikes', async () => {
    const user = await createMechanicUser();
    const result = await createBikeAction(input);
    // Should redirect to dashboard
  });
  
  it('mechanics can create inspections', async () => {
    const user = await createMechanicUser();
    const result = await createInspectionAction(input);
    expect(result.success).toBe(true);
  });
});
```

### H.4: Workflow Integration Tests

```typescript
describe('Return and inspection workflow', () => {
  it('complete flow: assign → return → inspect → available', async () => {
    // 1. Assign bike to courier
    const assignment = await assignBike(...);
    expect(bike.status).toBe('assigned');
    
    // 2. Return bike
    await returnBike(assignment.id);
    expect(bike.status).toBe('returned');
    
    // 3. Inspect bike (good condition)
    await createInspection({
      bike_id: bike.id,
      overall_condition: 'good',
      next_status: 'available',
    });
    expect(bike.status).toBe('available');
    
    // 4. Verify audit trail
    const history = await getBikeTimeline(bike.id);
    expect(history).toHaveLength(4); // created, assigned, returned, inspected
  });
});
```

---

## I. IMPLEMENTATION PHASES

### Phase 1: Core Lifecycle Fixes (High Priority)

**Tasks:**
1. Add 'returned' bike status ✓
2. Update return trigger to set status='returned' ✓
3. Remove incorrect status checks from MaintenanceService ✓
4. Remove incorrect status checks from InspectionService ✓
5. Update TypeScript types ✓
6. Test return workflow ✓

**Estimated effort:** 4-6 hours  
**Risk:** Low (straightforward changes)

### Phase 2: Audit System (High Priority)

**Tasks:**
1. Create audit_logs table ✓
2. Create audit helper functions ✓
3. Add RLS policies for audit_logs ✓
4. Implement AuditService ✓
5. Add audit logging to all service methods ✓
6. Test audit trail completeness ✓

**Estimated effort:** 8-12 hours  
**Risk:** Medium (many integration points)

### Phase 3: UI Refinements (Medium Priority)

**Tasks:**
1. Add "Bikes Awaiting Inspection" widget ✓
2. Hide inaccessible buttons for mechanics ✓
3. Add bike history timeline view ✓
4. Add courier history timeline view ✓
5. Update dashboard for mechanics ✓

**Estimated effort:** 6-8 hours  
**Risk:** Low (UI-only changes)

### Phase 4: Testing & Documentation (High Priority)

**Tasks:**
1. Write database migration tests ✓
2. Write service layer tests ✓
3. Write permission tests ✓
4. Write integration tests ✓
5. Update CLAUDE.md with new workflows ✓
6. Write user documentation for mechanics ✓

**Estimated effort:** 6-8 hours  
**Risk:** Low

---

## J. RISKS & MITIGATIONS

### Risk 1: Breaking Existing Assignments

**Risk:** Changing return trigger might affect existing unreturned assignments

**Mitigation:**
- Migration includes data validation
- Test on copy of production database first
- Roll out during low-usage window

### Risk 2: Audit Log Volume

**Risk:** audit_logs table grows quickly and slows queries

**Mitigation:**
- Add partition by month after 6 months
- Archive logs older than 1 year
- Index optimization on frequently queried columns

### Risk 3: Mechanics Confused by New Workflow

**Risk:** Mechanics don't understand they must inspect returned bikes

**Mitigation:**
- Dashboard clearly shows "Bikes Awaiting Inspection"
- In-app notifications when bike is returned
- Training documentation with screenshots

### Risk 4: Migration Rollback Complexity

**Risk:** Can't easily roll back 'returned' status after deployment

**Mitigation:**
- Keep rollback script ready
- Monitor for 48 hours after deployment
- Gradual rollout (single organization first)

---

## K. QUESTIONS FOR PRODUCT OWNER

### Question 1: Historical Bike/Courier Edits

**Question:** Do you need full change history for bike/courier master records?

**Context:** Currently, editing a bike's model overwrites the old value. We have no history of what the model was previously.

**Options:**
1. **Keep current behavior** — master records are current-state only
2. **Add change tracking** — create `bike_changes` table that logs every edit
3. **Add audit logs only** — record "bike edited" but not field-by-field diffs

**Recommendation:** Option 3 (audit logs) for MVP. Option 2 only if regulatory requirement.

### Question 2: Mechanic Return Permission

**Question:** Should mechanics be able to RECEIVE bike returns, or only managers?

**Context:** Current permission matrix allows mechanics to update assignments (including returns). This makes sense if a mechanic is the one physically receiving the bike.

**Recommendation:** Allow mechanics to receive returns (current behavior is correct).

### Question 3: Audit Log Retention

**Question:** How long should audit logs be kept?

**Options:**
1. Forever (grows indefinitely)
2. 1 year (archive after 1 year)
3. 3 years (compliance requirement)

**Recommendation:** 1 year active, archive older logs to separate table.

### Question 4: Anonymous Actions

**Question:** What if a record has created_by = NULL (e.g., created via admin panel during setup)?

**Context:** Some early records might not have actor tracking.

**Recommendation:** Show as "System" in UI. Audit logs always require actor.

---

## L. APPROVAL CHECKLIST

**Before proceeding with implementation:**

- [ ] Product owner has reviewed this document
- [ ] Proposed bike status machine is approved
- [ ] Proposed permission matrix is approved
- [ ] Audit log scope is approved
- [ ] Migration strategy is approved
- [ ] Testing strategy is approved
- [ ] Implementation phases are approved
- [ ] Questions in Section K are answered

**Approved by:** ________________  
**Date:** ________________

---

## M. SUMMARY

### What Currently Works Well ✅

1. **Database schema is solid** — good separation of concerns
2. **Historical tracking exists** — assignments, maintenance, inspections are immutable
3. **Actor tracking exists** — created_by, performed_by fields are in place
4. **RLS is mostly correct** — permissions are enforced at database level
5. **Business rules are enforced** — service layer validates operations

### What Needs Fixing ❌

1. **Add 'returned' bike status** — bikes should not immediately become available
2. **Remove incorrect status checks** — maintenance/inspection should work on more statuses
3. **Add unified audit log** — track all business actions in one place
4. **Hide UI elements** — mechanics shouldn't see buttons they can't use
5. **Add bike/courier history views** — show complete timeline of events

### Architecture Quality ⭐

**Overall: 8/10**

**Strengths:**
- Clean separation of repository/service/action layers
- Good use of TypeScript types
- RLS policies are thoughtfully designed
- Triggers handle complex state transitions correctly

**Areas for improvement:**
- Audit logging is missing
- Some business rules are too restrictive
- UI doesn't fully respect role permissions

**Recommendation:** The foundation is excellent. The proposed changes are incremental improvements, not architectural rewrites.

---

**End of Analysis**
