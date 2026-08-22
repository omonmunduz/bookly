import { SupabaseClient } from '@supabase/supabase-js';
import { MaintenanceRepository } from './repository';
import { BikesRepository } from '../bikes/repository';
import {
  createMaintenanceRecordSchema,
  approveMaintenanceSchema,
  createInspectionSchema,
} from './schemas';
import type {
  MaintenanceRecord,
  BikeInspection,
  CreateMaintenanceRecordInput,
  ApproveMaintenanceInput,
  CreateInspectionInput,
  MaintenancePendingApproval,
  Result,
} from '@/lib/types/ebike';

/**
 * MaintenanceService
 *
 * Business logic layer for maintenance and inspection management.
 * Handles validation, business rules, and delegates to repository.
 */
export class MaintenanceService {
  private repository: MaintenanceRepository;
  private bikesRepo: BikesRepository;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new MaintenanceRepository(supabase);
    this.bikesRepo = new BikesRepository(supabase);
  }

  // ============================================================================
  // MAINTENANCE RECORDS
  // ============================================================================

  /**
   * List maintenance records
   */
  async listMaintenance(bikeId?: string): Promise<Result<MaintenanceRecord[]>> {
    try {
      // Validate bike if provided
      if (bikeId) {
        const bike = await this.bikesRepo.getById(bikeId, this.organizationId);
        if (!bike) {
          return { success: false, error: 'Bike not found' };
        }
      }

      const records = await this.repository.listMaintenance(
        this.organizationId,
        bikeId
      );
      return { success: true, data: records };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list maintenance records',
      };
    }
  }

  /**
   * Get maintenance record by ID
   */
  async getMaintenanceById(id: string): Promise<Result<MaintenanceRecord>> {
    try {
      const record = await this.repository.getMaintenanceById(
        id,
        this.organizationId
      );

      if (!record) {
        return { success: false, error: 'Maintenance record not found' };
      }

      return { success: true, data: record };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get maintenance record',
      };
    }
  }

  /**
   * Create a new maintenance record
   */
  async createMaintenance(
    input: CreateMaintenanceRecordInput,
    userId: string
  ): Promise<Result<MaintenanceRecord>> {
    try {
      // Validate input
      const validation = createMaintenanceRecordSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Validate bike exists
      const bike = await this.bikesRepo.getById(
        validatedInput.bike_id,
        this.organizationId
      );

      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      // Business rule: Cannot perform maintenance on assigned bikes
      if (bike.status === 'assigned') {
        return {
          success: false,
          error:
            'Cannot create maintenance record for an assigned bike. Return the bike first.',
        };
      }

      // Business rule: Validate cost is non-negative
      if (validatedInput.cost && validatedInput.cost < 0) {
        return {
          success: false,
          error: 'Maintenance cost cannot be negative',
        };
      }

      // Business rule: Damage repairs require approval
      const requiresApproval =
        validatedInput.maintenance_type === 'repair' &&
        validatedInput.requires_approval !== false;

      // Create maintenance record
      const record = await this.repository.createMaintenance(
        {
          ...validatedInput,
          requires_approval: requiresApproval,
        },
        this.organizationId,
        userId
      );

      return { success: true, data: record };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create maintenance record',
      };
    }
  }

  /**
   * Approve a maintenance record (manager only)
   */
  async approveMaintenance(
    input: ApproveMaintenanceInput,
    managerId: string
  ): Promise<Result<MaintenanceRecord>> {
    try {
      // Validate input
      const validation = approveMaintenanceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check maintenance record exists
      const existingRecord = await this.repository.getMaintenanceById(
        validatedInput.maintenance_id,
        this.organizationId
      );

      if (!existingRecord) {
        return { success: false, error: 'Maintenance record not found' };
      }

      // Business rule: Can only approve records that require approval
      if (!existingRecord.requires_approval) {
        return {
          success: false,
          error: 'This maintenance record does not require approval',
        };
      }

      // Business rule: Cannot re-approve
      if (existingRecord.approved_at) {
        return {
          success: false,
          error:
            'Maintenance record is already approved on ' +
            new Date(existingRecord.approved_at).toLocaleDateString(),
        };
      }

      // Approve maintenance
      const record = await this.repository.approveMaintenance(
        validatedInput,
        this.organizationId,
        managerId
      );

      return { success: true, data: record };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to approve maintenance',
      };
    }
  }

  /**
   * Get maintenance records pending approval
   */
  async getPendingApproval(): Promise<Result<MaintenancePendingApproval[]>> {
    try {
      const records = await this.repository.getPendingApproval(
        this.organizationId
      );
      return { success: true, data: records };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get pending approvals',
      };
    }
  }

  /**
   * Get total maintenance cost for a bike
   */
  async getTotalMaintenanceCost(bikeId: string): Promise<Result<number>> {
    try {
      // Validate bike exists
      const bike = await this.bikesRepo.getById(bikeId, this.organizationId);
      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      const totalCost = await this.repository.getTotalMaintenanceCost(
        bikeId,
        this.organizationId
      );

      return { success: true, data: totalCost };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to calculate maintenance cost',
      };
    }
  }

  // ============================================================================
  // INSPECTIONS
  // ============================================================================

  /**
   * List inspections
   */
  async listInspections(bikeId?: string): Promise<Result<BikeInspection[]>> {
    try {
      // Validate bike if provided
      if (bikeId) {
        const bike = await this.bikesRepo.getById(bikeId, this.organizationId);
        if (!bike) {
          return { success: false, error: 'Bike not found' };
        }
      }

      const inspections = await this.repository.listInspections(
        this.organizationId,
        bikeId
      );
      return { success: true, data: inspections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list inspections',
      };
    }
  }

  /**
   * Get inspection by ID
   */
  async getInspectionById(id: string): Promise<Result<BikeInspection>> {
    try {
      const inspection = await this.repository.getInspectionById(
        id,
        this.organizationId
      );

      if (!inspection) {
        return { success: false, error: 'Inspection not found' };
      }

      return { success: true, data: inspection };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get inspection',
      };
    }
  }

  /**
   * Create a new inspection
   */
  async createInspection(
    input: CreateInspectionInput,
    userId: string
  ): Promise<Result<BikeInspection>> {
    try {
      // Validate input
      const validation = createInspectionSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Validate bike exists
      const bike = await this.bikesRepo.getById(
        validatedInput.bike_id,
        this.organizationId
      );

      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      // Business rule: Cannot inspect assigned bikes
      if (bike.status === 'assigned') {
        return {
          success: false,
          error:
            'Cannot inspect an assigned bike. Return the bike first or perform inspection during assignment/return.',
        };
      }

      // Create inspection
      // Note: Repository trigger will update bike.status based on next_status
      const inspection = await this.repository.createInspection(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: inspection };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create inspection',
      };
    }
  }

  /**
   * Get latest inspection for a bike
   */
  async getLatestInspection(
    bikeId: string
  ): Promise<Result<BikeInspection | null>> {
    try {
      // Validate bike exists
      const bike = await this.bikesRepo.getById(bikeId, this.organizationId);
      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      const inspection = await this.repository.getLatestInspection(
        bikeId,
        this.organizationId
      );

      return { success: true, data: inspection };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get latest inspection',
      };
    }
  }

  /**
   * Get inspections requiring maintenance follow-up
   */
  async getInspectionsRequiringMaintenance(): Promise<
    Result<BikeInspection[]>
  > {
    try {
      const inspections =
        await this.repository.getInspectionsRequiringMaintenance(
          this.organizationId
        );
      return { success: true, data: inspections };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get inspections requiring maintenance',
      };
    }
  }

  /**
   * Determine if inspection requires maintenance follow-up
   */
  requiresMaintenanceFollowUp(inspection: BikeInspection): boolean {
    return (
      inspection.overall_condition === 'damaged' ||
      inspection.overall_condition === 'poor' ||
      inspection.next_status === 'maintenance' ||
      inspection.next_status === 'damaged'
    );
  }

  /**
   * Get recommended next status based on inspection condition
   */
  getRecommendedNextStatus(
    condition: BikeInspection['overall_condition']
  ): 'available' | 'maintenance' | 'damaged' {
    switch (condition) {
      case 'excellent':
      case 'good':
        return 'available';
      case 'fair':
      case 'poor':
        return 'maintenance';
      case 'damaged':
        return 'damaged';
      default:
        return 'maintenance';
    }
  }
}
