import { SupabaseClient } from '@supabase/supabase-js';
import { CouriersRepository } from './repository';
import {
  createCourierSchema,
  updateCourierSchema,
  courierFiltersSchema,
} from './schemas';
import type {
  Courier,
  CreateCourierInput,
  UpdateCourierInput,
  CourierFilters,
  BikeAssignment,
  Result,
} from '@/lib/types/ebike';

/**
 * CouriersService
 *
 * Business logic layer for courier management.
 * Handles validation, business rules, and delegates to repository.
 */
export class CouriersService {
  private repository: CouriersRepository;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new CouriersRepository(supabase);
  }

  /**
   * List couriers with optional filters
   */
  async list(filters?: CourierFilters): Promise<Result<Courier[]>> {
    try {
      // Validate filters if provided
      if (filters) {
        const validation = courierFiltersSchema.safeParse(filters);
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
          error instanceof Error ? error.message : 'Failed to list couriers',
      };
    }
  }

  /**
   * Get courier by ID
   */
  async getById(id: string): Promise<Result<Courier>> {
    try {
      const courier = await this.repository.getById(id, this.organizationId);

      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get courier',
      };
    }
  }

  /**
   * Get courier by courier code (e.g., "COU-0001")
   */
  async getByCourierCode(courierCode: string): Promise<Result<Courier>> {
    try {
      const courier = await this.repository.getByCourierCode(
        courierCode,
        this.organizationId
      );

      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get courier',
      };
    }
  }

  /**
   * Search couriers by phone number.
   *
   * The repository does a partial match, so this returns every courier whose
   * phone contains the search string rather than a single row.
   */
  async searchByPhone(phone: string): Promise<Result<Courier[]>> {
    try {
      const courier = await this.repository.searchByPhone(
        phone,
        this.organizationId
      );
      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search courier',
      };
    }
  }

  /**
   * Create a new courier
   */
  async create(
    input: CreateCourierInput,
    userId: string
  ): Promise<Result<Courier>> {
    try {
      // Validate input
      const validation = createCourierSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Phone number must be unique within the organization.
      // searchByPhone does a partial match, so narrow to an exact collision.
      const phoneSearchResult = await this.searchByPhone(validatedInput.phone);

      if (!phoneSearchResult.success) {
        return phoneSearchResult;
      }

      const existingCourier = phoneSearchResult.data.find(
        (courier) => courier.phone === validatedInput.phone
      );

      if (existingCourier) {
        return {
          success: false,
          error: `A courier with phone number "${validatedInput.phone}" already exists`,
        };
      }

      // Business rule: Check courier code uniqueness if provided
      if (validatedInput.courier_code) {
        const courierByCode = await this.repository.getByCourierCode(
          validatedInput.courier_code,
          this.organizationId
        );

        if (courierByCode) {
          return {
            success: false,
            error: `Courier code "${validatedInput.courier_code}" already exists`,
          };
        }
      }

      // Create courier
      const courier = await this.repository.create(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create courier',
      };
    }
  }

  /**
   * Update a courier
   */
  async update(
    id: string,
    input: UpdateCourierInput
  ): Promise<Result<Courier>> {
    try {
      // Validate input
      const validation = updateCourierSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check courier exists
      const existingCourier = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingCourier) {
        return { success: false, error: 'Courier not found' };
      }

      // Business rule: Check phone number uniqueness if being changed
      if (
        validatedInput.phone &&
        validatedInput.phone !== existingCourier.phone
      ) {
        // searchByPhone is a partial match, so narrow to an exact collision
        // before rejecting — a courier on 555-0100 must not block 555-01000.
        const couriersByPhone = await this.repository.searchByPhone(
          validatedInput.phone,
          this.organizationId
        );

        const collision = couriersByPhone.find(
          (courier) =>
            courier.phone === validatedInput.phone && courier.id !== id
        );

        if (collision) {
          return {
            success: false,
            error: `Courier with phone number "${validatedInput.phone}" already exists`,
          };
        }
      }

      // No courier_code uniqueness check here: updateCourierSchema does not
      // accept courier_code, so an update cannot collide with another code.
      // The code is assigned once in create() and is fixed thereafter.

      // Update courier
      const courier = await this.repository.update(
        id,
        validatedInput,
        this.organizationId
      );

      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update courier',
      };
    }
  }

  /**
   * Update courier status
   */
  async updateStatus(
    id: string,
    status: Courier['status'],
    notes?: string
  ): Promise<Result<Courier>> {
    try {
      // Check courier exists
      const existingCourier = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingCourier) {
        return { success: false, error: 'Courier not found' };
      }

      // Business rule: Warn about active assignments (but allow status change)
      // The modal will show a warning, but we don't block the operation
      // This allows managers to suspend couriers even with active assignments
      // (e.g., for policy violations)

      // Update status and notes
      const updateData: Partial<Courier> = { status };
      if (notes) {
        updateData.notes = notes;
      }

      const courier = await this.repository.update(
        id,
        updateData,
        this.organizationId
      );

      return { success: true, data: courier };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update courier status',
      };
    }
  }

  /**
   * Delete a courier (soft delete)
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      // Check courier exists
      const existingCourier = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingCourier) {
        return { success: false, error: 'Courier not found' };
      }

      // Business rule: Cannot delete courier with active assignment
      const hasActiveAssignment = await this.repository.hasActiveAssignment(
        id,
        this.organizationId
      );

      if (hasActiveAssignment) {
        return {
          success: false,
          error:
            'Cannot delete courier with an active bike assignment. Return the bike first.',
        };
      }

      // Business rule: Warn if courier has assignment history
      // (We don't block deletion, but the repository should handle this gracefully)

      await this.repository.delete(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete courier',
      };
    }
  }

  /**
   * Get active couriers
   */
  async getActive(): Promise<Result<Courier[]>> {
    try {
      const couriers = await this.repository.getActive(this.organizationId);
      return { success: true, data: couriers };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get active couriers',
      };
    }
  }

  /**
   * Get courier's current assignment (if any)
   */
  async getCurrentAssignment(
    courierId: string
  ): Promise<Result<BikeAssignment | null>> {
    try {
      // Check courier exists
      const courier = await this.repository.getById(
        courierId,
        this.organizationId
      );
      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      const assignment = await this.repository.getCurrentAssignment(
        courierId,
        this.organizationId
      );

      return { success: true, data: assignment };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get current assignment',
      };
    }
  }

  /**
   * Get courier's assignment history
   */
  async getAssignmentHistory(
    courierId: string
  ): Promise<Result<BikeAssignment[]>> {
    try {
      // Check courier exists
      const courier = await this.repository.getById(
        courierId,
        this.organizationId
      );
      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      const history = await this.repository.getAssignmentHistory(
        courierId,
        this.organizationId
      );

      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get assignment history',
      };
    }
  }

  /**
   * Check if courier can be assigned a bike
   * Returns true if courier is active and has no current assignment
   */
  async canBeAssignedBike(courierId: string): Promise<Result<boolean>> {
    try {
      // Check courier exists
      const courier = await this.repository.getById(
        courierId,
        this.organizationId
      );
      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      // Business rule: Courier must be active
      if (courier.status !== 'active') {
        return { success: true, data: false };
      }

      // Business rule: Courier must not have an active assignment (max 1 bike)
      const hasActiveAssignment = await this.repository.hasActiveAssignment(
        courierId,
        this.organizationId
      );

      return { success: true, data: !hasActiveAssignment };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check courier eligibility',
      };
    }
  }
}
