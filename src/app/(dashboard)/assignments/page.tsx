/**
 * Assignments List Page
 *
 * Every bike rental, past and present. The "Overdue" filter is computed here
 * rather than queried, because an assignment's due date is derived from the plan
 * snapshot it carries rather than stored as a column.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import { listAssignmentsAction } from '@/app/actions/assignments';
import { listBikesAction } from '@/app/actions/bikes';
import { listCouriersAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMoney } from '@/lib/utils/format';
import {
  isOverdue,
  daysOverdue,
  formatPlanDuration,
} from '@/features/assignments/duration';
import type { AssignmentFilters } from '@/lib/types/ebike';

export const metadata = {
  title: 'Assignments',
  description: 'Manage bike assignments',
};

interface PageProps {
  searchParams: Promise<{
    active?: string;
    bikeId?: string;
    courierId?: string;
    overdue?: string;
  }>;
}

export default async function AssignmentsPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireActiveUser()]);

  // 'active' is tri-state: absent means "all", so it stays undefined unless the
  // parameter is actually present.
  const filters: AssignmentFilters = {
    active: params.active === undefined ? undefined : params.active === 'true',
    bikeId: params.bikeId,
    courierId: params.courierId,
  };

  const showOverdue = params.overdue === 'true';

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Track bike rentals and returns
          </p>
        </div>
        <Button asChild>
          <Link href="/assignments/new">
            <Plus className="h-4 w-4" />
            Assign bike
          </Link>
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <StatusFilter currentFilter={params.active} showOverdue={showOverdue} />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <AssignmentsTable filters={filters} showOverdue={showOverdue} />
      </Suspense>
    </div>
  );
}

function StatusFilter({
  currentFilter,
  showOverdue,
}: {
  currentFilter?: string;
  showOverdue: boolean;
}) {
  const filters = [
    { value: '', label: 'All', href: '/assignments' },
    { value: 'true', label: 'Active', href: '/assignments?active=true' },
    { value: 'false', label: 'Returned', href: '/assignments?active=false' },
    { value: 'overdue', label: 'Overdue', href: '/assignments?overdue=true' },
  ];

  const currentValue = showOverdue ? 'overdue' : currentFilter || '';

  return (
    <div className="flex gap-2 overflow-x-auto">
      {filters.map((filter) => (
        <Link
          key={filter.value}
          href={filter.href}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            currentValue === filter.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {filter.label}
        </Link>
      ))}
    </div>
  );
}

async function AssignmentsTable({
  filters,
  showOverdue,
}: {
  filters: AssignmentFilters;
  showOverdue: boolean;
}) {
  // Bikes and couriers come along because the assignments query returns raw IDs
  // with no join, and a table of truncated UUIDs is unreadable.
  const [assignmentsResult, bikesResult, couriersResult] = await Promise.all([
    // The overdue view needs every open assignment to filter over, so it asks
    // for actives rather than whatever the URL said.
    listAssignmentsAction(showOverdue ? { active: true } : filters),
    listBikesAction(),
    listCouriersAction(),
  ]);

  if (!assignmentsResult.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {assignmentsResult.error}
        </p>
      </div>
    );
  }

  const bikeLabels = new Map(
    (bikesResult.success ? bikesResult.data : []).map((bike) => [
      bike.id,
      { primary: bike.bike_number, secondary: bike.model },
    ])
  );
  const courierLabels = new Map(
    (couriersResult.success ? couriersResult.data : []).map((courier) => [
      courier.id,
      { primary: courier.full_name, secondary: courier.courier_code },
    ])
  );

  const assignments = showOverdue
    ? assignmentsResult.data.filter((assignment) => isOverdue(assignment))
    : assignmentsResult.data;

  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {showOverdue
            ? 'No overdue assignments.'
            : filters.active
              ? 'No active assignments.'
              : 'No assignments yet. Assign a bike to get started.'}
        </p>
        {!filters.active && !showOverdue && (
          <Button asChild className="mt-4">
            <Link href="/assignments/new">
              <Plus className="h-4 w-4" />
              Assign bike
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {assignments.length}{' '}
            {assignments.length === 1
              ? 'assignment is'
              : 'assignments are'}{' '}
            overdue for return.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bike</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => {
              const bike = bikeLabels.get(assignment.bike_id);
              const courier = courierLabels.get(assignment.courier_id);
              const isActive = !assignment.returned_at;
              const lateBy = daysOverdue(assignment);

              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <Link
                      href={`/bikes/${assignment.bike_id}`}
                      className="font-medium hover:underline"
                    >
                      {bike?.primary ?? 'Unknown bike'}
                    </Link>
                    {bike?.secondary && (
                      <p className="text-xs text-muted-foreground">
                        {bike.secondary}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/couriers/${assignment.courier_id}`}
                      className="hover:underline"
                    >
                      {courier?.primary ?? 'Unknown courier'}
                    </Link>
                    {courier?.secondary && (
                      <p className="text-xs text-muted-foreground">
                        {courier.secondary}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{assignment.plan_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(assignment.plan_price)} ·{' '}
                      {formatPlanDuration(assignment)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </p>
                    {assignment.returned_at && (
                      <p className="text-xs text-muted-foreground">
                        Returned{' '}
                        {new Date(assignment.returned_at).toLocaleDateString()}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {lateBy > 0 ? (
                      <Badge variant="destructive">
                        {lateBy}d overdue
                      </Badge>
                    ) : (
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Active' : 'Returned'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/assignments/${assignment.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bike</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell className="text-right">
                <div className="ml-auto h-8 w-16 animate-pulse rounded bg-muted" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
