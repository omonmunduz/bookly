/**
 * TYPE DEFINITIONS FOR E-BIKE RENTAL & COURIER MANAGEMENT
 *
 * These types will be auto-generated after migrations are applied.
 * Run: npm run db:generate-types
 *
 * For now, these are manual definitions to enable development.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type BikeStatus = 'available' | 'assigned' | 'returned' | 'maintenance' | 'damaged' | 'retired';
export type CourierStatus = 'active' | 'inactive' | 'suspended';
export type DurationUnit = 'days' | 'weeks' | 'months';
export type EarningsStatus = 'draft' | 'approved' | 'paid';
export type DeductionType = 'rental' | 'damage' | 'equipment' | 'other';
export type MaintenanceType = 'repair' | 'inspection' | 'replacement' | 'cleaning' | 'other';
export type InspectionCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
export type UserRole = 'admin' | 'manager' | 'mechanic';

// ============================================================================
// BIKE
// ============================================================================

export interface Bike {
  id: string;
  organization_id: string;
  bike_number: string;
  serial_number: string | null;
  model: string;
  status: BikeStatus;
  purchase_date: string | null;
  purchase_price: number | null;
  condition_notes: string | null;
  battery_info: string | null;
  image_url: string; // REQUIRED
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateBikeInput {
  bike_number?: string;
  serial_number?: string | null;
  model: string;
  status?: BikeStatus;
  purchase_date?: string | null;
  purchase_price?: number | null;
  condition_notes?: string | null;
  battery_info?: string | null;
  image_url: string; // REQUIRED
}

export interface UpdateBikeInput {
  serial_number?: string | null;
  model?: string;
  status?: BikeStatus;
  purchase_date?: string | null;
  purchase_price?: number | null;
  condition_notes?: string | null;
  battery_info?: string | null;
  image_url?: string;
}

// ============================================================================
// COURIER
// ============================================================================

export interface Courier {
  id: string;
  organization_id: string;
  courier_code: string;
  full_name: string;
  phone: string;
  identification_number: string | null;
  address: string | null;
  emergency_contact: string | null;
  start_date: string;
  status: CourierStatus;
  yandex_identifier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateCourierInput {
  courier_code?: string;
  full_name: string;
  phone: string;
  identification_number?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  start_date?: string;
  status?: CourierStatus;
  yandex_identifier?: string | null;
  notes?: string | null;
}

export interface UpdateCourierInput {
  full_name?: string;
  phone?: string;
  identification_number?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  status?: CourierStatus;
  yandex_identifier?: string | null;
  notes?: string | null;
}

// ============================================================================
// RENTAL PLAN
// ============================================================================

export interface RentalPlan {
  id: string;
  organization_id: string;
  name: string;
  duration_value: number;
  duration_unit: DurationUnit;
  price: number;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateRentalPlanInput {
  name: string;
  duration_value: number;
  duration_unit: DurationUnit;
  price: number;
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateRentalPlanInput {
  name?: string;
  duration_value?: number;
  duration_unit?: DurationUnit;
  price?: number;
  description?: string | null;
  is_active?: boolean;
}

// ============================================================================
// BIKE ASSIGNMENT
// ============================================================================

export interface BikeAssignment {
  id: string;
  organization_id: string;
  bike_id: string;
  courier_id: string;
  rental_plan_id: string;
  plan_name: string;
  plan_duration_value: number;
  plan_duration_unit: DurationUnit;
  plan_price: number;
  assigned_at: string;
  assigned_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
  condition_at_assignment: string;
  condition_at_return: string | null;
  assignment_notes: string | null;
  return_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssignmentInput {
  bike_id: string;
  courier_id: string;
  rental_plan_id: string;
  condition_at_assignment: string;
  assignment_notes?: string | null;
}

export interface ReturnAssignmentInput {
  assignment_id: string;
  condition_at_return: string;
  return_notes?: string | null;
}

// ============================================================================
// EARNINGS PERIOD
// ============================================================================

export interface EarningsPeriod {
  id: string;
  organization_id: string;
  courier_id: string;
  period_start: string;
  period_end: string;
  gross_earnings: number;
  total_deductions: number;
  net_payout: number;
  status: EarningsStatus;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateEarningsPeriodInput {
  courier_id: string;
  period_start: string;
  period_end: string;
  status?: EarningsStatus;
  notes?: string | null;
}

export interface UpdateEarningsPeriodInput {
  gross_earnings?: number;
  status?: EarningsStatus;
  paid_at?: string | null;
  notes?: string | null;
}

// ============================================================================
// INCOME ENTRY
// ============================================================================

export interface IncomeEntry {
  id: string;
  organization_id: string;
  earnings_period_id: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateIncomeEntryInput {
  earnings_period_id: string;
  amount: number;
  notes?: string | null;
}

// ============================================================================
// DEDUCTION
// ============================================================================

export interface Deduction {
  id: string;
  organization_id: string;
  earnings_period_id: string;
  deduction_type: DeductionType;
  amount: number;
  description: string;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateDeductionInput {
  earnings_period_id: string;
  deduction_type: DeductionType;
  amount: number;
  description: string;
  reference_id?: string | null;
}

// ============================================================================
// EARNINGS ACTIVITY (AUDIT TRAIL)
// ============================================================================

export type EarningsActivityType =
  | 'period_created'
  | 'period_updated'
  | 'period_deleted'
  | 'status_changed'
  | 'marked_as_paid'
  | 'income_added'
  | 'income_deleted'
  | 'deduction_added'
  | 'deduction_deleted';

export interface EarningsActivity {
  id: string;
  organization_id: string;
  earnings_period_id: string;
  activity_type: EarningsActivityType;
  actor_id: string;
  details: Record<string, any> | null;
  created_at: string;
}

/**
 * Earnings activity with actor information joined in.
 */
