/**
 * COURIER BALANCE TRANSACTIONS REPOSITORY
 *
 * Data access layer for the new courier balance ledger system.
 * Every financial event is a transaction record (credits and debits).
 *
 * Balance = SUM(credits) - SUM(debits)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CourierBalanceTransaction,
  CreateTransactionInput,
  TransactionFilters,
  TransactionWithCourier,
  CourierBalance,
  Result,
} from '@/lib/types/ebike';

export class CourierTransactionsRepository {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {}

  /**
   * List transactions with optional filters, newest first.
   */
  async list(
    filters?: TransactionFilters
  ): Promise<Result<CourierBalanceTransaction[]>> {
    try {
      let query = this.supabase
        .from('courier_balance_transactions')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.courier_id) {
        query = query.eq('courier_id', filters.courier_id);
      }

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }

      if (filters?.period_start) {
        query = query.gte('period_start', filters.period_start);
      }

      if (filters?.period_end) {
        query = query.lte('period_end', filters.period_end);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 50) - 1
        );
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list transactions',
      };
    }
  }

  /**
   * List transactions with courier information joined.
   */
  async listWithCourier(
    filters?: TransactionFilters
  ): Promise<Result<TransactionWithCourier[]>> {
    try {
      let query = this.supabase
        .from('courier_balance_transactions')
        .select(
          `
          *,
          courier:couriers!courier_id(
            courier_code,
            full_name,
            phone
          ),
          creator:user_profiles!created_by(
            full_name,
            role
          )
        `
        )
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.courier_id) {
        query = query.eq('courier_id', filters.courier_id);
      }

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }

      if (filters?.period_start) {
        query = query.gte('period_start', filters.period_start);
      }

      if (filters?.period_end) {
        query = query.lte('period_end', filters.period_end);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 50) - 1
        );
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list transactions',
      };
    }
  }

  /**
   * Get a single transaction by ID.
   */
  async getById(id: string): Promise<Result<CourierBalanceTransaction>> {
    try {
      const { data, error } = await this.supabase
        .from('courier_balance_transactions')
        .select('*')
        .eq('id', id)
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Transaction not found' };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction',
      };
    }
  }

  /**
   * Create a new transaction (manual types only - rent_auto is created by trigger).
   */
  async create(
    input: CreateTransactionInput,
    createdBy: string
  ): Promise<Result<{ id: string }>> {
    try {
      // Validate manual types have notes
      const isManual = input.type.endsWith('_manual');
      if (isManual && (!input.note || input.note.trim() === '')) {
        return {
          success: false,
          error: 'Примечание обязательно для ручных транзакций',
        };
      }

      const { data, error } = await this.supabase
        .from('courier_balance_transactions')
        .insert({
          organization_id: this.organizationId,
          courier_id: input.courier_id,
          type: input.type,
          direction: input.direction,
          amount: input.amount,
          note: input.note || null,
          period_start: input.period_start || null,
          period_end: input.period_end || null,
          metadata: input.metadata || null,
          created_by: createdBy,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: { id: data.id } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create transaction',
      };
    }
  }

  /**
   * Soft delete a transaction (for corrections).
   */
  async softDelete(id: string): Promise<Result<{ id: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('courier_balance_transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Transaction not found or already deleted' };
      }

      return { success: true, data: { id: data.id } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete transaction',
      };
    }
  }

  /**
   * Get current balance for a courier.
   */
  async getCourierBalance(courierId: string): Promise<Result<CourierBalance>> {
    try {
      const { data, error } = await this.supabase
        .from('courier_balances')
        .select('*')
        .eq('courier_id', courierId)
        .eq('organization_id', this.organizationId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Courier not found' };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get courier balance',
      };
    }
  }

  /**
   * Get balances for all couriers, sorted by balance (lowest first - most in debt).
   */
  async getAllBalances(): Promise<Result<CourierBalance[]>> {
    try {
      const { data, error } = await this.supabase
        .from('courier_balances')
        .select('*')
        .eq('organization_id', this.organizationId)
        .order('balance', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balances',
      };
    }
  }

  /**
   * Get transaction statistics for a courier (totals by type).
   */
  async getCourierStats(courierId: string): Promise<
    Result<{
      totalDebits: number;
      totalCredits: number;
      balance: number;
      transactionCount: number;
    }>
  > {
    try {
      const { data, error } = await this.supabase.rpc('get_courier_transaction_stats', {
        p_organization_id: this.organizationId,
        p_courier_id: courierId,
      });

      if (error) {
        // Fallback: calculate from transactions if RPC doesn't exist yet
        const txnsResult = await this.list({ courier_id: courierId });
        if (!txnsResult.success) {
          return { success: false, error: txnsResult.error };
        }

        const txns = txnsResult.data;
        const totalDebits = txns
          .filter((t) => t.direction === 'debit')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalCredits = txns
          .filter((t) => t.direction === 'credit')
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          success: true,
          data: {
            totalDebits,
            totalCredits,
            balance: totalCredits - totalDebits,
            transactionCount: txns.length,
          },
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get courier stats',
      };
    }
  }

  /**
   * Get courier basic information (for audit logging).
   */
  async getCourierInfo(
    courierId: string
  ): Promise<Result<{ full_name: string; courier_code: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('couriers')
        .select('full_name, courier_code')
        .eq('id', courierId)
        .eq('organization_id', this.organizationId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Courier not found' };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get courier info',
      };
    }
  }
}
