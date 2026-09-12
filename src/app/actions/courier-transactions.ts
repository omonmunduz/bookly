/**
 * COURIER TRANSACTIONS SERVER ACTIONS
 *
 * The read/write surface for courier balance transactions. Client components
 * call these; they never import the repository or hold a Supabase client.
 *
 * All actions require manager-or-above role since these are financial records.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { CourierTransactionsService } from '@/features/courier-transactions/service';
import type {
  CourierBalanceTransaction,
  CreateTransactionInput,
  TransactionFilters,
  TransactionWithCourier,
  CourierBalance,
  Result,
  PaidStatus,
} from '@/lib/types/ebike';

/**
 * Build a service bound to the caller's organization, after checking they are
 * a manager or admin.
 */
async function getService() {
  const user = await requireMinimumRole('manager');
  const supabase = await createClient();

  return {
    user,
    service: new CourierTransactionsService(supabase, user.organizationId),
  };
}

/** Message for an unexpected throw, so callers always get a readable string. */
function failure(error: unknown, fallback: string): Result<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * List transactions with optional filters, newest first.
 */
export async function listTransactionsAction(
  filters?: TransactionFilters
): Promise<Result<CourierBalanceTransaction[]>> {
  try {
    const { service } = await getService();
    return await service.list(filters);
  } catch (error) {
    return failure(error, 'Failed to list transactions');
  }
}

/**
 * List transactions with courier information joined.
 */
export async function listTransactionsWithCourierAction(
  filters?: TransactionFilters
): Promise<Result<TransactionWithCourier[]>> {
  try {
    const { service } = await getService();
    return await service.listWithCourier(filters);
  } catch (error) {
    return failure(error, 'Failed to list transactions');
  }
}

/**
 * Get a single transaction by ID.
 */
export async function getTransactionAction(
  id: string
): Promise<Result<CourierBalanceTransaction>> {
  try {
    const { service } = await getService();
    return await service.getById(id);
  } catch (error) {
    return failure(error, 'Failed to get transaction');
  }
}

/**
 * Create a new manual transaction.
 */
export async function createTransactionAction(
  input: CreateTransactionInput
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.create(input, user.id);

    if (!result.success) {
      return result;
    }

    // Revalidate relevant pages
    revalidatePath('/payouts');
    revalidatePath(`/couriers/${input.courier_id}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to create transaction');
  }
}

/**
 * Delete a transaction (soft delete for audit trail).
 */
export async function deleteTransactionAction(
  id: string
): Promise<Result<{ id: string }>> {
  try {
    const { user, service } = await getService();
    const result = await service.delete(id, user.id);

    if (!result.success) {
      return result;
    }

    // Revalidate relevant pages
    revalidatePath('/payouts');
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    return failure(error, 'Failed to delete transaction');
  }
}

/**
 * Toggle paid status of a transaction
 */
export async function toggleTransactionPaidStatusAction(
  transactionId: string,
  currentStatus: PaidStatus
): Promise<Result<{ id: string; paid_status: PaidStatus }>> {
  try {
    const { service } = await getService();

    const newStatus: PaidStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    const result = await service.updatePaidStatus(transactionId, newStatus);

    if (!result.success) {
      return result;
    }

    revalidatePath('/couriers');
    revalidatePath('/payouts');

    return result;
  } catch (error) {
    return failure(error, 'Не удалось обновить статус оплаты');
  }
}

/**
 * Pay out a courier's positive balance (resets balance to 0)
 */
export async function payoutCourierBalanceAction(
  courierId: string
): Promise<Result<{ id: string; amount: number }>> {
  try {
    const { user, service } = await getService();

    // Get current balance
    const balanceResult = await service.getCourierBalance(courierId);
    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error };
    }

    const balance = balanceResult.data.balance;

    // Only pay out if balance is positive
    if (balance <= 0) {
      return {
        success: false,
        error: 'Баланс курьера не положительный. Нечего выплачивать.',
      };
    }

    // Create a payout transaction (debit that zeros the balance)
    const result = await service.create(
      {
        courier_id: courierId,
        type: 'prepayment_payout_manual',
        direction: 'debit',
        amount: balance,
        note: `Выплата баланса: ${balance} тг`,
      },
      user.id
    );

    if (!result.success) {
      return result;
    }

    // Revalidate relevant pages
    revalidatePath('/payouts');
    revalidatePath(`/couriers/${courierId}`);
    revalidatePath('/dashboard');

    return { success: true, data: { id: result.data.id, amount: balance } };
  } catch (error) {
    return failure(error, 'Не удалось выполнить выплату');
  }
}

// ============================================================================
// BALANCES
// ============================================================================

/**
 * Get balance for a specific courier.
 */
export async function getCourierBalanceAction(
  courierId: string
): Promise<Result<CourierBalance>> {
  try {
    const { service } = await getService();
    return await service.getCourierBalance(courierId);
  } catch (error) {
    return failure(error, 'Failed to get courier balance');
  }
}

/**
 * Get balances for all couriers, sorted by balance (most in debt first).
 */
export async function getAllBalancesAction(): Promise<Result<CourierBalance[]>> {
  try {
    const { service } = await getService();
    return await service.getAllBalances();
  } catch (error) {
    return failure(error, 'Failed to get balances');
  }
}

/**
 * Get transaction statistics for a courier.
 */
export async function getCourierStatsAction(
  courierId: string
): Promise<
  Result<{
    totalDebits: number;
    totalCredits: number;
    balance: number;
    transactionCount: number;
  }>
> {
  try {
    const { service } = await getService();
    return await service.getCourierStats(courierId);
  } catch (error) {
    return failure(error, 'Failed to get courier stats');
  }
}