export interface EarningsActivityWithActor extends EarningsActivity {
  actor: {
    full_name: string;
    email: string;
  };
}

/**
 * An earnings period with its courier and deductions joined in, as returned by
 * EarningsRepository.getWithDeductions.
 *
 * The courier is a partial — the repository selects only the three fields the
 * detail page shows — so this cannot be `EarningsPeriod & { courier: Courier }`.
 */
export interface EarningsPeriodWithDeductions extends EarningsPeriod {
  courier: {
    courier_code: string;
    full_name: string;
    phone: string | null;
  };
  deductions: Deduction[];
  income_entries: IncomeEntry[];
  activity: EarningsActivityWithActor[];
}

/**
 * Totals across a date range, summed from the periods that fall inside it.
 *
 * Field names are camelCase, unlike the row types: these are computed in the
 * repository rather than selected from Postgres.
 */
export interface EarningsSummary {
  totalGrossEarnings: number;
  totalDeductions: number;
  totalNetPayouts: number;
  periodCount: number;
}

/** Filters accepted by the earnings list. Mirrors earningsFiltersSchema. */
export interface EarningsFilters {
  courierId?: string;
  status?: EarningsStatus;
  /** ISO date (yyyy-mm-dd). */
  startDate?: string;
  /** ISO date (yyyy-mm-dd). */
  endDate?: string;
}

// ============================================================================
// LIST FILTERS
// ============================================================================
//
// Each of these mirrors the Zod filter schema in its feature folder. They live
// here as well because Server Components and Client Components both need the
// shape, and importing from a feature's schemas.ts would pull Zod into those
// bundles. The schema stays the runtime source of truth; these are the
// compile-time mirror.

/** Filters accepted by the bike list. Mirrors bikeFiltersSchema. */
export interface BikeFilters {
  status?: BikeStatus;
  /** Matched against bike_number, model, and serial_number. */
  search?: string;
}

/** Filters accepted by the courier list. Mirrors courierFiltersSchema. */
export interface CourierFilters {
  status?: CourierStatus;
  /** Matched against courier_code, full_name, and phone. */
  search?: string;
}

/** Filters accepted by the assignment list. Mirrors assignmentFiltersSchema. */
export interface AssignmentFilters {
  bikeId?: string;
  courierId?: string;
  /** When true, only assignments with no return recorded yet. */
  active?: boolean;
}

// ============================================================================
// MAINTENANCE RECORD
// ============================================================================

export interface MaintenanceRecord {
  id: string;
  organization_id: string;
  bike_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  cost: number | null;
  performed_by: string | null;
  performed_at: string;
  parts_replaced: string | null;
  image_urls: string[]; // REQUIRED
  notes: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CreateMaintenanceRecordInput {
  bike_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  cost?: number | null;
  parts_replaced?: string | null;
  image_urls: string[]; // REQUIRED
  notes?: string | null;
  requires_approval?: boolean;
}

export interface ApproveMaintenanceInput {
  maintenance_id: string;
}

// ============================================================================
// BIKE INSPECTION
// ============================================================================

export interface BikeInspection {
  id: string;
  organization_id: string;
  bike_id: string;
  assignment_id: string | null;
  inspected_by: string | null;
  inspected_at: string;
  overall_condition: InspectionCondition;
  brakes_condition: InspectionCondition | null;
  tires_condition: InspectionCondition | null;
  lights_condition: InspectionCondition | null;
  frame_condition: InspectionCondition | null;
  battery_condition: InspectionCondition | null;
  damage_notes: string | null;
  damage_photos: string[] | null;
  requires_maintenance: boolean;
  next_status: BikeStatus;
  notes: string | null;
  created_at: string;
}

export interface CreateInspectionInput {
  bike_id: string;
  assignment_id?: string | null;
  overall_condition: InspectionCondition;
  brakes_condition?: InspectionCondition | null;
  tires_condition?: InspectionCondition | null;
  lights_condition?: InspectionCondition | null;
  frame_condition?: InspectionCondition | null;
  battery_condition?: InspectionCondition | null;
  damage_notes?: string | null;
  damage_photos?: string[] | null;
  requires_maintenance: boolean;
  next_status: BikeStatus;
  notes?: string | null;
}

// ============================================================================
// VIEWS
// ============================================================================

export interface BikeStatusSummary {
  id: string;
  organization_id: string;
  bike_number: string;
  model: string;
  status: BikeStatus;
  current_assignment_id: string | null;
  courier_id: string | null;
  courier_name: string | null;
  assigned_at: string | null;
  last_maintenance_at: string | null;
  last_inspection_at: string | null;
  total_maintenance_cost: number;
}

export interface MaintenancePendingApproval {
  id: string;
  organization_id: string;
  bike_id: string;
  bike_number: string;
  model: string;
  maintenance_type: MaintenanceType;
  description: string;
  cost: number | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
  created_at: string;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export type OrganizationId = string;
export type UserId = string;

export type Result<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
