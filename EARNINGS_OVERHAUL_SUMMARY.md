# Earnings System Overhaul - Implementation Summary

## Overview

Successfully implemented a comprehensive overhaul of the earnings system with three major improvements:

1. **Additive Income Entries** - Changed from single editable gross_earnings to multiple additive income entries
2. **Mark as Paid Functionality** - Added ability to mark earnings periods as paid with confirmation dialog
3. **Complete Audit Trail** - Implemented comprehensive activity logging for all earnings actions

## Database Changes

### New Migration: `20260831000001_income_entries_and_audit.sql`

#### 1. Income Entries Table
```sql
CREATE TABLE income_entries (
    id                  UUID PRIMARY KEY,
    organization_id     UUID NOT NULL,
    earnings_period_id  UUID NOT NULL,
    amount              DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    notes               TEXT,
    created_by          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

- **Additive model**: Each entry adds to the total, never overwrites
- Manager adds income incrementally (e.g. 400, then 300, then 200)
- `gross_earnings` is maintained as SUM(income_entries.amount) by trigger

#### 2. Earnings Activity Table (Audit Trail)
```sql
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
    id                  UUID PRIMARY KEY,
    organization_id     UUID NOT NULL,
    earnings_period_id  UUID NOT NULL,
    activity_type       earnings_activity_type NOT NULL,
    actor_id            UUID NOT NULL,
    details             JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

- Records who did what, when, and relevant details
- JSONB `details` field stores context (amounts, notes, status changes)
- Displayed as "History" section in the UI

#### 3. Automatic Triggers

**Income Recalculation:**
- `fn_recalc_gross_earnings()` - Maintains `earnings_periods.gross_earnings` as SUM of income entries
- Fires after INSERT/DELETE on income_entries

**Activity Logging:**
- `fn_log_income_entry_activity()` - Logs income additions/deletions
- `fn_log_deduction_activity()` - Logs deduction additions/deletions
- `fn_log_earnings_period_activity()` - Logs period creation, updates, status changes

#### 4. Data Migration
- Existing `gross_earnings` values migrated to `income_entries` with note "Migrated from legacy gross_earnings field"
- Preserves all historical data

## Backend Changes

### Type Definitions (`src/lib/types/ebike.ts`)

**New Interfaces:**
```typescript
interface IncomeEntry {
  id: string;
  organization_id: string;
  earnings_period_id: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface CreateIncomeEntryInput {
  earnings_period_id: string;
  amount: number;
  notes?: string | null;
}

type EarningsActivityType =
  | 'period_created'
  | 'income_added'
  | 'deduction_added'
  | 'marked_as_paid'
  // ... etc

interface EarningsActivity {
  id: string;
  activity_type: EarningsActivityType;
  actor_id: string;
  details: Record<string, any> | null;
  created_at: string;
}

interface EarningsActivityWithActor extends EarningsActivity {
  actor: {
    full_name: string;
    email: string;
  };
}
```

**Modified:**
- `CreateEarningsPeriodInput` - Removed `gross_earnings` field
- `UpdateEarningsPeriodInput` - Removed `gross_earnings` field
- `EarningsPeriodWithDeductions` - Added `income_entries` and `activity` arrays

### Repository (`src/features/earnings/repository.ts`)

**New Methods:**
```typescript
// Income entries
async listIncomeEntries(earningsPeriodId: string, organizationId: string): Promise<IncomeEntry[]>
async createIncomeEntry(input: CreateIncomeEntryInput, organizationId: string, userId: string): Promise<IncomeEntry>
async deleteIncomeEntry(id: string, organizationId: string): Promise<void>
```

**Modified:**
- `getWithDeductions()` - Now also fetches `income_entries` and `activity` with actor information
- Orders income entries and deductions by created_at ascending
- Orders activity by created_at descending (newest first)

### Service Layer (`src/features/earnings/service.ts`)

**New Methods:**
```typescript
async addIncome(input: CreateIncomeEntryInput, userId: string): Promise<Result<IncomeEntry>>
async deleteIncome(id: string): Promise<Result<void>>
```

**Business Rules Enforced:**
- Cannot add/delete income from paid periods
- Income amount must be greater than zero
- All actions logged to activity table with actor

**Modified:**
- `create()` - Removed gross_earnings validation (starts at zero)
- `update()` - Removed gross_earnings field

### Server Actions (`src/app/actions/earnings.ts`)

**New Actions:**
```typescript
async function addIncomeAction(input: CreateIncomeEntryInput): Promise<Result<{ id: string }>>
async function deleteIncomeAction(id: string): Promise<Result<void>>
```

- Revalidates earnings paths after income changes
- Uses authenticated user as actor

## Frontend Changes

### New Components

#### 1. `AddIncomeButton` (`src/components/earnings/add-income-button.tsx`)
- Opens dialog to add income entry
- Fields: amount (required), notes (optional)
- Validates amount > 0
- Shows success/error toasts
- Refreshes page after success

#### 2. `DeleteIncomeButton` (`src/components/earnings/delete-income-button.tsx`)
- Small icon button for each income entry row
- Confirms deletion with native confirm dialog
- Only shown when period is in draft status

#### 3. `EarningsActivityLog` (`src/components/earnings/activity-log.tsx`)
- Displays complete audit trail
- Shows activity type badge, timestamp, details, and actor
- Formats details based on activity type:
  - Income added: "Added $400 — Week 1 earnings"
  - Status changed: "Changed from draft to approved"
  - Marked as paid: "Paid $1,250.50"
  - Deduction added: "Added rental deduction: $150 — Weekly bike rental"

