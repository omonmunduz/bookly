/**
 * VALIDATION SCHEMAS - BIKES
 *
 * Zod schemas for validating bike input data.
 */

import { z } from 'zod';

export const bikeStatusEnum = z.enum(['available', 'assigned', 'maintenance', 'damaged', 'retired']);

export const createBikeSchema = z.object({
  bike_number: z.string().optional(),
  serial_number: z.string().trim().min(1).max(100).nullable().optional(),
  model: z.string().trim().min(1, 'Модель обязательна').max(100),
  status: bikeStatusEnum.optional(),
  purchase_date: z.string().date().nullable().optional(),
  purchase_price: z.number().min(0).nullable().optional(),
  condition_notes: z.string().max(500).nullable().optional(),
  battery_info: z.string().max(500).nullable().optional(),
  image_url: z.string().url('Должен быть действительный URL').nullable().optional(), // Optional - file upload coming soon
});

export const updateBikeSchema = z.object({
  serial_number: z.string().trim().min(1).max(100).nullable().optional(),
  model: z.string().trim().min(1).max(100).optional(),
  status: bikeStatusEnum.optional(),
  purchase_date: z.string().date().nullable().optional(),
  purchase_price: z.number().min(0).nullable().optional(),
  condition_notes: z.string().max(500).nullable().optional(),
  battery_info: z.string().max(500).nullable().optional(),
  image_url: z.string().url('Должен быть действительный URL').nullable().optional(),
});

export const bikeFiltersSchema = z.object({
  status: bikeStatusEnum.optional(),
  search: z.string().trim().optional(),
});

export type CreateBikeInput = z.infer<typeof createBikeSchema>;
export type UpdateBikeInput = z.infer<typeof updateBikeSchema>;
export type BikeFilters = z.infer<typeof bikeFiltersSchema>;
