-- ============================================================================
-- MIGRATE EXISTING EARNINGS DATA TO COURIER BALANCE TRANSACTIONS
-- ============================================================================
-- Converts the old earnings_periods + income_entries + deductions model into
-- the new courier_balance_transactions ledger.
--
-- Strategy:
--   1. Map income_entries → credit transactions (prepayment_manual)
--   2. Map deductions → debit transactions (by type)
--   3. Preserve original timestamps and actor IDs
--   4. Mark old tables as archived
--
-- Rollback: Keep old tables intact for audit trail
-- ============================================================================

-- ============================================================================
-- MIGRATE INCOME ENTRIES → CREDIT TRANSACTIONS
-- ============================================================================

INSERT INTO courier_balance_transactions (
    id,
    organization_id,
    courier_id,
    type,
    direction,
    amount,
    note,
    period_start,
    period_end,
    metadata,
    created_by,
    created_at
)
SELECT
    ie.id,                          -- Preserve original ID for traceability
    ie.organization_id,
    ep.courier_id,
    'prepayment_manual'::transaction_type,
    'credit'::transaction_direction,
    ie.amount,
    COALESCE(
        ie.notes,
        'Миграция: Доход за период ' || TO_CHAR(ep.period_start, 'DD.MM.YYYY') ||
        ' - ' || TO_CHAR(ep.period_end, 'DD.MM.YYYY')
    ),
    ep.period_start,
    ep.period_end,
    jsonb_build_object(
        'migrated_from', 'income_entries',
        'original_income_entry_id', ie.id,
        'earnings_period_id', ep.id,
        'migration_date', NOW()
    ),
    ie.created_by,
    ie.created_at
FROM income_entries ie
JOIN earnings_periods ep ON ep.id = ie.earnings_period_id
WHERE ie.id NOT IN (
    SELECT id FROM courier_balance_transactions WHERE id = ie.id
);

-- ============================================================================
-- MIGRATE DEDUCTIONS → DEBIT TRANSACTIONS
-- ============================================================================

INSERT INTO courier_balance_transactions (
    id,
    organization_id,
    courier_id,
    type,
    direction,
    amount,
    note,
    period_start,
    period_end,
    metadata,
    created_by,
    created_at
)
SELECT
    d.id,                           -- Preserve original ID for traceability
    d.organization_id,
    ep.courier_id,
    -- Map old deduction types to new transaction types
    CASE d.deduction_type
        WHEN 'rental' THEN 'rent_auto'::transaction_type
        WHEN 'damage' THEN 'fine_repair_part_manual'::transaction_type
        WHEN 'equipment' THEN 'other_debit_manual'::transaction_type
        WHEN 'other' THEN 'other_debit_manual'::transaction_type
        ELSE 'other_debit_manual'::transaction_type
    END,
    'debit'::transaction_direction,
    d.amount,
    COALESCE(
        d.description,
        'Миграция: ' ||
        CASE d.deduction_type
            WHEN 'rental' THEN 'Аренда'
            WHEN 'damage' THEN 'Ущерб/ремонт'
            WHEN 'equipment' THEN 'Оборудование'
            WHEN 'other' THEN 'Прочее'
        END ||
        ' за период ' || TO_CHAR(ep.period_start, 'DD.MM.YYYY') ||
        ' - ' || TO_CHAR(ep.period_end, 'DD.MM.YYYY')
    ),
    ep.period_start,
    ep.period_end,
    jsonb_build_object(
        'migrated_from', 'deductions',
        'original_deduction_id', d.id,
        'original_deduction_type', d.deduction_type,
        'earnings_period_id', ep.id,
        'reference_id', d.reference_id,
        'migration_date', NOW()
    ),
    d.created_by,
    d.created_at
FROM deductions d
JOIN earnings_periods ep ON ep.id = d.earnings_period_id
WHERE d.id NOT IN (
    SELECT id FROM courier_balance_transactions WHERE id = d.id
);

-- ============================================================================
-- VERIFICATION QUERIES (for manual review)
-- ============================================================================

-- Count of migrated records
DO $$
DECLARE
    v_income_count INTEGER;
    v_deduction_count INTEGER;
    v_transaction_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_income_count FROM income_entries;
    SELECT COUNT(*) INTO v_deduction_count FROM deductions;
    SELECT COUNT(*) INTO v_transaction_count FROM courier_balance_transactions
        WHERE metadata->>'migrated_from' IS NOT NULL;

    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  Income entries: %', v_income_count;
    RAISE NOTICE '  Deductions: %', v_deduction_count;
    RAISE NOTICE '  Total migrated transactions: %', v_transaction_count;
    RAISE NOTICE '  Expected total: %', v_income_count + v_deduction_count;

    IF v_transaction_count != (v_income_count + v_deduction_count) THEN
        RAISE WARNING 'Migration count mismatch! Review manually.';
    ELSE
        RAISE NOTICE '✓ Migration count matches.';
    END IF;
END $$;

-- ============================================================================
-- MARK OLD TABLES AS ARCHIVED
-- ============================================================================
-- Add a comment to indicate these tables are deprecated but kept for audit

COMMENT ON TABLE earnings_periods IS
  '[ARCHIVED] This table is deprecated as of 2026-09-03. New system uses
   courier_balance_transactions for running balance ledger. This table is kept
   for historical audit only. Migrated data is in courier_balance_transactions
   with metadata.migrated_from = ''income_entries'' or ''deductions''.';

COMMENT ON TABLE income_entries IS
  '[ARCHIVED] This table is deprecated as of 2026-09-03. Migrated to
   courier_balance_transactions with type = ''prepayment_manual''.
   Kept for historical audit only.';

COMMENT ON TABLE deductions IS
  '[ARCHIVED] This table is deprecated as of 2026-09-03. Migrated to
   courier_balance_transactions with appropriate debit types.
   Kept for historical audit only.';

COMMENT ON TABLE earnings_activity IS
  '[ARCHIVED] This table is deprecated as of 2026-09-03. Audit trail for
   old earnings_periods system. Kept for historical reference only.';

-- ============================================================================
-- VERIFICATION VIEW: Compare old vs new balances
-- ============================================================================

CREATE OR REPLACE VIEW migration_verification AS
SELECT
    ep.courier_id,
    c.courier_code,
    c.full_name,
    -- Old system: sum from earnings_periods
    SUM(ep.net_payout) AS old_system_net_total,
    -- New system: balance from transactions
    COALESCE(cb.balance, 0) AS new_system_balance,
    -- Difference (should be close to zero after full migration)
    COALESCE(cb.balance, 0) - SUM(ep.net_payout) AS difference
FROM earnings_periods ep
JOIN couriers c ON c.id = ep.courier_id
LEFT JOIN courier_balances cb ON cb.courier_id = ep.courier_id
WHERE ep.deleted_at IS NULL
GROUP BY ep.courier_id, c.courier_code, c.full_name, cb.balance;

COMMENT ON VIEW migration_verification IS
  'Verification view to compare old earnings_periods totals with new
   courier_balance_transactions balances. Difference should be near zero.
   Note: old system tracks net_payout per period, new system tracks running
   balance, so exact match depends on migration logic.';