#### 4. `MarkAsPaidButton` (`src/components/earnings/mark-as-paid-button.tsx`)
- Two variants: `icon` (list view) and `full` (edit page)
- Confirmation dialog shows courier name and net payout
- Sets status='paid' and paid_at=NOW()
- Disabled when already paid

### Modified Components

#### `EditEarningsForm` (`src/components/earnings/edit-earnings-form.tsx`)

**Before:**
- Single "Gross Earnings" input field
- Edit to change the value

**After:**
- "Income Entries" table showing all income entries
- Columns: Date, Notes, Amount, Actions (delete button)
- "Add Income" button (only in draft status)
- Summary recalculates from sum of all entries
- Activity log section at bottom
- "Mark as Paid" button next to "Save Changes"

**Layout:**
1. Period Information card
2. Income Entries card (with table)
3. Notes card
4. Deductions card
5. Summary card (Total Income, Total Deductions, Net Payout)
6. Activity Log card
7. Action buttons (Cancel, Save Changes, Mark as Paid)

#### `CreateEarningsPeriodForm` (`src/components/earnings/create-period-form.tsx`)

**Before:**
- Required "Gross Earnings" field

**After:**
- Removed gross earnings field
- Period created with zero income
- Redirects to edit page after creation (instead of detail page)
- Help text: "After creating the period, add income entries and deductions on the edit page."

#### `EarningsList` (`src/components/earnings/earnings-list.tsx`)
- Added "Mark as Paid" icon button next to Edit button
- Shows checkmark icon, disabled when already paid

### Schemas (`src/features/earnings/schemas.ts`)

**New:**
```typescript
export const createIncomeEntrySchema = z.object({
  earnings_period_id: z.string().uuid(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  notes: z.string().trim().max(500).nullable().optional(),
});
```

**Modified:**
- `createEarningsPeriodSchema` - Removed `gross_earnings` field
- `updateEarningsPeriodSchema` - Removed `gross_earnings` field

## User Workflow

### Creating a New Earnings Period

1. Click "New period" button
2. Select courier
3. Enter period dates (start/end)
4. Add optional notes
5. Click "Create period" → Redirects to edit page
6. Click "Add Income" to add first income entry
7. Enter amount and optional notes
8. Repeat to add more income entries
9. Add deductions as needed
10. Review summary
11. Click "Mark as Paid" when ready

### Adding Income to Existing Period

1. Navigate to earnings period edit page
2. View existing income entries in table
3. Click "Add Income" button
4. Enter amount (required) and notes (optional)
5. Click "Add Income" to confirm
6. Income appears in table
7. Summary updates automatically
8. Action logged in Activity History

### Viewing Audit Trail

All actions are automatically logged and visible in the "Activity History" section:
- Period created - shows who created it and when
- Income added - shows amount and notes
- Income deleted - shows what was removed
- Deduction added/deleted - shows type, amount, description
- Status changed - shows from/to states
- Marked as paid - shows final payout amount

Each entry shows:
- Activity type badge
- Timestamp
- Details of the action
- Actor name and email

## Benefits

### 1. Additive Income Model
- **Transparency**: See exactly when each income amount was added
- **Flexibility**: Add income incrementally as it comes in (e.g. weekly, daily)
- **Audit**: Never lose track of income sources

### 2. Complete Audit Trail
- **Accountability**: Every action tracked with who did it
- **Compliance**: Full history for financial auditing
- **Debugging**: Easy to see what changed and when

### 3. Mark as Paid
- **Workflow**: Clear distinction between draft, approved, and paid periods
- **Lock**: Paid periods cannot be edited (enforced in business logic)
- **History**: Exact timestamp when payment was made

## Database Schema Summary

```
earnings_periods (existing, modified by triggers)
  ├─ gross_earnings (computed from income_entries)
  └─ paid_at (set when marked as paid)

income_entries (NEW)
  ├─ earnings_period_id → earnings_periods
  ├─ amount
  ├─ notes
  └─ created_by → user_profiles

earnings_activity (NEW)
  ├─ earnings_period_id → earnings_periods
  ├─ activity_type (enum)
  ├─ actor_id → user_profiles
  └─ details (JSONB)

Triggers:
  - fn_recalc_gross_earnings (maintains gross_earnings)
  - fn_log_income_entry_activity (logs income actions)
  - fn_log_deduction_activity (logs deduction actions)
  - fn_log_earnings_period_activity (logs period actions)
```

## Testing Checklist

- [ ] Create new earnings period (should start with $0 income)
- [ ] Add income entry
- [ ] Add multiple income entries (verify sum is correct)
- [ ] Delete income entry (verify sum updates)
- [ ] Add deduction (verify net payout updates)
- [ ] View activity log (all actions should appear)
- [ ] Mark as paid (verify confirmation dialog)
- [ ] Try to edit paid period (should be blocked)
- [ ] Verify activity shows actor names correctly
- [ ] Check summary cards update correctly

## Build Status

✅ TypeScript compilation successful
✅ All types properly defined
✅ No build errors
✅ Bundle size acceptable (5.11 kB for earnings edit page)

## Migration Notes

- **Data Safety**: Existing gross_earnings values migrated to income_entries
- **Backward Compatible**: All existing queries continue to work
- **Triggers**: Automatic recalculation ensures data consistency
- **RLS Policies**: Added for income_entries and earnings_activity tables
