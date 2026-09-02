/**
 * Courier Detail Page
 *
 * Shows complete courier information including:
 * - Basic details (name, phone, email, status)
 * - Current assignment (if any)
 * - Assignment history
 * - Total assignments and revenue
 * - Actions (edit, change status, assign bike)
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Edit, Phone, IdCard, History } from 'lucide-react';

import { requireServerUser } from '@/lib/supabase/session';
import { getCourierAction } from '@/app/actions/couriers';
import {
  getCourierCurrentAssignmentAction,
  getCourierAssignmentHistoryAction,
} from '@/app/actions/couriers';
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

export default async function CourierDetailPage({ params }: PageProps) {
  const [{ id }, { role }] = await Promise.all([params, requireServerUser()]);
  const courierResult = await getCourierAction(id);

  if (!courierResult.success || !courierResult.data) {
    notFound();
  }

  const courier = courierResult.data;

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/couriers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {courier.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">{courier.courier_code}</p>
          </div>
        </div>

        {(role === 'admin' || role === 'manager') && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/couriers/${courier.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Link>
            </Button>
            <Suspense fallback={null}>
              <AssignBikeButton courierId={courier.id} />
            </Suspense>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Информация о курьере</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Статус
                  </dt>
                  <dd className="mt-1">
                    <CourierStatusBadge status={courier.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Phone
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`tel:${courier.phone}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {courier.phone}
                    </a>
                  </dd>
                </div>
                {courier.identification_number && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Identification number
                    </dt>
                    <dd className="mt-1 flex items-center gap-2 font-medium">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      {courier.identification_number}
                    </dd>
                  </div>
                )}
                {courier.emergency_contact && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Emergency contact
                    </dt>
                    <dd className="mt-1 font-medium">
                      {courier.emergency_contact}
                    </dd>
                  </div>
                )}
                {courier.address && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Address
                    </dt>
                    <dd className="mt-1 font-medium">{courier.address}</dd>
                  </div>
                )}
              </div>

              {courier.notes && (
                <>
                  <Separator />
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Notes
                    </dt>
                    <dd className="mt-1 text-sm">{courier.notes}</dd>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Текущее назначение */}
          <Suspense fallback={<CardSkeleton />}>
            <CurrentAssignment courierId={courier.id} />
          </Suspense>

          {/* История назначений */}
          <Suspense fallback={<CardSkeleton />}>
            <AssignmentHistory courierId={courier.id} />
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
                <CourierStats courierId={courier.id} />
              </Suspense>
            </CardContent>
          </Card>

          {/* Actions */}
          {(role === 'admin' || role === 'manager') && courier.status !== 'suspended' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/assignments?courierId=${courier.id}`}>
                    <History className="mr-2 h-4 w-4" />
                    View All Assignments
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

async function AssignBikeButton({ courierId }: { courierId: string }) {
  const currentAssignmentResult = await getCourierCurrentAssignmentAction(courierId);
  const hasCurrentAssignment = currentAssignmentResult.success && currentAssignmentResult.data !== null;

  if (hasCurrentAssignment) {
    return null; // Don't show assign button if courier already has a bike
  }

  return (
    <Button asChild>
      <Link href={`/assignments/new?courierId=${courierId}`}>
        Назначить велосипед
      </Link>
    </Button>
  );
}

async function CurrentAssignment({ courierId }: { courierId: string }) {
  const result = await getCourierCurrentAssignmentAction(courierId);

  if (!result.success || !result.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Текущее назначение</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active bike assignment.</p>
        </CardContent>
      </Card>
    );
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
          <dt className="text-sm font-medium text-muted-foreground">Bike</dt>
          <dd className="mt-1">
            <Link
              href={`/bikes/${assignment.bike_id}`}
              className="font-medium hover:underline"
            >
              Bike {assignment.bike_id.slice(0, 8)}
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

async function AssignmentHistory({ courierId }: { courierId: string }) {
  const result = await getCourierAssignmentHistoryAction(courierId);

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
          {history.length} completed {history.length === 1 ? 'assignment' : 'assignments'}
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
                    {assignment.plan_name} - {formatMoney(assignment.plan_price)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/assignments/${assignment.id}`}>View</Link>
                </Button>
              </div>
            ))}
            {history.length > 5 && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/assignments?courierId=${courierId}`}>
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

async function CourierStats({ courierId }: { courierId: string }) {
  const historyResult = await getCourierAssignmentHistoryAction(courierId);

  const totalAssignments = historyResult.success ? historyResult.data.length : 0;
  const totalRevenue = historyResult.success
    ? historyResult.data.reduce((sum, a) => sum + a.plan_price, 0)
    : 0;
  const activeAssignments = historyResult.success
    ? historyResult.data.filter((a) => !a.returned_at).length
    : 0;

  return (
    <>
      <div>
        <dt className="text-sm text-muted-foreground">Total Assignments</dt>
        <dd className="mt-1 text-2xl font-semibold">{totalAssignments}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Активные назначения</dt>
        <dd className="mt-1 text-2xl font-semibold">{activeAssignments}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Total Revenue</dt>
        <dd className="mt-1 text-2xl font-semibold">{formatMoney(totalRevenue)}</dd>
      </div>
    </>
  );
}

function CourierStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    inactive: 'secondary',
    suspended: 'destructive',
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
