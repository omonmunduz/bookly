/**
 * AUDIT SERVICE
 *
 * Application-layer service for logging business actions to the audit trail.
 *
 * Design:
 * - Wraps the database log_audit_event() function
 * - Provides type-safe action names via constants
 * - Handles error gracefully (audit failure should not break business operations)
 * - Used by all service methods that perform write operations
 *
 * Usage:
 *   const auditService = new AuditService(supabase, organizationId);
 *   await auditService.log({
 *     actorUserId: user.id,
 *     action: AUDIT_ACTIONS.BIKE_CREATED,
 *     entityType: 'bike',
 *     entityId: bike.id,
 *     entityName: bike.bike_number,
 *     metadata: { model: bike.model, status: bike.status }
 *   });
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { OrganizationId, UserId } from '@/lib/types/ebike';

// ============================================================================
// AUDIT ACTION CONSTANTS
// ============================================================================

export const AUDIT_ACTIONS = {
  // Bikes
  BIKE_CREATED: 'BIKE_CREATED',
  BIKE_UPDATED: 'BIKE_UPDATED',
  BIKE_STATUS_CHANGED: 'BIKE_STATUS_CHANGED',
  BIKE_DELETED: 'BIKE_DELETED',

  // Couriers
  COURIER_CREATED: 'COURIER_CREATED',
  COURIER_UPDATED: 'COURIER_UPDATED',
  COURIER_STATUS_CHANGED: 'COURIER_STATUS_CHANGED',
  COURIER_DELETED: 'COURIER_DELETED',

  // Assignments
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_RETURNED: 'ASSIGNMENT_RETURNED',

  // Inspections
  INSPECTION_CREATED: 'INSPECTION_CREATED',
  INSPECTION_RESULT_RECORDED: 'INSPECTION_RESULT_RECORDED',

  // Maintenance
  MAINTENANCE_CREATED: 'MAINTENANCE_CREATED',
  MAINTENANCE_APPROVED: 'MAINTENANCE_APPROVED',
  MAINTENANCE_COMPLETED: 'MAINTENANCE_COMPLETED',

  // Rental Plans
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_UPDATED: 'PLAN_UPDATED',
  PLAN_ACTIVATED: 'PLAN_ACTIVATED',
  PLAN_DEACTIVATED: 'PLAN_DEACTIVATED',

  // Earnings
  EARNINGS_CREATED: 'EARNINGS_CREATED',
  EARNINGS_UPDATED: 'EARNINGS_UPDATED',
  EARNINGS_APPROVED: 'EARNINGS_APPROVED',
  EARNINGS_PAID: 'EARNINGS_PAID',
  DEDUCTION_ADDED: 'DEDUCTION_ADDED',
  DEDUCTION_REMOVED: 'DEDUCTION_REMOVED',

  // Employees
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_ROLE_CHANGED: 'EMPLOYEE_ROLE_CHANGED',
  EMPLOYEE_DEACTIVATED: 'EMPLOYEE_DEACTIVATED',
  EMPLOYEE_REACTIVATED: 'EMPLOYEE_REACTIVATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ============================================================================
// ENTITY TYPES
// ============================================================================

export const ENTITY_TYPES = {
  BIKE: 'bike',
  COURIER: 'courier',
  ASSIGNMENT: 'assignment',
  INSPECTION: 'inspection',
  MAINTENANCE: 'maintenance',
  RENTAL_PLAN: 'rental_plan',
  EARNINGS: 'earnings',
  DEDUCTION: 'deduction',
  EMPLOYEE: 'employee',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// ============================================================================
// AUDIT LOG PARAMETERS
// ============================================================================

export interface AuditLogParams {
  actorUserId: UserId;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// AUDIT SERVICE
// ============================================================================

export class AuditService {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: OrganizationId
  ) {}

  /**
   * Log an audit event
   *
   * This method calls the database function log_audit_event() which:
   * 1. Looks up actor name and role
   * 2. Creates snapshot of actor details
   * 3. Inserts audit log record
   *
   * Errors are caught and logged but do not throw - audit failures
   * should not break business operations.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('log_audit_event', {
        p_organization_id: this.organizationId,
        p_actor_user_id: params.actorUserId,
        p_action: params.action,
        p_entity_type: params.entityType,
        p_entity_id: params.entityId,
        p_entity_name: params.entityName || null,
        p_metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      });

      if (error) {
        // Log error but don't throw - audit failure should not break operations
        console.error('Audit logging failed:', error);
      }
    } catch (error) {
      console.error('Audit logging exception:', error);
    }
  }

  /**
   * Convenience method: Log bike creation
   */
  async logBikeCreated(
    actorUserId: UserId,
    bikeId: string,
    bikeNumber: string,
    metadata: { model: string; status: string; purchase_price?: number }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.BIKE_CREATED,
      entityType: ENTITY_TYPES.BIKE,
      entityId: bikeId,
      entityName: bikeNumber,
      metadata,
    });
  }

  /**
   * Convenience method: Log bike status change
   */
  async logBikeStatusChanged(
    actorUserId: UserId,
    bikeId: string,
    bikeNumber: string,
    fromStatus: string,
    toStatus: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.BIKE_STATUS_CHANGED,
      entityType: ENTITY_TYPES.BIKE,
      entityId: bikeId,
      entityName: bikeNumber,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
        reason,
      },
    });
  }

  /**
   * Convenience method: Log courier creation
   */
  async logCourierCreated(
    actorUserId: UserId,
    courierId: string,
    courierName: string,
    metadata: { courier_code: string; phone: string; status: string }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.COURIER_CREATED,
      entityType: ENTITY_TYPES.COURIER,
      entityId: courierId,
      entityName: courierName,
      metadata,
    });
  }

  /**
   * Convenience method: Log courier status change
   */
  async logCourierStatusChanged(
    actorUserId: UserId,
    courierId: string,
    courierName: string,
    fromStatus: string,
    toStatus: string
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.COURIER_STATUS_CHANGED,
      entityType: ENTITY_TYPES.COURIER,
      entityId: courierId,
      entityName: courierName,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
      },
    });
  }

  /**
   * Convenience method: Log bike assignment
   */
  async logAssignmentCreated(
    actorUserId: UserId,
    assignmentId: string,
    metadata: {
      bike_number: string;
      courier_name: string;
      plan_name: string;
      plan_price: number;
    }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.ASSIGNMENT_CREATED,
      entityType: ENTITY_TYPES.ASSIGNMENT,
      entityId: assignmentId,
      entityName: `${metadata.bike_number} → ${metadata.courier_name}`,
      metadata,
    });
  }

  /**
   * Convenience method: Log bike return
   */
  async logAssignmentReturned(
    actorUserId: UserId,
    assignmentId: string,
    metadata: {
      bike_number: string;
      courier_name: string;
      condition_at_return: string;
    }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.ASSIGNMENT_RETURNED,
      entityType: ENTITY_TYPES.ASSIGNMENT,
      entityId: assignmentId,
      entityName: `${metadata.bike_number} ← ${metadata.courier_name}`,
      metadata,
    });
  }

  /**
   * Convenience method: Log inspection creation
   */
  async logInspectionCreated(
    actorUserId: UserId,
    inspectionId: string,
    metadata: {
      bike_number: string;
      overall_condition: string;
      next_status: string;
      requires_maintenance: boolean;
    }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.INSPECTION_CREATED,
      entityType: ENTITY_TYPES.INSPECTION,
      entityId: inspectionId,
      entityName: metadata.bike_number,
      metadata,
    });
  }

  /**
   * Convenience method: Log maintenance creation
   */
  async logMaintenanceCreated(
    actorUserId: UserId,
    maintenanceId: string,
    metadata: {
      bike_number: string;
      maintenance_type: string;
      description: string;
      cost?: number;
    }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.MAINTENANCE_CREATED,
      entityType: ENTITY_TYPES.MAINTENANCE,
      entityId: maintenanceId,
      entityName: metadata.bike_number,
      metadata,
    });
  }

  /**
   * Convenience method: Log maintenance approval
   */
  async logMaintenanceApproved(
    actorUserId: UserId,
    maintenanceId: string,
    metadata: {
      bike_number: string;
      maintenance_type: string;
      cost?: number;
    }
  ): Promise<void> {
    await this.log({
      actorUserId,
      action: AUDIT_ACTIONS.MAINTENANCE_APPROVED,
      entityType: ENTITY_TYPES.MAINTENANCE,
      entityId: maintenanceId,
      entityName: metadata.bike_number,
      metadata,
    });
  }
}
