'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAssignmentAction } from '@/app/actions/assignments';
import { formatMoney } from '@/lib/utils/format';
import type { Bike, Courier, RentalPlan } from '@/lib/types/ebike';

interface CreateAssignmentFormProps {
  bikes: Bike[];
  couriers: Courier[];
  plans: RentalPlan[];
  /** Preselected from a "assign this bike" link on the bike page. */
  defaultBikeId?: string;
  /** Preselected from a "assign a bike" link on the courier page. */
  defaultCourierId?: string;
}

/**
 * Assign a bike to a courier under a rental plan.
 *
 * The rental plan's price and duration are snapshotted onto the assignment by the
 * database, so later edits to a plan do not rewrite past assignments.
 *
 * Condition is required: it is the baseline the return condition is compared
 * against, and there is no way to backfill it once the bike is out.
 */
export function CreateAssignmentForm({
  bikes,
  couriers,
  plans,
  defaultBikeId,
  defaultCourierId,
}: CreateAssignmentFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const condition = (
      formData.get('condition_at_assignment') as string
    )?.trim();
    const notes = (formData.get('assignment_notes') as string)?.trim();

    startTransition(async () => {
      const result = await createAssignmentAction({
        bike_id: formData.get('bike_id') as string,
        courier_id: formData.get('courier_id') as string,
        rental_plan_id: formData.get('rental_plan_id') as string,
        condition_at_assignment: condition,
        assignment_notes: notes ? notes : null,
      });

      if (result.success) {
        router.push(`/assignments/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="bike_id">
          Bike <span className="text-destructive">*</span>
        </Label>
        <Select
          id="bike_id"
          name="bike_id"
          required
          defaultValue={defaultBikeId ?? ''}
        >
          <option value="" disabled>
            Выберите велосипед
          </option>
          {bikes.map((bike) => (
            <option key={bike.id} value={bike.id}>
              {bike.bike_number} — {bike.model}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {bikes.length} available bike{bikes.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="courier_id">
          Courier <span className="text-destructive">*</span>
        </Label>
        <Select
          id="courier_id"
          name="courier_id"
          required
          defaultValue={defaultCourierId ?? ''}
        >
          <option value="" disabled>
            Выберите курьера
          </option>
          {couriers.map((courier) => (
            <option key={courier.id} value={courier.id}>
              {courier.courier_code} — {courier.full_name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {couriers.length} active courier{couriers.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rental_plan_id">
          Rental plan <span className="text-destructive">*</span>
        </Label>
        <Select id="rental_plan_id" name="rental_plan_id" required defaultValue="">
          <option value="" disabled>
            Select a rental plan
          </option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatMoney(plan.price)} ({plan.duration_value}{' '}
              {plan.duration_unit})
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {plans.length} active plan{plans.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="condition_at_assignment">
          Bike condition <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="condition_at_assignment"
          name="condition_at_assignment"
          placeholder="e.g. Good condition, all parts working, minor scuff on rear fender"
          required
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Recorded now so it can be compared against the condition on return.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignment_notes">Примечания</Label>
        <Textarea
          id="assignment_notes"
          name="assignment_notes"
          placeholder="Anything else worth recording about this assignment"
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          The bike becomes assigned, and this courier cannot take another bike
          until it is returned — one bike per courier.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Assign bike
        </Button>
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href="/assignments">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
