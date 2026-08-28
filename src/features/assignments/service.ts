import { SupabaseClient } from '@supabase/supabase-js';
import { BikeAssignmentsRepository } from './repository';
import { BikesRepository } from '../bikes/repository';
import { CouriersRepository } from '../couriers/repository';
import { RentalPlansRepository } from '../rental-plans/repository';
import { AuditService } from '@/features/audit/service';
import {
  createAssignmentSchema,
  returnAssignmentSchema,
  assignmentFiltersSchema,
} from './schemas';
import {
  durationInDays,
  expectedReturnDate,
  isOverdue as isAssignmentOverdue,
  daysOverdue,
} from './duration';
import type {
  BikeAssignment,
  CreateAssignmentInput,
  ReturnAssignmentInput,
  AssignmentFilters,
  Result,
} from '@/lib/types/ebike';

/**
 * AssignmentsService
 *
 * Business logic layer for bike assignment management.
 * Handles validation, business rules, and delegates to repository.
 */
export class AssignmentsService {
  private repository: BikeAssignmentsRepository;
  private bikesRepo: BikesRepository;
  private couriersRepo: CouriersRepository;
  private plansRepo: RentalPlansRepository;
  private auditService: AuditService;

  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {
    this.repository = new BikeAssignmentsRepository(supabase);
    this.bikesRepo = new BikesRepository(supabase);
    this.couriersRepo = new CouriersRepository(supabase);
    this.plansRepo = new RentalPlansRepository(supabase);
    this.auditService = new AuditService(supabase, organizationId);
  }

  /**
   * List assignments with optional filters
   */
  async list(filters?: AssignmentFilters): Promise<Result<BikeAssignment[]>> {
    try {
      // Validate filters if provided
      if (filters) {
        const validation = assignmentFiltersSchema.safeParse(filters);
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
          error instanceof Error ? error.message : 'Failed to list assignments',
      };
    }
  }

