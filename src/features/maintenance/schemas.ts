/**
 * VALIDATION SCHEMAS - MAINTENANCE
 *
 * Zod schemas for validating maintenance and inspection input data.
 */

import { z } from 'zod';

export const maintenanceTypeEnum = z.enum(['repair', 'inspection', 'replacement', 'cleaning', 'other']);
export const inspectionConditionEnum = z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']);
export const bikeStatusEnum = z.enum(['available', 'assigned', 'maintenance', 'damaged', 'retired']);

export const createMaintenanceRecordSchema = z.object({
  bike_id: z.string().uuid('Invalid bike ID'),
  maintenance_type: maintenanceTypeEnum,
  description: z.string().trim().min(1, 'Description is required').max(1000),
  cost: z.number().min(0).nullable().optional(),
  parts_replaced: z.string().trim().max(500).nullable().optional(),
  image_urls: z.array(z.string()).min(1, 'At least one photo is required'), // REQUIRED
  notes: z.string().trim().max(1000).nullable().optional(),
  requires_approval: z.boolean().optional(),
});

export const approveMaintenanceSchema = z.object({
  maintenance_id: z.string().uuid('Invalid maintenance ID'),
});

export const createInspectionSchema = z.object({
  bike_id: z.string().uuid('Invalid bike ID'),
  assignment_id: z.string().uuid().nullable().optional(),
  overall_condition: inspectionConditionEnum,
  brakes_condition: inspectionConditionEnum.nullable().optional(),
  tires_condition: inspectionConditionEnum.nullable().optional(),
  lights_condition: inspectionConditionEnum.nullable().optional(),
  frame_condition: inspectionConditionEnum.nullable().optional(),
  battery_condition: inspectionConditionEnum.nullable().optional(),
  damage_notes: z.string().trim().max(1000).nullable().optional(),
  damage_photos: z.array(z.string()).nullable().optional(),
  requires_maintenance: z.boolean(),
  next_status: bikeStatusEnum,
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine(
  (data) => {
    // If overall condition is 'damaged', damage_notes should be provided
    if (data.overall_condition === 'damaged' && !data.damage_notes) {
      return false;
    }
    return true;
  },
  {
    message: 'Damage notes are required when condition is damaged',
    path: ['damage_notes'],
  }
).refine(
  (data) => {
    // If overall condition is 'damaged', next_status should be 'maintenance' or 'damaged'
    if (data.overall_condition === 'damaged' &&
        data.next_status !== 'maintenance' &&
        data.next_status !== 'damaged') {
      return false;
    }
    return true;
  },
  {
    message: 'Damaged bikes must have next_status as "maintenance" or "damaged"',
    path: ['next_status'],
  }
);

export type CreateMaintenanceRecordInput = z.infer<typeof createMaintenanceRecordSchema>;
export type ApproveMaintenanceInput = z.infer<typeof approveMaintenanceSchema>;
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
