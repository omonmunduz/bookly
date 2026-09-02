'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createEarningsPeriodAction } from '@/app/actions/earnings';
import type { Courier } from '@/lib/types/ebike';

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10';

interface CreateEarningsPeriodFormProps {
  couriers: Courier[];
}

/**
 * Create an earnings period for a courier.
 *
 * The period starts with zero income entries. Income is added incrementally
 * after creation using the "Add Income" action on the edit page.
 *
 * Dates cannot be edited after creation (the update schema omits them), so the
 * range is validated before submit rather than left to be corrected later.
 */
export function CreateEarningsPeriodForm({
  couriers,
}: CreateEarningsPeriodFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const periodStart = formData.get('period_start') as string;
    const periodEnd = formData.get('period_end') as string;
    const notes = (formData.get('notes') as string)?.trim();

    if (new Date(periodEnd) < new Date(periodStart)) {
      setError('Конечная дата должна быть позже начальной.');
      return;
    }

    startTransition(async () => {
      const result = await createEarningsPeriodAction({
        courier_id: formData.get('courier_id') as string,
        period_start: periodStart,
        period_end: periodEnd,
        notes: notes ? notes : undefined,
      });

      if (result.success) {
        router.push(`/earnings/${result.data.id}/edit`);
      } else {
        setError(result.error);
      }
    });
  };

  if (couriers.length === 0) {
    return (
      <Alert>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>Add a courier before creating an earnings period.</span>
          <Button asChild size="sm">
            <Link href="/couriers/new">Добавить курьера</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="courier_id">
          Courier <span className="text-destructive">*</span>
        </Label>
        <select
          id="courier_id"
          name="courier_id"
          required
          defaultValue=""
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Select a courier
          </option>
          {couriers.map((courier) => (
            <option key={courier.id} value={courier.id}>
              {courier.full_name} ({courier.courier_code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="period_start">
            Period start <span className="text-destructive">*</span>
          </Label>
          <Input id="period_start" name="period_start" type="date" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="period_end">
            Period end <span className="text-destructive">*</span>
          </Label>
          <Input id="period_end" name="period_end" type="date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Anything worth recording about this period"
          rows={3}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          After creating the period, add income entries and deductions on the edit page.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create period
        </Button>
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href="/earnings">Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
