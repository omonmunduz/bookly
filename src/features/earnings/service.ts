import { SupabaseClient } from '@supabase/supabase-js';
import { EarningsRepository } from './repository';
import { CouriersRepository } from '../couriers/repository';
import {
  createEarningsPeriodSchema,
  updateEarningsPeriodSchema,
  createIncomeEntrySchema,
  createDeductionSchema,
  earningsFiltersSchema,
} from './schemas';
import type {
  EarningsPeriod,
  IncomeEntry,
  Deduction,
  CreateEarningsPeriodInput,
  UpdateEarningsPeriodInput,
  CreateIncomeEntryInput,
  CreateDeductionInput,
  EarningsFilters,
  EarningsPeriodWithDeductions,
  EarningsSummary,
  Result,
  PaginatedResult,
} from '@/lib/types/ebike';

/**
 * EarningsService
 *
 * Business logic layer for earnings and deductions management.
 * Handles validation, business rules, and delegates to repository.
 */
export class EarningsService {
  private repository: EarningsRepository;
  private couriersRepo: CouriersRepository;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new EarningsRepository(supabase);
    this.couriersRepo = new CouriersRepository(supabase);
  }

  /**
   * List earnings periods with optional filters
   */
  async list(
    filters?: EarningsFilters
  ): Promise<Result<EarningsPeriod[]>> {
    try {
      // Validate filters if provided
      if (filters) {
        const validation = earningsFiltersSchema.safeParse(filters);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error.errors[0]?.message || 'Invalid filters',
          };
        }
      }

      const result = await this.repository.list(this.organizationId, filters);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list earnings periods',
      };
    }
  }

  /**
   * Get earnings period by ID
   */
  async getById(id: string): Promise<Result<EarningsPeriod>> {
    try {
      const period = await this.repository.getById(id, this.organizationId);

      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get earnings period',
      };
    }
  }

  /**
   * Get earnings period with deductions
   */
  async getWithDeductions(
    id: string
  ): Promise<Result<EarningsPeriodWithDeductions>> {
    try {
      const period = await this.repository.getWithDeductions(
        id,
        this.organizationId
      );

      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get earnings period',
      };
    }
  }

  /**
   * Create a new earnings period
   */
  async create(
    input: CreateEarningsPeriodInput,
    userId: string
  ): Promise<Result<EarningsPeriod>> {
    try {
      // Validate input
      const validation = createEarningsPeriodSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Validate courier exists
      const courier = await this.couriersRepo.getById(
        validatedInput.courier_id,
        this.organizationId
      );

      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      // Business rule: Check for overlapping periods
      const hasOverlap = await this.repository.hasOverlappingPeriod(
        validatedInput.courier_id,
        validatedInput.period_start,
        validatedInput.period_end,
        this.organizationId
      );

      if (hasOverlap) {
        return {
          success: false,
          error:
            'An earnings period already exists for this courier in the specified date range',
        };
      }

      // Create period (starts with zero gross_earnings, income entries added later)
      const period = await this.repository.create(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create earnings period',
      };
    }
  }

  /**
   * Add income to an earnings period
   */
  async addIncome(
    input: CreateIncomeEntryInput,
    userId: string
  ): Promise<Result<IncomeEntry>> {
    try {
      // Validate input
      const validation = createIncomeEntrySchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check earnings period exists
      const period = await this.repository.getById(
        validatedInput.earnings_period_id,
        this.organizationId
      );
      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot add income to paid periods
      if (period.status === 'paid') {
        return {
          success: false,
          error: 'Cannot add income to a paid earnings period',
        };
      }

      // Business rule: Validate amount is positive
      if (validatedInput.amount <= 0) {
        return {
          success: false,
          error: 'Income amount must be greater than zero',
        };
      }

      // Create income entry
      // Note: Repository trigger will auto-recalculate gross_earnings and log activity
      const incomeEntry = await this.repository.createIncomeEntry(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: incomeEntry };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add income',
      };
    }
  }

  /**
   * Delete an income entry
   */
  async deleteIncome(id: string): Promise<Result<void>> {
    try {
      // Get income entry to check earnings period status
      const incomeEntries = await this.repository.listIncomeEntries(
        '',
        this.organizationId
      );
      const incomeEntry = incomeEntries.find((i) => i.id === id);

      if (!incomeEntry) {
        return { success: false, error: 'Income entry not found' };
      }

      // Check earnings period status
      const period = await this.repository.getById(
        incomeEntry.earnings_period_id,
        this.organizationId
      );

      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot delete income from paid periods
      if (period.status === 'paid') {
        return {
          success: false,
          error: 'Cannot delete income from a paid earnings period',
        };
      }

      // Delete income entry
      // Note: Repository trigger will auto-recalculate gross_earnings and log activity
      await this.repository.deleteIncomeEntry(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete income',
      };
    }
  }

  /**
   * Update an earnings period
   */
  async update(
    id: string,
    input: UpdateEarningsPeriodInput
  ): Promise<Result<EarningsPeriod>> {
    try {
      // Validate input
      const validation = updateEarningsPeriodSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check period exists
      const existingPeriod = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPeriod) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot edit paid periods
      if (existingPeriod.status === 'paid') {
        return {
          success: false,
          error: 'Cannot edit a paid earnings period',
        };
      }

      // No overlap check here: updateEarningsPeriodSchema does not accept
      // period_start or period_end, so an update cannot move a period's dates
      // into another one's range. Overlap is enforced in create(), where the
      // dates are actually set.

      // Update period
      const period = await this.repository.update(
        id,
        validatedInput,
        this.organizationId
      );

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update earnings period',
      };
    }
  }

  /**
   * Update earnings period status
   */
  async updateStatus(
    id: string,
    status: EarningsPeriod['status']
  ): Promise<Result<EarningsPeriod>> {
    try {
      // Check period exists
      const existingPeriod = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPeriod) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Status workflow validation (draft → approved → paid)
      if (
        existingPeriod.status === 'draft' &&
        status !== 'approved' &&
        status !== 'draft'
      ) {
        return {
          success: false,
          error: 'Draft periods must be approved before marking as paid',
        };
      }

      if (existingPeriod.status === 'paid' && status !== 'paid') {
        return {
          success: false,
          error: 'Cannot change status of a paid period',
        };
      }

      // Update status
      const period = await this.repository.updateStatus(
        id,
        status,
        this.organizationId
      );

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update earnings period status',
      };
    }
  }

  /**
   * Delete an earnings period (soft delete)
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      // Check period exists
      const existingPeriod = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPeriod) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot delete paid periods
      if (existingPeriod.status === 'paid') {
        return {
          success: false,
          error: 'Cannot delete a paid earnings period',
        };
      }

      await this.repository.delete(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete earnings period',
      };
    }
  }

  /**
   * Add a deduction to an earnings period
   */
  async createDeduction(
    input: CreateDeductionInput,
    userId: string
  ): Promise<Result<Deduction>> {
    try {
      // Validate input
      const validation = createDeductionSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check earnings period exists
      const period = await this.repository.getById(
        validatedInput.earnings_period_id,
        this.organizationId
      );
      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot add deductions to paid periods
      if (period.status === 'paid') {
        return {
          success: false,
          error: 'Cannot add deductions to a paid earnings period',
        };
      }

      // Business rule: Validate amount is positive
      if (validatedInput.amount <= 0) {
        return {
          success: false,
          error: 'Deduction amount must be greater than zero',
        };
      }

      // Create deduction
      // Note: Repository trigger will auto-recalculate totals
      const deduction = await this.repository.createDeduction(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: deduction };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add deduction',
      };
    }
  }

  /**
   * Delete a deduction
   */
  async deleteDeduction(id: string): Promise<Result<void>> {
    try {
      // Get deduction to check earnings period status
      const deductions = await this.repository.listDeductions(
        '',
        this.organizationId
      );
      const deduction = deductions.find((d) => d.id === id);

      if (!deduction) {
        return { success: false, error: 'Deduction not found' };
      }

      // Check earnings period status
      const period = await this.repository.getById(
        deduction.earnings_period_id,
        this.organizationId
      );

      if (!period) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Cannot delete deductions from paid periods
      if (period.status === 'paid') {
        return {
          success: false,
          error: 'Cannot delete deductions from a paid earnings period',
        };
      }

      // Delete deduction
      // Note: Repository trigger will auto-recalculate totals
      await this.repository.deleteDeduction(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete deduction',
      };
    }
  }

  /**
   * Get earnings summary for a date range
   */
  async getSummaryForPeriod(
    startDate: Date,
    endDate: Date
  ): Promise<Result<EarningsSummary>> {
    try {
      // Business rule: Validate date range
      if (startDate > endDate) {
        return {
          success: false,
          error: 'Start date must be before end date',
        };
      }

      const summary = await this.repository.getSummaryForPeriod(
        // The repository filters on date columns, which expect yyyy-mm-dd.
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
        this.organizationId
      );

      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get earnings summary',
      };
    }
  }

  /**
   * Get count of periods by status (for dashboard)
   */
  async countByStatus(): Promise<
    Result<Record<EarningsPeriod['status'], number>>
  > {
    try {
      const counts = await this.repository.countByStatus(this.organizationId);
      return { success: true, data: counts };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to count earnings by status',
      };
    }
  }

  /**
   * Mark an earnings period as paid
   * Sets status to 'paid' and paid_at to current timestamp
   */
  async markAsPaid(id: string): Promise<Result<EarningsPeriod>> {
    try {
      // Check period exists
      const existingPeriod = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPeriod) {
        return { success: false, error: 'Earnings period not found' };
      }

      // Business rule: Period must be approved before marking as paid
      if (existingPeriod.status === 'draft') {
        return {
          success: false,
          error: 'Period must be approved before marking as paid',
        };
      }

      // Business rule: Already paid
      if (existingPeriod.status === 'paid') {
        return {
          success: false,
          error: 'Period is already marked as paid',
        };
      }

      // Mark as paid with current timestamp
      const period = await this.repository.update(
        id,
        {
          status: 'paid',
          paid_at: new Date().toISOString(),
        },
        this.organizationId
      );

      return { success: true, data: period };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to mark earnings period as paid',
      };
    }
  }

  /**
   * Calculate net payout (gross - deductions)
   * Helper method for validation
   */
  calculateNetPayout(
    grossEarnings: number,
    totalDeductions: number
  ): number {
    return Math.max(0, grossEarnings - totalDeductions);
  }
}
