-- Add paid status to courier_balance_transactions
-- This tracks whether manual debit transactions (fines, payouts) have been paid

ALTER TABLE courier_balance_transactions
ADD COLUMN paid_status TEXT DEFAULT 'unpaid' CHECK (paid_status IN ('paid', 'unpaid'));

-- Set existing auto transactions as paid (they are system-generated rent charges)
UPDATE courier_balance_transactions
SET paid_status = 'paid'
WHERE type LIKE '%_auto';

-- Add index for filtering by paid status
CREATE INDEX idx_courier_balance_transactions_paid_status
ON courier_balance_transactions(organization_id, paid_status, created_at DESC)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN courier_balance_transactions.paid_status IS
'Tracks payment status of manual debit transactions. Auto transactions are always marked as paid.';
