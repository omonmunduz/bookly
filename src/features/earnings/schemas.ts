/**
 * VALIDATION SCHEMAS - EARNINGS
 *
 * Zod schemas for validating earnings and deductions input data.
 */

import { z } from 'zod';

export const earningsStatusEnum = z.enum(['draft', 'approved', 'paid']);
export const deductionTypeEnum = z.enum(['rental', 'damage', 'equipment', 'other']);

export const createIncomeEntrySchema = z.object({
  earnings_period_id: z.string().uuid('Invalid earnings period ID'),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createEarningsPeriodSchema = z.object({
  courier_id: z.string().uuid('Invalid courier ID'),
  period_start: z.string().date('Invalid start date'),
  period_end: z.string().date('Invalid end date'),
  status: earningsStatusEnum.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine(
  (data) => {
    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    return end >= start;
  },
  {
    message: 'End date must be after start date',
    path: ['period_end'],
  }
);

export const updateEarningsPeriodSchema = z.object({
  status: earningsStatusEnum.optional(),
  paid_at: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const createDeductionSchema = z.object({
  earnings_period_id: z.string().uuid('Invalid earnings period ID'),
  deduction_type: deductionTypeEnum,
  amount: z.number().min(0, 'Amount must be positive'),
  description: z.string().trim().min(1, 'Description is required').max(500),
  reference_id: z.string().uuid().nullable().optional(),
});

export const earningsFiltersSchema = z.object({
  courierId: z.string().uuid().optional(),
  status: earningsStatusEnum.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export type CreateIncomeEntryInput = z.infer<typeof createIncomeEntrySchema>;
export type CreateEarningsPeriodInput = z.infer<typeof createEarningsPeriodSchema>;
export type UpdateEarningsPeriodInput = z.infer<typeof updateEarningsPeriodSchema>;
export type CreateDeductionInput = z.infer<typeof createDeductionSchema>;
export type EarningsFilters = z.infer<typeof earningsFiltersSchema>;
