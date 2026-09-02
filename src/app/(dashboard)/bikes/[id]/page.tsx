/**
 * Bike Detail Page
 *
 * Shows complete bike information including:
 * - Basic details (model, status, battery)
 * - Current assignment (if any)
 * - Assignment history
 * - Maintenance records
 * - Actions (edit, change status, assign)
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Edit, Wrench, History, Battery, MapPin } from 'lucide-react';

import { requireServerUser } from '@/lib/supabase/session';
import {
  getBikeAction,
  getAvailableBikesAction,
} from '@/app/actions/bikes';
import {
  getActiveBikeAssignmentAction,
  getBikeAssignmentHistoryAction,
} from '@/app/actions/assignments';
import {
  listMaintenanceRecordsAction,
  getTotalMaintenanceCostAction,
} from '@/app/actions/maintenance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/utils/format';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BikeDetailPage({ params }: PageProps) {
  const [{ id }, { role }] = await Promise.all([params, requireServerUser()]);
  const bikeResult = await getBikeAction(id);

  if (!bikeResult.success || !bikeResult.data) {
    notFound();
  }

  const bike = bikeResult.data;

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/bikes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {bike.bike_number}
            </h1>
            <p className="text-sm text-muted-foreground">{bike.model}</p>
          </div>
        </div>

        {(role === 'admin' || role === 'manager') && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/bikes/${bike.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Link>
            </Button>
            {bike.status === 'available' && (
              <Button asChild>
                <Link href={`/assignments/new?bikeId=${bike.id}`}>
                  Назначить велосипед
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Информация о велосипеде</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Статус
                  </dt>
                  <dd className="mt-1">
                    <BikeStatusBadge status={bike.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Батарея
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <Battery className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {bike.battery_info || 'Не указано'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Серийный номер
                  </dt>
                  <dd className="mt-1 font-medium">
                    {bike.serial_number || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Model
                  </dt>
                  <dd className="mt-1 font-medium">{bike.model}</dd>
                </div>
              </div>

              {bike.condition_notes && (
                <>
                  <Separator />
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Примечания о состоянии
                    </dt>
                    <dd className="mt-1 text-sm">{bike.condition_notes}</dd>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Текущее назначение */}
          <Suspense fallback={<CardSkeleton />}>
            <CurrentAssignment bikeId={bike.id} />
          </Suspense>

          {/* История назначений */}
          <Suspense fallback={<CardSkeleton />}>
            <AssignmentHistory bikeId={bike.id} />
          </Suspense>
        </div>

        {/* Right column: Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Suspense fallback={<StatsSkeleton />}>
                <BikeStats bikeId={bike.id} />
              </Suspense>
            </CardContent>
          </Card>

          {/* Maintenance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Maintenance</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/maintenance?bikeId=${bike.id}`}>
                    <History className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
                <MaintenanceOverview bikeId={bike.id} />
              </Suspense>
            </CardContent>
          </Card>

          {/* Actions */}
          {(role === 'admin' || role === 'manager') && bike.status !== 'retired' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/maintenance/new?bikeId=${bike.id}`}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Add Maintenance
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/inspections/new?bikeId=${bike.id}`}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Record Inspection
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

async function CurrentAssignment({ bikeId }: { bikeId: string }) {
  const result = await getActiveBikeAssignmentAction(bikeId);

  if (!result.success || !result.data) {
    return null;
  }

  const assignment = result.data;
  const assignedDate = new Date(assignment.assigned_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Текущее назначение</CardTitle>
        <CardDescription>
          Assigned on {assignedDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Courier</dt>
          <dd className="mt-1">
            <Link
              href={`/couriers/${assignment.courier_id}`}
              className="font-medium hover:underline"
            >
              Courier {assignment.courier_id.slice(0, 8)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Rental Plan</dt>
          <dd className="mt-1 font-medium">
            {assignment.plan_name} - {formatMoney(assignment.plan_price)}
          </dd>
        </div>
        {assignment.assignment_notes && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
            <dd className="mt-1 text-sm">{assignment.assignment_notes}</dd>
          </div>
        )}
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href={`/assignments/${assignment.id}`}>Просмотреть</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function AssignmentHistory({ bikeId }: { bikeId: string }) {
  const result = await getBikeAssignmentHistoryAction(bikeId);

  if (!result.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История назначений</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const history = result.data.filter((a) => a.returned_at !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>История назначений</CardTitle>
        <CardDescription>
          {history.length} {history.length === 1 ? 'assignment' : 'assignments'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignment history yet.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">
                    {new Date(assignment.assigned_at).toLocaleDateString()} -{' '}
                    {assignment.returned_at
                      ? new Date(assignment.returned_at).toLocaleDateString()
                      : 'Current'}
                  </p>
                  <p className="text-muted-foreground">
                    {assignment.plan_name}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/assignments/${assignment.id}`}>View</Link>
                </Button>
              </div>
            ))}
            {history.length > 5 && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/assignments?bikeId=${bikeId}`}>
                  View All ({history.length})
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function BikeStats({ bikeId }: { bikeId: string }) {
  const [historyResult, maintenanceCostResult] = await Promise.all([
    getBikeAssignmentHistoryAction(bikeId),
    getTotalMaintenanceCostAction(bikeId),
  ]);

  const totalAssignments = historyResult.success ? historyResult.data.length : 0;
  const totalRevenue = historyResult.success
    ? historyResult.data.reduce((sum, a) => sum + a.plan_price, 0)
    : 0;
  const totalMaintenanceCost = maintenanceCostResult.success
    ? maintenanceCostResult.data
    : 0;

  return (
    <>
      <div>
        <dt className="text-sm text-muted-foreground">Total Assignments</dt>
        <dd className="mt-1 text-2xl font-semibold">{totalAssignments}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Total Revenue</dt>
        <dd className="mt-1 text-2xl font-semibold">{formatMoney(totalRevenue)}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Maintenance Cost</dt>
        <dd className="mt-1 text-2xl font-semibold">{formatMoney(totalMaintenanceCost)}</dd>
      </div>
    </>
  );
}

async function MaintenanceOverview({ bikeId }: { bikeId: string }) {
  const result = await listMaintenanceRecordsAction(bikeId);

  if (!result.success) {
    return <p className="text-sm text-muted-foreground">{result.error}</p>;
  }

  const records = result.data;

  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет записей обслуживания yet.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-medium">{records.length}</span> maintenance{' '}
        {records.length === 1 ? 'record' : 'records'}
      </p>
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href={`/maintenance?bikeId=${bikeId}`}>View All</Link>
      </Button>
    </div>
  );
}

function BikeStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    available: 'default',
    assigned: 'secondary',
    maintenance: 'outline',
    damaged: 'destructive',
    retired: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'outline'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-6 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
