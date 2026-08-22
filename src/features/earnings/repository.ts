/**
 * EARNINGS REPOSITORY
 *
 * Data access layer for courier earnings periods and deductions.
 * Handles financial settlement tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EarningsPeriod,
  CreateEarningsPeriodInput,
  UpdateEarningsPeriodInput,
  Deduction,
  CreateDeductionInput,
  EarningsStatus,
  OrganizationId,
} from '@/lib/types/ebike';

export interface EarningsFilters {
  courierId?: string;
  status?: EarningsStatus;
  startDate?: string;
  endDate?: string;
}

export class EarningsRepository {
  constructor(private supabase: SupabaseClient) {}

  // ============================================================================
  // EARNINGS PERIODS
  // ============================================================================

  /**
   * List earnings periods
   */
  async list(organizationId: OrganizationId, filters?: EarningsFilters): Promise<EarningsPeriod[]> {
    let query = this.supabase
      .from('earnings_periods')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('period_start', { ascending: false });

    if (filters?.courierId) {
      query = query.eq('courier_id', filters.courierId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('period_start', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('period_end', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get earnings period by ID
   */
  async getById(id: string, organizationId: OrganizationId): Promise<EarningsPeriod | null> {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create earnings period
   */
  async create(
    input: CreateEarningsPeriodInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<EarningsPeriod> {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .insert({
        organization_id: organizationId,
        ...input,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update earnings period
   */
  async update(
    id: string,
    input: UpdateEarningsPeriodInput,
    organizationId: OrganizationId
  ): Promise<EarningsPeriod> {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .update(input)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update earnings period status
   */
  async updateStatus(
    id: string,
    status: EarningsStatus,
    organizationId: OrganizationId
  ): Promise<EarningsPeriod> {
    const updates: UpdateEarningsPeriodInput = { status };

    // If marking as paid, set paid_at timestamp
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }

    return this.update(id, updates, organizationId);
  }

  /**
   * Soft delete earnings period
   */
  async delete(id: string, organizationId: OrganizationId): Promise<void> {
    const { error } = await this.supabase
      .from('earnings_periods')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Get earnings periods for a courier
   */
  async getCourierEarnings(courierId: string, organizationId: OrganizationId): Promise<EarningsPeriod[]> {
    return this.list(organizationId, { courierId });
  }

  /**
   * Get earnings periods by status
   */
  async getByStatus(status: EarningsStatus, organizationId: OrganizationId): Promise<EarningsPeriod[]> {
    return this.list(organizationId, { status });
  }

  /**
   * Check for overlapping periods
   */
  async hasOverlappingPeriod(
    courierId: string,
    periodStart: string,
    periodEnd: string,
    organizationId: OrganizationId,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('earnings_periods')
      .select('id')
      .eq('courier_id', courierId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .or(`period_start.lte.${periodEnd},period_end.gte.${periodStart}`);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data && data.length > 0;
  }

  // ============================================================================
  // DEDUCTIONS
  // ============================================================================

  /**
   * List deductions for an earnings period
   */
  async listDeductions(earningsPeriodId: string, organizationId: OrganizationId): Promise<Deduction[]> {
    const { data, error } = await this.supabase
      .from('deductions')
      .select('*')
      .eq('earnings_period_id', earningsPeriodId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get deduction by ID
   */
  async getDeductionById(id: string, organizationId: OrganizationId): Promise<Deduction | null> {
    const { data, error } = await this.supabase
      .from('deductions')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create deduction
   * Trigger will recalculate total_deductions and net_payout
   */
  async createDeduction(
    input: CreateDeductionInput,
    organizationId: OrganizationId,
    userId: string
  ): Promise<Deduction> {
    const { data, error } = await this.supabase
      .from('deductions')
      .insert({
        organization_id: organizationId,
        ...input,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete deduction
   * Trigger will recalculate totals
   */
  async deleteDeduction(id: string, organizationId: OrganizationId): Promise<void> {
    const { error } = await this.supabase
      .from('deductions')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Get earnings period with deductions
   */
  async getWithDeductions(id: string, organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .select(
        `
        *,
        courier:courier_id(courier_code, full_name, phone),
        deductions:deductions(*)
      `
      )
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get total earnings summary for period
   */
  async getSummaryForPeriod(
    startDate: string,
    endDate: string,
    organizationId: OrganizationId
  ) {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .select('gross_earnings, total_deductions, net_payout')
      .eq('organization_id', organizationId)
      .gte('period_start', startDate)
      .lte('period_end', endDate)
      .is('deleted_at', null);

    if (error) throw error;

    const summary = {
      totalGrossEarnings: 0,
      totalDeductions: 0,
      totalNetPayouts: 0,
      periodCount: data?.length || 0,
    };

    data?.forEach((period) => {
      summary.totalGrossEarnings += period.gross_earnings || 0;
      summary.totalDeductions += period.total_deductions || 0;
      summary.totalNetPayouts += period.net_payout || 0;
    });

    return summary;
  }

  /**
   * Count earnings periods by status
   */
  async countByStatus(organizationId: OrganizationId) {
    const { data, error } = await this.supabase
      .from('earnings_periods')
      .select('status')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (error) throw error;

    const counts: Record<EarningsStatus, number> = {
      draft: 0,
      approved: 0,
      paid: 0,
    };

    data?.forEach((period) => {
      counts[period.status as EarningsStatus]++;
    });

    return counts;
  }
}
