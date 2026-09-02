/**
 * CREATE MAINTENANCE FORM
 *
 * Records work done on a bike. Uncontrolled inputs read through FormData on
 * submit, matching the bike and courier forms — there is no client-side field
 * validation to drive, since the Zod schema on the server is the authority.
 *
 * Field order follows what a mechanic who has just finished a job already knows:
 * which bike, what kind of work, what they did. Cost and parts come after,
 * because they are looked up rather than remembered.
 *
 * Photos are a required URL for now, the same interim treatment the bike form
 * uses, and become a file picker when the upload component lands.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createMaintenanceRecordAction } from '@/app/actions/maintenance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Bike, MaintenanceType } from '@/lib/types/ebike';

/**
 * Labels for the maintenance_type enum. 'repair' is called out as needing sign-off
 * because that is the one choice on this form with a consequence the mechanic
 * cannot undo themselves.
 */
const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'replacement', label: 'Part replacement' },
  { value: 'repair', label: 'Repair (needs manager approval)' },
  { value: 'other', label: 'Other' },
];

interface CreateMaintenanceFormProps {
  /** Bikes available for maintenance. Assigned bikes are rejected server-side. */
  bikes: Bike[];
}

export function CreateMaintenanceForm({ bikes }: CreateMaintenanceFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const text = (field: string) => {
      const value = (formData.get(field) as string | null)?.trim();
      return value ? value : undefined;
    };

    const rawCost = text('cost');
    const cost = rawCost === undefined ? undefined : Number(rawCost);

    if (cost !== undefined && Number.isNaN(cost)) {
      setError('Cost must be a number.');
      return;
    }

    const photoUrl = text('image_url');

    startTransition(async () => {
      const result = await createMaintenanceRecordAction({
        bike_id: formData.get('bike_id') as string,
        maintenance_type: formData.get('maintenance_type') as MaintenanceType,
        description: (formData.get('description') as string)?.trim() ?? '',
        cost,
        parts_replaced: text('parts_replaced'),
        // The schema requires at least one photo; the input is required, so this
        // is only ever empty if the browser let a blank submit through.
        image_urls: photoUrl ? [photoUrl] : [],
        notes: text('notes'),
      });

      if (result.success) {
        router.push(`/maintenance/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  if (bikes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No bikes available</CardTitle>
          <CardDescription>
            Add a bike before recording maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/bikes/new">Add a bike</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance details</CardTitle>
        <CardDescription>Record work performed on a bike</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Bike — native select, like the other e-bike forms: on a phone this
              opens the OS picker instead of a custom listbox. */}
          <div className="space-y-2">
            <Label htmlFor="bike_id">
              Bike <span className="text-destructive">*</span>
            </Label>
            <select
              id="bike_id"
              name="bike_id"
              required
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
            >
              <option value="" disabled>
                Выберите велосипед
              </option>
              {bikes.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.bike_number} — {bike.model}
                </option>
              ))}
            </select>
          </div>

          {/* Maintenance type */}
          <div className="space-y-2">
            <Label htmlFor="maintenance_type">
              Type <span className="text-destructive">*</span>
            </Label>
            <select
              id="maintenance_type"
              name="maintenance_type"
              required
              defaultValue="inspection"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
            >
              {MAINTENANCE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Repairs are held for manager approval before they count toward
              maintenance cost.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What work was performed?"
              rows={3}
              maxLength={1000}
              required
            />
          </div>

          {/* Photo — interim URL field, as on the bike form. */}
          <div className="space-y-2">
            <Label htmlFor="image_url">
              Photo URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              placeholder="https://example.com/repair-photo.jpg"
              required
            />
            <p className="text-xs text-muted-foreground">
              Photo of the work performed (file upload coming soon)
            </p>
          </div>

          {/* Cost */}
          <div className="space-y-2">
            <Label htmlFor="cost">Cost</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>

          {/* Parts replaced */}
          <div className="space-y-2">
            <Label htmlFor="parts_replaced">Parts replaced</Label>
            <Textarea
              id="parts_replaced"
              name="parts_replaced"
              placeholder="e.g., Rear brake pads, chain"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Anything else worth recording"
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create record
            </Button>
            <Button type="button" variant="outline" asChild disabled={isPending}>
              <Link href="/maintenance">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
