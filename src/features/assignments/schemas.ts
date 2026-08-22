/**
 * VALIDATION SCHEMAS - ASSIGNMENTS
 *
 * Zod schemas for validating bike assignment input data.
 */

import { z } from 'zod';

export const createAssignmentSchema = z.object({
  bike_id: z.string().uuid('Invalid bike ID'),
  courier_id: z.string().uuid('Invalid courier ID'),
  rental_plan_id: z.string().uuid('Invalid rental plan ID'),
  condition_at_assignment: z.string().trim().min(1, 'Condition is required').max(500),
  assignment_notes: z.string().trim().max(1000).nullable().optional(),
});

export const returnAssignmentSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  condition_at_return: z.string().trim().min(1, 'Return condition is required').max(500),
  return_notes: z.string().trim().max(1000).nullable().optional(),
});

export const assignmentFiltersSchema = z.object({
  bikeId: z.string().uuid().optional(),
  courierId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ReturnAssignmentInput = z.infer<typeof returnAssignmentSchema>;
export type AssignmentFilters = z.infer<typeof assignmentFiltersSchema>;
