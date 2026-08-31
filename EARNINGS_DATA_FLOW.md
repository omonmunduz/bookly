# Earnings System - Data Flow Diagram

## Before (Single Gross Earnings)

```
┌─────────────────────────┐
│   earnings_periods      │
├─────────────────────────┤
│ id                      │
│ courier_id              │
│ period_start/end        │
│ gross_earnings  ←────── SINGLE EDITABLE FIELD
│ total_deductions        │
│ net_payout              │
│ status                  │
│ paid_at                 │
└─────────────────────────┘
         │
         │ has many
         ▼
┌─────────────────────────┐
│     deductions          │
├─────────────────────────┤
│ id                      │
│ earnings_period_id      │
│ amount                  │
│ description             │
└─────────────────────────┘
```

## After (Additive Income Entries + Audit Trail)

```
┌─────────────────────────────────────────────────────────────┐
│                    earnings_periods                          │
├─────────────────────────────────────────────────────────────┤
│ id                                                           │
│ courier_id                                                   │
│ period_start/end                                             │
│ gross_earnings  ←────── COMPUTED: SUM(income_entries.amount)│
│ total_deductions ←───── COMPUTED: SUM(deductions.amount)    │
│ net_payout       ←───── COMPUTED: gross - deductions        │
│ status (draft → approved → paid)                            │
│ paid_at (set when marked as paid)                           │
└─────────────────────────────────────────────────────────────┘
         │
         │ has many
         ├─────────────────────────┬─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ income_entries   │   │   deductions     │   │ earnings_activity    │
├──────────────────┤   ├──────────────────┤   ├──────────────────────┤
│ id               │   │ id               │   │ id                   │
│ period_id        │   │ period_id        │   │ period_id            │
│ amount           │   │ amount           │   │ activity_type        │
│ notes            │   │ type             │   │ actor_id             │
│ created_by       │   │ description      │   │ details (JSONB)      │
│ created_at       │   │ created_by       │   │ created_at           │
└──────────────────┘   └──────────────────┘   └──────────────────────┘
         │                      │                       │
         │                      │                       │
         └──────────────────────┴───────────────────────┘
                                │
                    ALL ACTIONS LOGGED WITH:
                    - Who did it (actor_id)
                    - What they did (activity_type)
                    - Details (amount, notes, etc)
                    - When (created_at)
```

## Trigger Flow

```
USER ACTION                    TRIGGER                         RESULT
─────────────────────────────────────────────────────────────────────────

Add Income Entry
  │
  ├─► INSERT income_entry  ─► fn_recalc_gross_earnings()  ─► Updates earnings_periods.gross_earnings
  │                        ─► fn_log_income_entry_activity() ─► Creates earnings_activity record
  │
  └─► Summary recalculates: net_payout = gross_earnings - total_deductions


Delete Income Entry
  │
  ├─► DELETE income_entry  ─► fn_recalc_gross_earnings()  ─► Updates earnings_periods.gross_earnings
  │                        ─► fn_log_income_entry_activity() ─► Creates earnings_activity record
  │
  └─► Summary recalculates: net_payout = gross_earnings - total_deductions


Add Deduction
  │
  ├─► INSERT deduction     ─► fn_recalc_earnings_totals()  ─► Updates total_deductions & net_payout
  │                        ─► fn_log_deduction_activity()   ─► Creates earnings_activity record
  │
  └─► Summary recalculates automatically


Mark as Paid
  │
  ├─► UPDATE period        ─► fn_log_earnings_period_activity() ─► Creates activity record
  │   status = 'paid'                                              with type='marked_as_paid'
  │   paid_at = NOW()
  │
  └─► Period locked (no further edits allowed)
```

## UI Component Hierarchy

```
earnings/[id]/edit
│
└─► EditEarningsForm
    │
    ├─► Period Information Card
    │   └─► Static info (courier, dates, status)
    │
    ├─► Income Entries Card
    │   ├─► AddIncomeButton (opens dialog)
    │   └─► Table
    │       └─► DeleteIncomeButton (per row, draft only)
    │
    ├─► Notes Card
    │   └─► Textarea (editable)
    │
    ├─► Deductions Card
    │   ├─► AddDeductionButton
    │   └─► Table
    │       └─► DeleteDeductionButton (per row, draft only)
    │
    ├─► Summary Card
    │   ├─► Total Income: SUM(income_entries)
    │   ├─► Total Deductions: SUM(deductions)
    │   └─► Net Payout: income - deductions
    │
    ├─► Activity Log Card
    │   └─► List of all actions (newest first)
    │       └─► Shows: badge, date, details, actor
    │
    └─► Actions
        ├─► Cancel Button
        ├─► Save Changes Button
        └─► MarkAsPaidButton (opens confirmation dialog)
```

## State Machine: Earnings Period Status

```
┌───────────┐
│   draft   │ ←── Created with 0 income
└─────┬─────┘
      │ Can: add income, add deductions, edit notes
      │ Action: manager approves
      ▼
┌───────────┐
│ approved  │
└─────┬─────┘
      │ Can: still edit (but shouldn't after approval)
      │ Action: mark as paid
      ▼
┌───────────┐
│   paid    │
└───────────┘
      │ Can: NOTHING (locked, read-only)
      │ paid_at timestamp set
      │ Shows in "Paid" column
      └─► Immutable
```

## Activity Types & Details

```
Activity Type       Details JSONB Structure                    Display
─────────────────────────────────────────────────────────────────────────
period_created      {courier_id, period_start, period_end}     "Created earnings period"

income_added        {amount: 400, notes: "Week 1"}             "Added $400 — Week 1"

income_deleted      {amount: 400, notes: "Week 1"}             "Deleted $400 — Week 1"

deduction_added     {type: "rental",                           "Added rental deduction:
                     amount: 150,                               $150 — Weekly bike rental"
                     description: "Weekly bike rental"}

deduction_deleted   {type: "rental", amount: 150, ...}         "Deleted rental deduction: $150 — ..."

status_changed      {from: "draft", to: "approved"}            "Changed from draft to approved"

marked_as_paid      {from: "approved",                         "Paid $1,250.50"
                     to: "paid",
                     amount: 1250.50}

period_updated      {field: "notes"}                           "Updated notes"
```

## Summary: What Changed

### Data Model
❌ Before: Single `gross_earnings` field (editable)
✅ After: Multiple `income_entries` (additive, sum auto-calculated)

### Audit Trail
❌ Before: No history of changes
✅ After: Complete log in `earnings_activity` table

### Payment Tracking
❌ Before: `paid_at` field existed but no UI to set it
✅ After: "Mark as Paid" button with confirmation

### User Experience
❌ Before: Overwrite gross earnings when updating
✅ After: Add income incrementally, see all entries

### Transparency
❌ Before: No visibility into who changed what
✅ After: Every action logged with actor and timestamp
