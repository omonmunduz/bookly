# Audit Logging for Courier Transactions

## Overview
Added comprehensive audit logging for all courier transaction operations, tracking who performed what action, when, and with what details.

## Changes Made

### 1. Extended Audit Service
**File:** `src/features/audit/service.ts`

**New Action Constants:**
- `TRANSACTION_CREATED` - When a manual transaction is created
- `TRANSACTION_DELETED` - When a transaction is soft-deleted

**New Entity Type:**
- `TRANSACTION` - Represents courier balance transactions

**New Convenience Methods:**
- `logTransactionCreated()` - Logs transaction creation with full details
- `logTransactionDeleted()` - Logs transaction deletion with reason

### 2. Enhanced Courier Transactions Service
**File:** `src/features/courier-transactions/service.ts`

**Changes:**
- Imported and initialized `AuditService` in the constructor
- Enhanced `create()` method to log audit events after successful transaction creation
- Enhanced `delete()` method to log audit events after successful transaction deletion
- Both methods fetch courier information for meaningful audit log entries

**Audit Data Captured on Creation:**
- Courier name and code
- Transaction type (rent_auto, prepayment_manual, etc.)
- Transaction direction (credit/debit)
- Amount
- Note (description)
- Period dates (if provided)

**Audit Data Captured on Deletion:**
- Courier name
- Transaction type
- Transaction direction
- Amount
- Reason (currently "Ручное удаление")

### 3. Enhanced Repository
**File:** `src/features/courier-transactions/repository.ts`

**New Method:**
- `getCourierInfo(courierId)` - Fetches basic courier information (name and code) for audit logging purposes

### 4. Updated Server Actions
**File:** `src/app/actions/courier-transactions.ts`

**Changes:**
- `deleteTransactionAction()` now passes `user.id` as `deletedBy` parameter to the service layer

## Audit Log Structure

Each audit log entry contains:

```typescript
{
  id: UUID,
  organization_id: UUID,
  actor_user_id: UUID,           // Who performed the action
  actor_name_snapshot: string,    // User's name at time of action
  actor_role_snapshot: string,    // User's role at time of action
  action: string,                 // 'TRANSACTION_CREATED' or 'TRANSACTION_DELETED'
  entity_type: string,            // 'transaction'
  entity_id: UUID,                // Transaction ID
  entity_name_snapshot: string,   // "Courier Name - +/-Amount"
  metadata: JSONB,                // Detailed transaction info
  created_at: timestamp
}
```

### Example Metadata for Transaction Creation:
```json
{
  "courier_name": "Bakyt Aliyev",
  "courier_code": "CUR-001",
  "type": "prepayment_manual",
  "direction": "credit",
  "amount": 5000,
  "note": "Оплата аренды за неделю",
  "period_start": "2024-09-01",
  "period_end": "2024-09-07"
}
```

### Example Metadata for Transaction Deletion:
```json
{
  "courier_name": "Bakyt Aliyev",
  "type": "prepayment_manual",
  "direction": "credit",
  "amount": 5000,
  "reason": "Ручное удаление"
}
```

## Benefits

1. **Full Accountability**: Every transaction creation and deletion is tracked with who did it
2. **Historical Context**: Snapshots preserve user names and roles at the time of action
3. **Audit Trail**: Immutable record of all financial operations
4. **Debugging**: Easy to trace when and why transactions were created or deleted
5. **Compliance**: Meets audit requirements for financial operations

## Querying Audit Logs

### View all transaction operations:
```sql
SELECT 
  actor_name_snapshot,
  action,
  entity_name_snapshot,
  metadata,
  created_at
FROM audit_logs
WHERE entity_type = 'transaction'
ORDER BY created_at DESC;
```

### View operations by specific user:
```sql
SELECT 
  action,
  entity_name_snapshot,
  created_at
FROM audit_logs
WHERE actor_user_id = '<user_id>'
  AND entity_type = 'transaction'
ORDER BY created_at DESC;
```

### View operations for specific courier:
```sql
SELECT 
  action,
  actor_name_snapshot,
  metadata->>'amount' as amount,
  metadata->>'note' as note,
  created_at
FROM audit_logs
WHERE entity_type = 'transaction'
  AND metadata->>'courier_name' = 'Bakyt Aliyev'
ORDER BY created_at DESC;
```

### View all deletions:
```sql
SELECT 
  actor_name_snapshot,
  entity_name_snapshot,
  metadata->>'reason' as reason,
  created_at
FROM audit_logs
WHERE action = 'TRANSACTION_DELETED'
ORDER BY created_at DESC;
```

## Error Handling

Audit logging failures are handled gracefully:
- Errors are logged to console but don't break the transaction operation
- If courier info cannot be fetched, the audit log is skipped
- The transaction itself always completes successfully even if audit logging fails

This ensures that audit failures never prevent business operations from completing.

## Future Enhancements

Potential additions:
- Track transaction updates/edits (if update functionality is added)
- Add "corrected by" field when offsetting transactions are created
- Dashboard widget showing recent transaction activity
- Export audit logs to CSV for external analysis
- Email notifications for high-value transactions

---

*Implemented: 2025-01-XX*
