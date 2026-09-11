/**
 * COURIER TRANSACTION LABELS
 *
 * Russian labels and UI helpers for the courier balance ledger system.
 */

import type { TransactionType, TransactionDirection } from '@/lib/types/ebike';

// ============================================================================
// TRANSACTION TYPE LABELS
// ============================================================================

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  // Debit types
  rent_auto: 'Аренда (авто)',
  fine_repair_part_manual: 'Штраф/ремонт/запчасти',
  prepayment_payout_manual: 'Возврат предоплаты',
  other_debit_manual: 'Прочий расход',

  // Credit types
  prepayment_manual: 'Оплата аренды',
  fine_repair_part_payment_manual: 'Оплата штрафа/ремонта',
  other_credit_manual: 'Прочий приход',
};

export const TRANSACTION_TYPE_DESCRIPTIONS: Record<TransactionType, string> = {
  // Debit types
  rent_auto: 'Автоматический платеж за аренду при назначении велосипеда',
  fine_repair_part_manual: 'Ручной ввод штрафа, оплаты ремонта или запчастей',
  prepayment_payout_manual: 'Возврат курьеру при выполнении промо-условий',
  other_debit_manual: 'Прочие списания с баланса курьера',

  // Credit types
  prepayment_manual: 'Подтверждение оплаты аренды курьером',
  fine_repair_part_payment_manual: 'Подтверждение оплаты штрафа или ремонта',
  other_credit_manual: 'Прочие пополнения баланса курьера',
};

// ============================================================================
// DIRECTION LABELS
// ============================================================================

export const DIRECTION_LABELS: Record<TransactionDirection, string> = {
  debit: 'Списание',
  credit: 'Пополнение',
};

export const DIRECTION_COLORS: Record<TransactionDirection, string> = {
  debit: 'text-destructive',
  credit: 'text-green-600',
};

// ============================================================================
// TRANSACTION TYPE GROUPING
// ============================================================================

export const DEBIT_TYPES: TransactionType[] = [
  'rent_auto',
  'fine_repair_part_manual',
  'prepayment_payout_manual',
  'other_debit_manual',
];

export const CREDIT_TYPES: TransactionType[] = [
  'prepayment_manual',
  'fine_repair_part_payment_manual',
  'other_credit_manual',
];

export const MANUAL_DEBIT_TYPES: TransactionType[] = [
  'fine_repair_part_manual',
  'prepayment_payout_manual',
  'other_debit_manual',
];

export const MANUAL_CREDIT_TYPES: TransactionType[] = [
  'prepayment_manual',
  'fine_repair_part_payment_manual',
  'other_credit_manual',
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get display label for a transaction type.
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}

/**
 * Get description for a transaction type.
 */
export function getTransactionTypeDescription(type: TransactionType): string {
  return TRANSACTION_TYPE_DESCRIPTIONS[type] || '';
}

/**
 * Get display label for direction.
 */
export function getDirectionLabel(direction: TransactionDirection): string {
  return DIRECTION_LABELS[direction] || direction;
}

/**
 * Get color class for direction (for displaying amounts).
 */
export function getDirectionColor(direction: TransactionDirection): string {
  return DIRECTION_COLORS[direction] || '';
}

/**
 * Check if a transaction type is manual (requires note).
 */
export function isManualType(type: TransactionType): boolean {
  return type.endsWith('_manual');
}

/**
 * Check if a transaction type is automatic.
 */
export function isAutoType(type: TransactionType): boolean {
  return !isManualType(type);
}

/**
 * Get all manual types for a given direction.
 */
export function getManualTypesForDirection(
  direction: TransactionDirection
): TransactionType[] {
  return direction === 'debit' ? MANUAL_DEBIT_TYPES : MANUAL_CREDIT_TYPES;
}

/**
 * Format balance (positive = courier has credit, negative = courier owes).
 */
export function formatBalance(balance: number): {
  text: string;
  color: string;
} {
  if (balance > 0) {
    return {
      text: `+${balance.toFixed(2)}`,
      color: 'text-green-600',
    };
  } else if (balance < 0) {
    return {
      text: balance.toFixed(2),
      color: 'text-destructive',
    };
  } else {
    return {
      text: '0.00',
      color: 'text-muted-foreground',
    };
  }
}
