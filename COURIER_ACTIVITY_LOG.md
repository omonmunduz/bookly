# Courier Activity Log Integration

## Overview
Added an audit activity log section directly to the courier detail page, showing all transaction-related operations for that specific courier.

## What Was Added

### 1. Courier Activity Log Component
**File:** `src/components/couriers/courier-activity-log.tsx`

**Features:**
- Displays last 20 audit log entries for the courier's transactions
- Shows both transaction creation and deletion events
- Formatted display with badges, timestamps, and detailed metadata
- Only visible to managers and admins
- Automatically hidden if no activity logs exist

**Information Displayed:**
- **Action Badge**: "Создано" (Created) or "Удалено" (Deleted)
- **Timestamp**: When the action occurred
- **Actor**: Who performed the action (name and role)
- **Transaction Details**:
  - Amount with direction (+ for credit, - for debit)
  - Transaction type
  - Note/description
  - Period dates (if applicable)

### 2. Integrated into Courier Detail Page
**File:** `src/app/(dashboard)/couriers/[id]/page.tsx`

**Location**: Added below the transaction history section

**Access Control**: Only visible to managers and admins (same as transaction section)

## User Experience

### On Courier Detail Page:

1. **Balance Card** (right sidebar)
   - Shows current balance
   - Quick stats

2. **Transaction History** (main content)
   - List of all transactions
   - Add transaction button

3. **Activity Log** (main content, below transactions) ← **NEW**
   - Shows who created/deleted transactions
   - Includes full audit trail
   - Last 20 operations

## Example Activity Log Entry

```
[Создано] 10.09.2024 15:30

John Manager (manager)

+ 5000 сом · prepayment manual
"Оплата аренды за неделю"
Период: 2024-09-01 — 2024-09-07
```

## Benefits

1. **Transparency**: See who made changes to courier finances
2. **Accountability**: Track all transaction operations in one place
3. **Context**: View activity alongside transaction list
4. **Convenience**: No need to navigate to separate audit logs page
5. **Debugging**: Quickly identify when transactions were created/deleted

## Technical Details

**Query Logic:**
- Fetches from `audit_logs` table
- Filters by `entity_type = 'transaction'`
- Matches courier by name in metadata (since audit logs don't have direct courier_id)
- Orders by `created_at DESC`
- Limits to 20 most recent entries

**Performance:**
- Uses Suspense for async loading
- Shows skeleton while loading
- Returns null (no render) if no logs exist
- Errors are logged but don't break the page

**Styling:**
- Consistent with other cards on the page
- Color-coded badges (green for created, red for deleted)
- Expandable details for long notes
- Responsive layout

## Future Enhancements

Potential improvements:
- Add filtering by date range
- Add filtering by action type (created/deleted)
- Add pagination for couriers with many transactions
- Link to full transaction details
- Export activity log to CSV
- Real-time updates when new activities occur

---

*Implemented: 2025-01-XX*
