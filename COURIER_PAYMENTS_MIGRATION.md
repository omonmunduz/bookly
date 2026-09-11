# Courier Payments System Migration

## Overview

Successfully migrated from a period-based earnings system to a running balance ledger for courier payments.

## What Changed

### Old System (Removed)
- **Period-based approach**: Create pay period → Add income/deductions → Mark as paid
- **Tables**: `earnings_periods`, `income_entries`, `earnings_deductions`
- **UI**: `/earnings` routes and components

### New System (Implemented)
- **Ledger-based approach**: Immutable transaction log with running balances
- **Table**: `courier_balance_transactions` with computed `courier_balances` view
- **UI**: `/payouts` section with transaction management

## Database Changes

### New Tables & Views
- `courier_balance_transactions` - Immutable transaction log
- `courier_balances` (view) - Computed running balances per courier
- Automatic rent transaction creation via trigger on bike assignments

### Transaction Types
**Debits (reduce balance):**
- `rent_auto` - Automatic rent charges (created by trigger)
- `fine_repair_part_manual` - Manual fines/repair costs
- `prepayment_payout_manual` - Prepayments/payouts to courier
- `other_debit_manual` - Other manual debits

**Credits (increase balance):**
- `prepayment_manual` - Manual prepayments from courier
- `fine_repair_part_payment_manual` - Fine/repair payments
- `other_credit_manual` - Other manual credits

### Data Migration
All existing data was migrated:
- Income entries → `prepayment_manual` credit transactions
- Deductions → Appropriate debit transaction types
- Original IDs and timestamps preserved
- Old tables marked as `[ARCHIVED]` but not deleted

## Implementation

### Backend (`src/`)
- `features/courier-transactions/repository.ts` - Data access layer
- `features/courier-transactions/service.ts` - Business logic
- `features/courier-transactions/labels.ts` - Russian localization
- `app/actions/courier-transactions.ts` - Server actions
- `lib/types/ebike.ts` - TypeScript types (old types marked @deprecated)

### Frontend (`src/`)
- `app/(dashboard)/payouts/page.tsx` - Main payouts dashboard
- `app/(dashboard)/payouts/new/page.tsx` - Manual transaction entry
- `components/payouts/transaction-list.tsx` - Transaction table
- `components/payouts/add-transaction-form.tsx` - Transaction form
- `components/couriers/courier-balance-card.tsx` - Balance widget for courier detail page

### UI Features
- Summary cards: total balance, total debits, total credits
- Top courier balances with links to detail pages
- Recent transactions list
- Manual transaction entry form with validation
- Balance card on courier detail page (managers/admins only)
- Transaction filtering by type, direction, and period

## Cleanup Completed

### Removed Files (18 total)
- All `/earnings` route pages (4 files)
- All earnings components (10 files)
- Earnings feature layer (4 files)
- Earnings server actions (1 file)

### Updated Files
- Navigation link changed from `/earnings` to `/payouts`
- Dashboard metric card updated to link to `/payouts`
- Old type definitions marked as `@deprecated`

## Key Features

### Automatic Rent Charges
When a manager assigns a bike to a courier, a `rent_auto` debit transaction is automatically created using the rental plan's price.

### Immutable Audit Trail
- All transactions are immutable (soft deletes only via `deleted_at`)
- Full history preserved for compliance
- Automatic `created_by` tracking

### Running Balance
Balance = SUM(all credits) - SUM(all debits) per courier, computed via database view for accuracy.

### Manual Transaction Entry
- Managers can add credits or debits manually
- Required notes for audit trail
- Optional period dates for reporting
- Client and server-side validation

## Database Tables Status

### Active Tables
- `courier_balance_transactions` - New transaction ledger
- `courier_balances` - Computed view

### Archived Tables (Preserved)
- `earnings_periods` - Old pay periods
- `income_entries` - Old income entries
- `earnings_deductions` - Old deductions

**Note**: Archived tables remain in database with all historical data intact.

## Next Steps (Optional)

1. Monitor production usage to ensure migration accuracy
2. Run verification query to compare old vs new balances:
   ```sql
   SELECT * FROM migration_verification WHERE balance_difference != 0;
   ```
3. Consider adding more reporting features (export, charts, etc.)
4. Add push notifications for low/negative balances
5. Eventually drop archived tables after sufficient production validation

## Migration Date
Completed: January 2026
