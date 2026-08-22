# Database Migrations Summary

## E-Bike Rental & Courier Management System

### Migration Files Created

1. **20260821000001_bikes_and_couriers_schema.sql** (216 lines)
   - Creates `bikes`, `couriers`, `rental_plans` tables
   - New enums: `bike_status`, `courier_status`, `duration_unit`
   - Auto-numbering functions and triggers
   - Storage bucket for bike images
   - **Business rule: 1 bike per courier maximum**

2. **20260821000002_assignments_and_earnings.sql** (425 lines)
   - Creates `bike_assignments`, `earnings_periods`, `deductions` tables
   - New enums: `earnings_status`, `deduction_type`
   - Historical assignment tracking with rental plan snapshots
   - Bike status management triggers (available ↔ assigned)
   - Earnings calculation triggers (gross - deductions = net)
   - **Enforces: Only 'available' bikes can be assigned**
   - **Enforces: One active assignment per bike and per courier**

3. **20260821000003_maintenance_and_inspections.sql** (370 lines)
   - Creates `maintenance_records`, `bike_inspections` tables
   - New enums: `maintenance_type`, `inspection_condition`
   - Inspection workflow updates bike status
   - Auto-creates maintenance tasks from damage inspections
   - Helper views: `bike_status_summary`, `maintenance_pending_approval`
   - Storage bucket for maintenance photos
   - **Business rule: Photos required for maintenance**
   - **Business rule: Damage repairs require manager approval**

4. **20260821000004_roles_rls_and_cleanup.sql** (456 lines)
   - Updates user roles: `admin`, `manager`, `mechanic`
   - Migrates existing users (owner/admin → admin, employee → mechanic)
   - RLS policies for all new tables
   - Storage bucket RLS policies
   - Drops old tables: customers, products, sales, payments, inventory
   - Drops old enums and functions
   - Verification checks at end

### Total Migration Size
**1,467 lines** of SQL across 4 migration files

### Business Rules Enforced at Database Level

1. ✅ **1 bike per courier** (unique index + trigger validation)
2. ✅ **Only 'available' bikes assignable** (trigger check)
3. ✅ **Rental plan snapshot** (assignment copies plan details)
4. ✅ **Full charge for early return** (no prorating logic)
5. ✅ **Photos required** (CHECK constraints on image_urls)
6. ✅ **Status state machine** (triggers manage bike.status transitions)
7. ✅ **Historical integrity** (assignment table is append-only)

### Role-Based Access Control

| Resource | Admin | Manager | Mechanic |
|----------|-------|---------|----------|
| Bikes | Full | Full | Read |
| Couriers | Full | Full | Read |
| Assignments | Full | Full | Update (returns) |
| Earnings | Full | Full | **None** |
| Maintenance | Full | Approve | Create/Read |
| Inspections | Full | Full | Create/Read |

### Next Steps

1. Apply migrations to Supabase
2. Generate TypeScript types
3. Create backend repositories/services
4. Build frontend UI

## Running Migrations

```bash
# Apply to local Supabase
supabase db reset

# Or apply to remote
supabase db push

# Generate types
npm run db:generate-types
```
