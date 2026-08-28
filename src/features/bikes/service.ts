import { SupabaseClient } from '@supabase/supabase-js';
import { BikesRepository } from './repository';
import { AuditService } from '@/features/audit/service';
import {
  createBikeSchema,
  updateBikeSchema,
  bikeFiltersSchema,
} from './schemas';
import type {
  Bike,
  CreateBikeInput,
  UpdateBikeInput,
  BikeFilters,
  BikeStatusSummary,
  Result,
  PaginatedResult,
} from '@/lib/types/ebike';

/**
 * BikesService
 *
 * Business logic layer for bike management.
 * Handles validation, business rules, and delegates to repository.
 */
export class BikesService {
  private repository: BikesRepository;
  private auditService: AuditService;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new BikesRepository(supabase);
    this.auditService = new AuditService(supabase, organizationId);
  }

  /**
   * List bikes with optional filters
   */
  async list(filters?: BikeFilters): Promise<Result<Bike[]>> {
    try {
      // Validate filters if provided
      if (filters) {
        const validation = bikeFiltersSchema.safeParse(filters);
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
        error: error instanceof Error ? error.message : 'Failed to list bikes',
      };
    }
  }

  /**
   * Get bike by ID
   */
  async getById(id: string): Promise<Result<Bike>> {
    try {
      const bike = await this.repository.getById(id, this.organizationId);

      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      return { success: true, data: bike };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bike',
      };
    }
  }

  /**
   * Get bike by bike number (e.g., "EB-001")
   */
  async getByBikeNumber(bikeNumber: string): Promise<Result<Bike>> {
    try {
      const bike = await this.repository.getByBikeNumber(
        bikeNumber,
        this.organizationId
      );

      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      return { success: true, data: bike };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bike',
      };
    }
  }

  /**
   * Create a new bike
   */
  async create(input: CreateBikeInput, userId: string): Promise<Result<Bike>> {
    try {
      // Validate input
      const validation = createBikeSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Check bike number uniqueness if provided
      if (validatedInput.bike_number) {
        const isUnique = await this.repository.isBikeNumberUnique(
          validatedInput.bike_number,
          this.organizationId
        );

        if (!isUnique) {
          return {
            success: false,
            error: `Bike number "${validatedInput.bike_number}" already exists`,
          };
        }
      }

      // Create bike
      const bike = await this.repository.create(
        validatedInput,
        this.organizationId,
        userId
      );

      // Audit log
      await this.auditService.logBikeCreated(
        userId,
        bike.id,
        bike.bike_number,
        {
          model: bike.model,
          status: bike.status,
          purchase_price: bike.purchase_price || undefined,
        }
      );

      return { success: true, data: bike };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bike',
      };
    }
  }

  /**
   * Update a bike
   */
  async update(
    id: string,
    input: UpdateBikeInput
  ): Promise<Result<Bike>> {
    try {
      // Validate input
      const validation = updateBikeSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check bike exists
      const existingBike = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingBike) {
        return { success: false, error: 'Bike not found' };
      }

      // No bike number uniqueness check here: updateBikeSchema does not accept
      // bike_number, so an update cannot collide with another bike's number.
      // The number is assigned once in create() and is fixed thereafter.

      // Business rule: Cannot change status if bike is assigned
      if (
        validatedInput.status &&
        validatedInput.status !== existingBike.status &&
        existingBike.status === 'assigned'
      ) {
        return {
          success: false,
          error:
            'Cannot change status of an assigned bike. Return the bike first.',
        };
      }

      // Update bike
      const bike = await this.repository.update(
        id,
        validatedInput,
        this.organizationId
      );

      return { success: true, data: bike };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update bike',
      };
    }
  }

  /**
   * Update bike status
   * This is a separate method to handle status changes with business rules
   */
  async updateStatus(
    id: string,
    status: Bike['status'],
    notes?: string
  ): Promise<Result<Bike>> {
    try {
      // Check bike exists
      const existingBike = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingBike) {
        return { success: false, error: 'Bike not found' };
      }

      // Business rule: Cannot manually change status to 'assigned' or 'returned'
      // - 'assigned' is set through BikeAssignmentsService
      // - 'returned' is set through bike return workflow
      if (status === 'assigned') {
        return {
          success: false,
          error:
            'Cannot manually set bike to "assigned" status. Use assignment workflow.',
        };
      }

      if (status === 'returned') {
        return {
          success: false,
          error:
            'Cannot manually set bike to "returned" status. Use bike return workflow.',
        };
      }

      // Business rule: Cannot change status away from 'assigned' or 'returned' without
      // going through proper workflow.
      // - 'assigned' bikes must be returned through AssignmentsService
      // - 'returned' bikes must be inspected (inspection sets final status)
      if (existingBike.status === 'assigned') {
        return {
          success: false,
          error:
            'Cannot change status of an assigned bike. Return the bike first.',
        };
      }

      if (existingBike.status === 'returned') {
        return {
          success: false,
          error:
            'Cannot change status of a returned bike. Perform inspection to determine final status.',
        };
      }

      // Update status, recording any explanation against condition_notes —
      // Bike has no plain `notes` column, and a status change is nearly always
      // a statement about the bike's condition.
      const updateData: Partial<Bike> = { status };
      if (notes) {
        updateData.condition_notes = notes;
      }

      const bike = await this.repository.update(
        id,
        updateData,
        this.organizationId
      );

      // Audit log
      await this.auditService.logBikeStatusChanged(
        existingBike.created_by || 'system', // fallback if created_by is null
        bike.id,
        bike.bike_number,
        existingBike.status,
        status,
        notes
      );

      return { success: true, data: bike };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update bike status',
      };
    }
  }

  /**
   * Delete a bike (soft delete)
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      // Check bike exists
      const existingBike = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingBike) {
        return { success: false, error: 'Bike not found' };
      }

      // Business rule: Cannot delete an assigned bike
      if (existingBike.status === 'assigned') {
        return {
          success: false,
          error: 'Cannot delete an assigned bike. Return the bike first.',
        };
      }

      // Business rule: Warn if bike has maintenance history
      // (We don't block deletion, but the repository should handle this gracefully)

      await this.repository.delete(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete bike',
      };
    }
  }

  /**
   * Get available bikes for assignment
   */
  async getAvailable(): Promise<Result<Bike[]>> {
    try {
      const bikes = await this.repository.getAvailable(this.organizationId);
      return { success: true, data: bikes };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get available bikes',
      };
    }
  }

  /**
   * Get bikes needing maintenance
   */
  async getNeedingMaintenance(): Promise<Result<Bike[]>> {
    try {
      const bikes = await this.repository.getNeedingMaintenance(
        this.organizationId
      );
      return { success: true, data: bikes };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get bikes needing maintenance',
      };
    }
  }

  /**
   * Get bikes awaiting inspection (returned status)
   */
  async getAwaitingInspection(): Promise<Result<Bike[]>> {
    try {
      const bikes = await this.repository.getAwaitingInspection(
        this.organizationId
      );
      return { success: true, data: bikes };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get bikes awaiting inspection',
      };
    }
  }

  /**
   * Get bike count by status (for dashboard)
   */
  async countByStatus(): Promise<
    Result<Record<Bike['status'], number>>
  > {
    try {
      const counts = await this.repository.countByStatus(this.organizationId);
      return { success: true, data: counts };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to count bikes by status',
      };
    }
  }

  /**
   * Get enriched bike status summary (bikes with current assignment info)
   */
  async getStatusSummary(): Promise<Result<BikeStatusSummary[]>> {
    try {
      const summary = await this.repository.getStatusSummary(
        this.organizationId
      );
      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get bike status summary',
      };
    }
  }
}
