/**
 * INSPECTION DETAIL
 *
 * One condition check in full: the overall verdict, then each component.
 *
 * Per-component conditions are nullable — an inspector who only checked the brakes
 * records just that — so unchecked components are shown as "not checked" rather
 * than omitted. Their absence is itself information.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertCircle, Wrench, Calendar } from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { getInspectionAction } from '@/app/actions/maintenance';
import { getBikeAction } from '@/app/actions/bikes';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDate } from '@/lib/utils/format';
import {
  INSPECTION_CONDITION_LABELS,
  INSPECTION_CONDITION_VARIANT,
} from '@/features/maintenance/labels';
import type { BikeInspection } from '@/lib/types/ebike';

export const metadata = {
  title: 'Inspection',
  description: 'View a bike inspection',
};

interface InspectionDetailPageProps {
  params: Promise<{ id: string }>;
}

/** The per-component checks, in the order an inspector walks the bike. */
const COMPONENTS: { key: keyof BikeInspection; label: string }[] = [
  { key: 'brakes_condition', label: 'Brakes' },
  { key: 'tires_condition', label: 'Tires' },
  { key: 'lights_condition', label: 'Lights' },
  { key: 'frame_condition', label: 'Frame' },
  { key: 'battery_condition', label: 'Battery' },
];

export default async function InspectionDetailPage({
  params,
}: InspectionDetailPageProps) {
  const [{ id }] = await Promise.all([params, requireActiveUser()]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance/inspections" aria-label="Back to inspections">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inspection</h1>
          <p className="text-muted-foreground">Recorded bike condition</p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <InspectionDetailContent id={id} />
      </Suspense>
    </div>
  );
}

async function InspectionDetailContent({ id }: { id: string }) {
  const result = await getInspectionAction(id);

  if (!result.success) {
    notFound();
  }

  const inspection = result.data;

  const bikeResult = await getBikeAction(inspection.bike_id);
  const bike = bikeResult.success ? bikeResult.data : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Overall condition</CardTitle>
              <CardDescription>
                Inspected {formatDate(inspection.inspected_at)}
              </CardDescription>
            </div>
            <Badge
              variant={INSPECTION_CONDITION_VARIANT[inspection.overall_condition]}
            >
              {INSPECTION_CONDITION_LABELS[inspection.overall_condition]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {inspection.requires_maintenance && (
            <Alert>
              <Wrench className="h-4 w-4" />
              <AlertTitle>Maintenance required</AlertTitle>
              <AlertDescription>
                This inspection flagged work that still needs doing.{' '}
                <Link href="/maintenance/new" className="font-medium underline">
                  Log a maintenance record
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Inspected</p>
                <p className="text-base font-medium">
                  {formatDate(inspection.inspected_at)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Status set by this inspection
                </p>
                <p className="text-base font-medium capitalize">
                  {inspection.next_status}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bike</CardTitle>
          <CardDescription>The bike that was inspected</CardDescription>
        </CardHeader>
        <CardContent>
          {bike ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Bike number</p>
                <Link
                  href={`/bikes/${bike.id}`}
                  className="text-base font-medium underline-offset-4 hover:underline"
                >
                  {bike.bike_number}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="text-base font-medium">{bike.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current status</p>
                <Badge variant="outline" className="capitalize">
                  {bike.status}
                </Badge>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Bike unavailable</AlertTitle>
              <AlertDescription>
                {bikeResult.success ? '' : bikeResult.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>Condition of each part checked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPONENTS.map(({ key, label }) => {
              const condition = inspection[key] as
                | BikeInspection['overall_condition']
                | null;

              return (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  {condition ? (
                    <Badge variant={INSPECTION_CONDITION_VARIANT[condition]}>
                      {INSPECTION_CONDITION_LABELS[condition]}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Not checked
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {(inspection.damage_notes || inspection.notes) && <Separator />}

          {inspection.damage_notes && (
            <div>
              <p className="mb-2 text-sm font-medium">Damage notes</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {inspection.damage_notes}
              </p>
            </div>
          )}

          {inspection.notes && (
            <div>
              <p className="mb-2 text-sm font-medium">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {inspection.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {inspection.damage_photos && inspection.damage_photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Damage photos</CardTitle>
            <CardDescription>
              {inspection.damage_photos.length === 1
                ? '1 photo attached'
                : `${inspection.damage_photos.length} photos attached`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Plain <img>: arbitrary external URLs, which next/image would need
                configured remote patterns for. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {inspection.damage_photos.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border"
                >
                  <img
                    src={url}
                    alt="Damage photo"
                    className="h-48 w-full bg-muted object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
