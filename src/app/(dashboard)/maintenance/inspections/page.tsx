/**
 * INSPECTIONS LIST
 *
 * Проверки состояния по всему парку, newest first, with follow-ups called out.
 *
 * An inspection sets the bike's next status, so the ones flagged
 * requires_maintenance are the actionable half of this page — they are counted
 * separately and badged in the list rather than left for the reader to spot.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, ClipboardCheck, AlertCircle, Wrench } from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { listInspectionsAction } from '@/app/actions/maintenance';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDate } from '@/lib/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  INSPECTION_CONDITION_LABELS,
  INSPECTION_CONDITION_VARIANT,
} from '@/features/maintenance/labels';

export const metadata = {
  title: 'Инспекции',
  description: 'Инспекции состояния велосипедов',
};

export default async function InspectionsPage() {
  await requireActiveUser();

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/maintenance" aria-label="Назад к обслуживанию">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Инспекции</h1>
            <p className="text-muted-foreground">
              Проверки состояния по всему парку
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/maintenance/inspections/new">
            <Plus className="h-4 w-4" />
            Новая инспекция
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <InspectionsContent />
      </Suspense>
    </div>
  );
}

async function InspectionsContent() {
  const result = await listInspectionsAction();

  if (!result.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить инспекции</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const inspections = result.data;
  const needingMaintenance = inspections.filter(
    (inspection) => inspection.requires_maintenance
  ).length;

  if (inspections.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="h-10 w-10" />}
        title="Инспекций пока нет"
        description="Запишите проверку состояния, чтобы начать отслеживать состояние парка."
        action={
          <Button asChild>
            <Link href="/maintenance/inspections/new">
              <Plus className="h-4 w-4" />
              Новая инспекция
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total inspections
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inspections.length}</div>
            <p className="text-xs text-muted-foreground">All condition checks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Needing maintenance
            </CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{needingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              Flagged for follow-up work
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {inspections.map((inspection) => (
          <Link
            key={inspection.id}
            href={`/maintenance/inspections/${inspection.id}`}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {INSPECTION_CONDITION_LABELS[inspection.overall_condition]}{' '}
                      condition
                    </CardTitle>
                    <CardDescription>
                      {formatDate(inspection.inspected_at)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {inspection.requires_maintenance && (
                      <Badge variant="destructive">Needs maintenance</Badge>
                    )}
                    <Badge
                      variant={
                        INSPECTION_CONDITION_VARIANT[inspection.overall_condition]
                      }
                    >
                      {INSPECTION_CONDITION_LABELS[inspection.overall_condition]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Resulting status
                    </p>
                    <p className="text-base font-medium capitalize">
                      {inspection.next_status}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Damage noted</p>
                    <p className="text-base font-medium">
                      {inspection.damage_notes ? 'Yes' : 'None'}
                    </p>
                  </div>
                </div>
                {inspection.damage_notes && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {inspection.damage_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
