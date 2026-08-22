/**
 * CREATE INSPECTION FORM
 *
 * Records a condition check. The overall verdict and the resulting bike status are
 * required; per-component checks are optional, because an inspector who only looked
 * at the brakes should not have to invent values for the rest.
 *
 * Two server rules are mirrored in the UI so they are visible before submit rather
 * than only after: a 'damaged' verdict requires damage notes, and forces the
 * resulting status to maintenance or damaged. The server still enforces both — this
 * only saves a round trip.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createInspectionAction } from '@/app/actions/maintenance';
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
import { INSPECTION_CONDITION_LABELS } from '@/features/maintenance/labels';
import type {
  Bike,
  BikeStatus,
  InspectionCondition,
} from '@/lib/types/ebike';

const CONDITIONS = Object.entries(INSPECTION_CONDITION_LABELS) as [
  InspectionCondition,
  string,
][];

/** Statuses an inspection may set. 'assigned' is excluded — that is the
 *  assignment workflow's to set, not an inspector's. */
const NEXT_STATUSES: { value: BikeStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Needs maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

const COMPONENTS: { name: string; label: string }[] = [
  { name: 'brakes_condition', label: 'Brakes' },
  { name: 'tires_condition', label: 'Tires' },
  { name: 'lights_condition', label: 'Lights' },
  { name: 'frame_condition', label: 'Frame' },
  { name: 'battery_condition', label: 'Battery' },
];

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10';

interface CreateInspectionFormProps {
  /** Bikes available to inspect. Assigned bikes are rejected server-side. */
  bikes: Bike[];
}

export function CreateInspectionForm({ bikes }: CreateInspectionFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tracked so the damage-notes requirement can be surfaced as the inspector
  // changes the verdict, rather than after a failed submit.
  const [overallCondition, setOverallCondition] =
    useState<InspectionCondition>('good');

  const isDamaged = overallCondition === 'damaged';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const text = (field: string) => {
      const value = (formData.get(field) as string | null)?.trim();
      return value ? value : undefined;
    };

    // An empty <option> means "not checked", which the schema takes as null.
    const condition = (field: string) =>
      (text(field) as InspectionCondition | undefined) ?? null;

    const photoUrl = text('damage_photo');

    startTransition(async () => {
      const result = await createInspectionAction({
        bike_id: formData.get('bike_id') as string,
        overall_condition: formData.get(
          'overall_condition'
        ) as InspectionCondition,
        brakes_condition: condition('brakes_condition'),
        tires_condition: condition('tires_condition'),
        lights_condition: condition('lights_condition'),
        frame_condition: condition('frame_condition'),
        battery_condition: condition('battery_condition'),
        damage_notes: text('damage_notes'),
        damage_photos: photoUrl ? [photoUrl] : null,
        requires_maintenance: formData.get('requires_maintenance') === 'on',
        next_status: formData.get('next_status') as BikeStatus,
        notes: text('notes'),
      });

      if (result.success) {
        router.push(`/maintenance/inspections/${result.data.id}`);
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
            Add a bike before recording an inspection.
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
        <CardTitle>Inspection details</CardTitle>
        <CardDescription>Record the condition of a bike</CardDescription>
      </CardHeader>
      <CardContent>
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
            <select
              id="bike_id"
              name="bike_id"
              required
              defaultValue=""
              className={SELECT_CLASS}
            >
              <option value="" disabled>
                Select a bike
              </option>
              {bikes.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.bike_number} — {bike.model}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overall_condition">
              Overall condition <span className="text-destructive">*</span>
            </Label>
            <select
              id="overall_condition"
              name="overall_condition"
              required
              value={overallCondition}
              onChange={(event) =>
                setOverallCondition(event.target.value as InspectionCondition)
              }
              className={SELECT_CLASS}
            >
              {CONDITIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Per-component checks. Blank is a valid answer. */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">
              Components{' '}
              <span className="font-normal text-muted-foreground">
                (leave blank if not checked)
              </span>
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {COMPONENTS.map(({ name, label }) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name}>{label}</Label>
                  <select
                    id={name}
                    name={name}
                    defaultValue=""
                    className={SELECT_CLASS}
                  >
                    <option value="">Not checked</option>
                    {CONDITIONS.map(([value, conditionLabel]) => (
                      <option key={value} value={value}>
                        {conditionLabel}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="next_status">
              Resulting bike status <span className="text-destructive">*</span>
            </Label>
            <select
              id="next_status"
              name="next_status"
              required
              defaultValue="available"
              className={SELECT_CLASS}
            >
              {NEXT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {isDamaged
                ? 'A damaged bike must be set to needs maintenance or damaged.'
                : 'This inspection sets the bike’s status when saved.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="damage_notes">
              Damage notes
              {isDamaged && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="damage_notes"
              name="damage_notes"
              placeholder="What is damaged, and how badly?"
              rows={3}
              maxLength={1000}
              required={isDamaged}
            />
            {isDamaged && (
              <p className="text-xs text-muted-foreground">
                Required when the overall condition is damaged.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="damage_photo">Damage photo URL</Label>
            <Input
              id="damage_photo"
              name="damage_photo"
              type="url"
              placeholder="https://example.com/damage-photo.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Optional (file upload coming soon)
            </p>
          </div>

          {/* Native checkbox: no ui/checkbox primitive exists in this project. */}
          <div className="flex items-start gap-3">
            <input
              id="requires_maintenance"
              name="requires_maintenance"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <div className="space-y-1">
              <Label htmlFor="requires_maintenance">
                Flag for maintenance follow-up
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds this bike to the list of inspections needing work.
              </p>
            </div>
          </div>

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
              Save inspection
            </Button>
            <Button type="button" variant="outline" asChild disabled={isPending}>
              <Link href="/maintenance/inspections">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
