/**
 * VALIDATION SCHEMAS - RENTAL PLANS
 *
 * Zod schemas for validating rental plan input data.
 */

import { z } from 'zod';

export const durationUnitEnum = z.enum(['days', 'weeks', 'months']);

export const createRentalPlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name is required').max(100),
  duration_value: z.number().int().min(1, 'Duration must be at least 1'),
  duration_unit: durationUnitEnum,
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const updateRentalPlanSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  duration_value: z.number().int().min(1).optional(),
  duration_unit: durationUnitEnum.optional(),
  price: z.number().min(0).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateRentalPlanInput = z.infer<typeof createRentalPlanSchema>;
export type UpdateRentalPlanInput = z.infer<typeof updateRentalPlanSchema>;