  /**
   * Get assignment by ID
   */
  async getById(id: string): Promise<Result<BikeAssignment>> {
    try {
      const assignment = await this.repository.getById(
        id,
        this.organizationId
      );

      if (!assignment) {
        return { success: false, error: 'Assignment not found' };
      }

      return { success: true, data: assignment };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get assignment',
      };
    }
  }

  /**
   * Create a new assignment (assign bike to courier)
   */
  async create(
    input: CreateAssignmentInput,
    userId: string
  ): Promise<Result<BikeAssignment>> {
    try {
      // Validate input
      const validation = createAssignmentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Business rule: Validate bike exists and is available
      const bike = await this.bikesRepo.getById(
        validatedInput.bike_id,
        this.organizationId
      );

      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      if (bike.status !== 'available') {
        return {
          success: false,
          error: `Bike is not available. Current status: ${bike.status}`,
        };
      }

      // Business rule: Validate courier exists and is active
      const courier = await this.couriersRepo.getById(
        validatedInput.courier_id,
        this.organizationId
      );

      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      if (courier.status !== 'active') {
        return {
          success: false,
          error: `Courier is not active. Current status: ${courier.status}`,
        };
      }

      // Business rule: Check courier doesn't have active assignment (max 1 bike)
      const hasActiveAssignment = await this.couriersRepo.hasActiveAssignment(
        validatedInput.courier_id,
        this.organizationId
      );

      if (hasActiveAssignment) {
        return {
          success: false,
          error:
            'Courier already has an active bike assignment. Maximum 1 bike per courier.',
        };
      }

      // Business rule: Validate rental plan exists and is active
      const plan = await this.plansRepo.getById(
        validatedInput.rental_plan_id,
        this.organizationId
      );

      if (!plan) {
        return { success: false, error: 'Rental plan not found' };
      }

      if (!plan.is_active) {
        return {
          success: false,
          error: 'Rental plan is not active. Please select an active plan.',
        };
      }

      // Create assignment
      // Note: Repository will snapshot the rental plan details
      const assignment = await this.repository.create(
        validatedInput,
        this.organizationId,
        userId
      );

      // Audit log
      await this.auditService.logAssignmentCreated(
        userId,
        assignment.id,
        {
          bike_number: bike.bike_number,
          courier_name: courier.full_name,
          plan_name: plan.name,
          plan_price: plan.price,
        }
      );

      return { success: true, data: assignment };
    } catch (error) {
      console.error('Assignment creation error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create assignment',
      };
    }
  }

  /**
   * Return a bike (close assignment)
   */
  async returnBike(
    input: ReturnAssignmentInput,
    userId: string
  ): Promise<Result<BikeAssignment>> {
    try {
      // Validate input
      const validation = returnAssignmentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        };
      }

      const validatedInput = validation.data;

      // Check assignment exists
      const existingAssignment = await this.repository.getById(
        validatedInput.assignment_id,
        this.organizationId
      );

      if (!existingAssignment) {
        return { success: false, error: 'Assignment not found' };
      }

      // Business rule: Assignment must be active (not already returned)
      if (existingAssignment.returned_at) {
        return {
          success: false,
          error: 'Assignment is already closed. Bike was returned on ' +
            new Date(existingAssignment.returned_at).toLocaleDateString(),
        };
      }

      // Return bike
      const assignment = await this.repository.returnBike(
        validatedInput,
        this.organizationId,
        userId
      );

      // Get bike and courier info for audit log
      const bike = await this.bikesRepo.getById(
        existingAssignment.bike_id,
        this.organizationId
      );
      const courier = await this.couriersRepo.getById(
        existingAssignment.courier_id,
        this.organizationId
      );

      // Audit log
      if (bike && courier) {
        await this.auditService.logAssignmentReturned(
          userId,
          assignment.id,
          {
            bike_number: bike.bike_number,
            courier_name: courier.full_name,
            condition_at_return: validatedInput.condition_at_return,
          }
        );
      }

      return { success: true, data: assignment };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to return bike',
      };
    }
  }

  /**
   * Get active assignment for a bike
   */
  async getActiveBikeAssignment(
    bikeId: string
  ): Promise<Result<BikeAssignment | null>> {
    try {
      const assignment = await this.repository.getActiveBikeAssignment(
        bikeId,
        this.organizationId
      );
      return { success: true, data: assignment };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get bike assignment',
      };
    }
  }

  /**
   * Get active assignment for a courier
   */
  async getActiveCourierAssignment(
    courierId: string
  ): Promise<Result<BikeAssignment | null>> {
    try {
      const assignment = await this.repository.getActiveCourierAssignment(
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
            : 'Failed to get courier assignment',
      };
    }
  }

  /**
   * Get all active assignments
   */
  async getActiveAssignments(): Promise<Result<BikeAssignment[]>> {
    try {
      const assignments = await this.repository.getActiveAssignments(
        this.organizationId
      );
      return { success: true, data: assignments };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get active assignments',
      };
    }
  }

  /**
   * Get bike assignment history
   */
  async getBikeHistory(bikeId: string): Promise<Result<BikeAssignment[]>> {
    try {
      // Validate bike exists
      const bike = await this.bikesRepo.getById(bikeId, this.organizationId);
      if (!bike) {
        return { success: false, error: 'Bike not found' };
      }

      const history = await this.repository.getBikeHistory(
        bikeId,
        this.organizationId
      );
      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get bike history',
      };
    }
  }

  /**
   * Get courier assignment history
   */
  async getCourierHistory(
    courierId: string
  ): Promise<Result<BikeAssignment[]>> {
    try {
      // Validate courier exists
      const courier = await this.couriersRepo.getById(
        courierId,
        this.organizationId
      );
      if (!courier) {
        return { success: false, error: 'Courier not found' };
      }

      const history = await this.repository.getCourierHistory(
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
            : 'Failed to get courier history',
      };
    }
  }

  /**
   * Get assignments within a date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Result<BikeAssignment[]>> {
    try {
      // Business rule: Validate date range
      if (startDate > endDate) {
        return {
          success: false,
          error: 'Start date must be before end date',
        };
      }

      const assignments = await this.repository.getByDateRange(
        // The repository filters on date columns, which expect yyyy-mm-dd.
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
        this.organizationId
      );
      return { success: true, data: assignments };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get assignments by date range',
      };
    }
  }

  /**
   * Calculate total revenue for a date range
   */
  async getTotalRevenue(
    startDate: Date,
    endDate: Date
  ): Promise<Result<number>> {
    try {
      // Business rule: Validate date range
      if (startDate > endDate) {
        return {
          success: false,
          error: 'Start date must be before end date',
        };
      }

      const revenue = await this.repository.getTotalRevenue(
        // The repository filters on date columns, which expect yyyy-mm-dd.
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
        this.organizationId
      );
      return { success: true, data: revenue };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to calculate revenue',
      };
    }
  }

  /**
   * Get overdue assignments (not returned after expected duration)
   */
  async getOverdue(daysOverdue: number = 0): Promise<Result<BikeAssignment[]>> {
    try {
      const assignments = await this.repository.getOverdue(
        daysOverdue,
        this.organizationId
      );
      return { success: true, data: assignments };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get overdue assignments',
      };
    }
  }

  /**
   * Calculate assignment duration in days
   */
  calculateDurationInDays(assignment: BikeAssignment): number {
    return durationInDays(assignment);
  }

  /**
   * Calculate expected return date
   */
  calculateExpectedReturnDate(assignment: BikeAssignment): Date {
    return expectedReturnDate(assignment);
  }

  /**
   * Check if assignment is overdue
   */
  isOverdue(assignment: BikeAssignment): boolean {
    return isAssignmentOverdue(assignment);
  }

  /**
   * Calculate days overdue
   */
  getDaysOverdue(assignment: BikeAssignment): number {
    return daysOverdue(assignment);
  }
}
