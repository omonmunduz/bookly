import { SupabaseClient } from '@supabase/supabase-js';
import { RentalPlansRepository } from './repository';
import {
  createRentalPlanSchema,
  updateRentalPlanSchema,
} from './schemas';
import type {
  RentalPlan,
  CreateRentalPlanInput,
  UpdateRentalPlanInput,
  Result,
} from '@/lib/types/ebike';

/**
 * RentalPlansService
 *
 * Business logic layer for rental plan management.
 * Handles validation, business rules, and delegates to repository.
 */
export class RentalPlansService {
  private repository: RentalPlansRepository;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new RentalPlansRepository(supabase);
  }

  /**
   * List all rental plans
   */
  async list(activeOnly: boolean = false): Promise<Result<RentalPlan[]>> {
    try {
      const plans = await this.repository.list(this.organizationId, activeOnly);
      return { success: true, data: plans };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list rental plans',
      };
    }
  }

  /**
   * Get active rental plans only
   */
  async getActive(): Promise<Result<RentalPlan[]>> {
    try {
      const plans = await this.repository.getActive(this.organizationId);
      return { success: true, data: plans };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get active rental plans',
      };
    }
  }

  /**
   * Get rental plan by ID
   */
  async getById(id: string): Promise<Result<RentalPlan>> {
    try {
      const plan = await this.repository.getById(id, this.organizationId);

      if (!plan) {
        return { success: false, error: 'Rental plan not found' };
      }

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get rental plan',
      };
    }
  }

  /**
   * Get rental plan by name
   */
  async getByName(name: string): Promise<Result<RentalPlan | null>> {
    try {
      const plan = await this.repository.getByName(name, this.organizationId);
      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get rental plan',
      };
    }
  }

  /**
   * Create a new rental plan
   */
  async create(
    input: CreateRentalPlanInput,
    userId: string
  ): Promise<Result<RentalPlan>> {
    try {
      // Validate input
      const validation = createRentalPlanSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Check plan name uniqueness
      const isUnique = await this.repository.isPlanNameUnique(
        validatedInput.name,
        this.organizationId
      );

      if (!isUnique) {
        return {
          success: false,
          error: `Rental plan named "${validatedInput.name}" already exists`,
        };
      }

      // Create plan
      const plan = await this.repository.create(
        validatedInput,
        this.organizationId,
        userId
      );

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create rental plan',
      };
    }
  }

  /**
   * Update a rental plan
   */
  async update(
    id: string,
    input: UpdateRentalPlanInput
  ): Promise<Result<RentalPlan>> {
    try {
      // Validate input
      const validation = updateRentalPlanSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check plan exists
      const existingPlan = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPlan) {
        return { success: false, error: 'Rental plan not found' };
      }

      // Business rule: Check plan name uniqueness if being changed
      if (validatedInput.name && validatedInput.name !== existingPlan.name) {
        const isUnique = await this.repository.isPlanNameUnique(
          validatedInput.name,
          this.organizationId,
          id
        );

        if (!isUnique) {
          return {
            success: false,
            error: `Rental plan named "${validatedInput.name}" already exists`,
          };
        }
      }

      // Business rule: Warn if plan has active assignments
      // (We allow updates, but note that existing assignments keep snapshotted values)

      // Update plan
      const plan = await this.repository.update(
        id,
        validatedInput,
        this.organizationId
      );

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update rental plan',
      };
    }
  }

  /**
   * Activate or deactivate a rental plan
   */
  async setActive(id: string, isActive: boolean): Promise<Result<RentalPlan>> {
    try {
      // Check plan exists
      const existingPlan = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPlan) {
        return { success: false, error: 'Rental plan not found' };
      }

      // Business rule: Must have at least one active plan
      if (!isActive && existingPlan.is_active) {
        const activePlans = await this.repository.getActive(
          this.organizationId
        );

        if (activePlans.length === 1) {
          return {
            success: false,
            error:
              'Cannot deactivate the only active rental plan. Activate another plan first.',
          };
        }
      }

      // Set active status
      const plan = await this.repository.setActive(
        id,
        isActive,
        this.organizationId
      );

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update rental plan status',
      };
    }
  }

  /**
   * Delete a rental plan (soft delete)
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      // Check plan exists
      const existingPlan = await this.repository.getById(
        id,
        this.organizationId
      );
      if (!existingPlan) {
        return { success: false, error: 'Rental plan not found' };
      }

      // Business rule: Must have at least one active plan
      if (existingPlan.is_active) {
        const activePlans = await this.repository.getActive(
          this.organizationId
        );

        if (activePlans.length === 1) {
          return {
            success: false,
            error:
              'Cannot delete the only active rental plan. Create or activate another plan first.',
          };
        }
      }

      // Business rule: Warn if plan has assignment history
      // (We allow deletion - assignments keep snapshotted plan details)

      await this.repository.delete(id, this.organizationId);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete rental plan',
      };
    }
  }

  /**
   * Calculate total price for a plan
   * Helper method for UI to show pricing
   */
  calculateTotalPrice(plan: RentalPlan, quantity: number = 1): number {
    return plan.price * quantity;
  }

  /**
   * Get plan duration in days
   * Helper method to normalize different duration units
   */
  getPlanDurationInDays(plan: RentalPlan): number {
    switch (plan.duration_unit) {
      case 'days':
        return plan.duration_value;
      case 'weeks':
        return plan.duration_value * 7;
      case 'months':
        return plan.duration_value * 30; // Approximate
      default:
        return plan.duration_value;
    }
  }

  /**
   * Format plan duration as human-readable string
   */
  formatDuration(plan: RentalPlan): string {
    const value = plan.duration_value;
    const unit = plan.duration_unit;

    if (value === 1) {
      // Singular
      return `1 ${unit.slice(0, -1)}`; // "1 day", "1 week", "1 month"
    }

    // Plural
    return `${value} ${unit}`; // "7 days", "2 weeks", "3 months"
  }
}
