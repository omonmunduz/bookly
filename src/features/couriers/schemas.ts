/**
 * VALIDATION SCHEMAS - COURIERS
 *
 * Zod schemas for validating courier input data.
 */

import { z } from 'zod';

export const courierStatusEnum = z.enum(['active', 'inactive', 'suspended']);

// Phone validation - allow various formats
const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;

export const createCourierSchema = z.object({
  courier_code: z.string().optional(),
  full_name: z.string().trim().min(2, 'Full name is required').max(100),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format'),
  identification_number: z.string().trim().min(5).max(50).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  emergency_contact: z.string().trim().max(200).nullable().optional(),
  start_date: z.string().date().optional(),
  status: courierStatusEnum.optional(),
  yandex_identifier: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateCourierSchema = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional(),
  identification_number: z.string().trim().min(5).max(50).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  emergency_contact: z.string().trim().max(200).nullable().optional(),
  status: courierStatusEnum.optional(),
  yandex_identifier: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const courierFiltersSchema = z.object({
  status: courierStatusEnum.optional(),
  search: z.string().trim().optional(),
});

export type CreateCourierInput = z.infer<typeof createCourierSchema>;
export type UpdateCourierInput = z.infer<typeof updateCourierSchema>;
export type CourierFilters = z.infer<typeof courierFiltersSchema>;
