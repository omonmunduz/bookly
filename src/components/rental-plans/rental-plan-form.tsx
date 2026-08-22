'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  createRentalPlanAction,
  updateRentalPlanAction,
} from '@/app/actions/rental-plans';
import type { DurationUnit, RentalPlan } from '@/lib/types/ebike';

const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

interface RentalPlanFormProps {
  /** Omit to create a new plan; pass a plan to edit it. */
  plan?: RentalPlan;
}

/**
 * Create or edit a rental plan.
 *
 * Duration is a value plus a unit (7 days, 1 month) rather than a raw day count,
 * because that is what the assignment snapshot records and what couriers are
 * quoted. There is no deposit field — the schema has no such concept.
 *
 * Editing a plan is safe: assignments snapshot the price and duration they were
 * created with, so changing a plan never rewrites past assignments.
 */
export function RentalPlanForm({ plan }: RentalPlanFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();
    const durationUnit = formData.get('duration_unit') as DurationUnit;
    const isActive = formData.get('is_active') === 'on';

    const durationValue = Number(
      (formData.get('duration_value') as string)?.trim()
    );
    if (!Number.isInteger(durationValue) || durationValue < 1) {
      setError('Enter a whole duration of one or more.');
      return;
    }

    const price = Number((formData.get('price') as string)?.trim());
    if (Number.isNaN(price) || price < 0) {
      setError('Enter a price of zero or more.');
      return;
    }

    startTransition(async () => {
      const input = {
        name,
        duration_value: durationValue,
        duration_unit: durationUnit,
        price,
        description: description ? description : null,
        is_active: isActive,
      };

      const result = plan
        ? await updateRentalPlanAction(plan.id, input)
        : await createRentalPlanAction(input);

      if (result.success) {
        router.push('/rental-plans');
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
        <Label htmlFor="name">
          Plan name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={plan?.name}
          required
          minLength={2}
          maxLength={100}
          placeholder="e.g. Weekly Standard"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={plan?.description ?? ''}
          placeholder="What this plan includes, terms, or special conditions"
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration_value">
            Duration <span className="text-destructive">*</span>
          </Label>
          <Input
            id="duration_value"
            name="duration_value"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            defaultValue={plan?.duration_value ?? 7}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration_unit">
            Unit <span className="text-destructive">*</span>
          </Label>
          <Select
            id="duration_unit"
            name="duration_unit"
            required
            defaultValue={plan?.duration_unit ?? 'days'}
          >
            {DURATION_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">
          Price <span className="text-destructive">*</span>
        </Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          defaultValue={plan?.price}
          required
          placeholder="0.00"
        />
        <p className="text-xs text-muted-foreground">
          Charged for the full duration. Early returns are not prorated.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border p-4">
        <Checkbox
          id="is_active"
          name="is_active"
          defaultChecked={plan?.is_active ?? true}
        />
        <div className="space-y-1 leading-none">
          <Label htmlFor="is_active">Active plan</Label>
          <p className="text-sm text-muted-foreground">
            Active plans can be picked for new assignments. Inactive plans are
            hidden, and existing assignments are unaffected.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href="/rental-plans">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {plan ? 'Save changes' : 'Create plan'}
        </Button>
      </div>
    </form>
  );
}
