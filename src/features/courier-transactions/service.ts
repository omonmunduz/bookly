/**
 * COURIER BALANCE TRANSACTIONS SERVICE
 *
 * Business logic layer for the courier balance ledger system.
 * Wraps the repository with validation and business rules.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CourierTransactionsRepository } from './repository';
import { AuditService } from '@/features/audit/service';
import type {
  CourierBalanceTransaction,
  CreateTransactionInput,
  TransactionFilters,
  TransactionWithCourier,
  CourierBalance,
  Result,
} from '@/lib/types/ebike';

export class CourierTransactionsService {
  private repository: CourierTransactionsRepository;
  private auditService: AuditService;

  constructor(supabase: SupabaseClient, organizationId: string) {
    this.repository = new CourierTransactionsRepository(supabase, organizationId);
    this.auditService = new AuditService(supabase, organizationId);
  }

  /**
   * List transactions with optional filters.
   */
  async list(filters?: TransactionFilters): Promise<Result<CourierBalanceTransaction[]>> {
    return this.repository.list(filters);
  }

  /**
   * List transactions with courier information.
   */
  async listWithCourier(filters?: TransactionFilters): Promise<Result<TransactionWithCourier[]>> {
    return this.repository.listWithCourier(filters);
  }

  /**
   * Get a single transaction by ID.
   */
  async getById(id: string): Promise<Result<CourierBalanceTransaction>> {
    return this.repository.getById(id);
  }

  /**
   * Create a new manual transaction.
   */
  async create(
    input: CreateTransactionInput,
    createdBy: string
  ): Promise<Result<{ id: string }>> {
    // Validate amount
    if (input.amount <= 0) {
      return { success: false, error: 'Сумма должна быть положительной' };
    }

    // Validate manual transactions have notes
    if (input.type.endsWith('_manual')) {
      if (!input.note || input.note.trim() === '') {
        return {
          success: false,
          error: 'Примечание обязательно для ручных транзакций',
        };
      }
    }

    // Validate rent_auto cannot be created manually
    if (input.type === 'rent_auto') {
      return {
        success: false,
        error: 'Транзакции аренды создаются автоматически при назначении велосипеда',
      };
    }

    // Validate period dates
    if (input.period_start && input.period_end) {
      const start = new Date(input.period_start);
      const end = new Date(input.period_end);
      if (end < start) {
        return {
          success: false,
          error: 'Дата окончания периода должна быть после даты начала',
        };
      }
    }

    // Create the transaction
    const result = await this.repository.create(input, createdBy);

    // If successful, get courier info and log audit event
    if (result.success) {
      try {
        // Fetch courier info for audit log
        const courierResult = await this.repository.getCourierInfo(input.courier_id);

        if (courierResult.success) {
          const courier = courierResult.data;

          // Log audit event
          await this.auditService.logTransactionCreated(createdBy, result.data.id, {
            courier_name: courier.full_name,
            courier_code: courier.courier_code,
            type: input.type,
            direction: input.direction,
            amount: input.amount,
            note: input.note || undefined,
            period_start: input.period_start || undefined,
            period_end: input.period_end || undefined,
          });
        }
      } catch (error) {
        // Audit logging failure should not break the transaction creation
        console.error('Failed to log transaction audit event:', error);
      }
    }

    return result;
  }

  /**
   * Delete a transaction (soft delete for audit trail).
   */
  async delete(id: string, deletedBy: string): Promise<Result<{ id: string }>> {
    // Get transaction info before deletion for audit log
    const transactionResult = await this.repository.getById(id);

    if (!transactionResult.success) {
      return transactionResult;
    }

    const transaction = transactionResult.data;

    // Soft delete the transaction
    const result = await this.repository.softDelete(id);

    // If successful, log audit event
    if (result.success) {
      try {
        // Fetch courier info for audit log
        const courierResult = await this.repository.getCourierInfo(transaction.courier_id);

        if (courierResult.success) {
          const courier = courierResult.data;

          // Log audit event
          await this.auditService.logTransactionDeleted(deletedBy, id, {
            courier_name: courier.full_name,
            type: transaction.type,
            direction: transaction.direction,
            amount: transaction.amount,
            reason: 'Ручное удаление',
          });
        }
      } catch (error) {
        // Audit logging failure should not break the deletion
        console.error('Failed to log transaction deletion audit event:', error);
      }
    }

    return result;
  }

  /**
   * Get balance for a specific courier.
   */
  async getCourierBalance(courierId: string): Promise<Result<CourierBalance>> {
    return this.repository.getCourierBalance(courierId);
  }

  /**
   * Get balances for all couriers.
   */
  async getAllBalances(): Promise<Result<CourierBalance[]>> {
    return this.repository.getAllBalances();
  }

  /**
   * Get transaction statistics for a courier.
   */
  async getCourierStats(
    courierId: string
  ): Promise<
    Result<{
      totalDebits: number;
      totalCredits: number;
      balance: number;
      transactionCount: number;
    }>
  > {
    return this.repository.getCourierStats(courierId);
  }
}
