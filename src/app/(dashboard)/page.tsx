/**
 * E-Bike Rental Dashboard
 *
 * Main dashboard for bike rental and courier management.
 * Shows key metrics: bike utilization, active assignments, maintenance alerts,
 * earnings summary, and overdue returns.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Bike, Users, Wrench, DollarSign, AlertTriangle } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import {
  getBikeCountByStatusAction,
  getAvailableBikesAction,
  getBikesNeedingMaintenanceAction,
} from '@/app/actions/bikes';
import { getActiveCouriersAction } from '@/app/actions/couriers';
import {
  getActiveAssignmentsAction,
  getOverdueAssignmentsAction,
} from '@/app/actions/assignments';
import { getEarningsCountByStatusAction } from '@/app/actions/earnings';
import { getMaintenancePendingApprovalAction } from '@/app/actions/maintenance';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const metadata = {
  title: 'Dashboard',
  description: 'E-Bike Rental Management',
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export default async function DashboardPage() {
  const user = await requireActiveUser();

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Welcome back, {firstName(user.fullName || 'User')}
        </h1>
        <p className="text-sm text-muted-foreground">E-Bike Rental Management</p>
      </header>

      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  // Fetch all metrics in parallel
  const [
    bikeCountsResult,
    availableBikesResult,
    maintenanceBikesResult,
    activeCouriersResult,
    activeAssignmentsResult,
    overdueAssignmentsResult,
    earningsCountsResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    getBikeCountByStatusAction(),
    getAvailableBikesAction(),
    getBikesNeedingMaintenanceAction(),
    getActiveCouriersAction(),
    getActiveAssignmentsAction(),
    getOverdueAssignmentsAction(0),
    getEarningsCountByStatusAction(),
    getMaintenancePendingApprovalAction(),
  ]);

  const bikeCounts = bikeCountsResult.success ? bikeCountsResult.data : null;
  const availableBikes = availableBikesResult.success ? availableBikesResult.data.length : 0;
  const maintenanceBikes = maintenanceBikesResult.success ? maintenanceBikesResult.data.length : 0;
  const activeCouriers = activeCouriersResult.success ? activeCouriersResult.data.length : 0;
  const activeAssignments = activeAssignmentsResult.success ? activeAssignmentsResult.data.length : 0;
  const overdueAssignments = overdueAssignmentsResult.success ? overdueAssignmentsResult.data : [];
  const earningsCounts = earningsCountsResult.success ? earningsCountsResult.data : null;
  const pendingApprovals = pendingApprovalsResult.success ? pendingApprovalsResult.data.length : 0;

  const totalBikes = bikeCounts
    ? bikeCounts.available + bikeCounts.assigned + bikeCounts.maintenance + bikeCounts.damaged + bikeCounts.retired
    : 0;

  const utilizationRate = totalBikes > 0 && bikeCounts
    ? Math.round((bikeCounts.assigned / (bikeCounts.available + bikeCounts.assigned)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {overdueAssignments.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Returns</AlertTitle>
          <AlertDescription>
            {overdueAssignments.length} bike{overdueAssignments.length === 1 ? ' is' : 's are'} overdue for return.
            <Link href="/assignments?overdue=true" className="ml-2 underline">
              View details
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {pendingApprovals > 0 && (
        <Alert>
          <Wrench className="h-4 w-4" />
          <AlertTitle>Maintenance Approvals Needed</AlertTitle>
          <AlertDescription>
            {pendingApprovals} maintenance {pendingApprovals === 1 ? 'record needs' : 'records need'} manager approval.
            <Link href="/maintenance/approvals" className="ml-2 underline">
              Review now
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Available Bikes"
          value={String(availableBikes)}
          detail={`${utilizationRate}% in use`}
          icon={Bike}
          tone={availableBikes === 0 ? 'warning' : 'positive'}
          href="/bikes"
        />

        <MetricCard
          label="Active Assignments"
          value={String(activeAssignments)}
          detail={`${activeCouriers} active couriers`}
          icon={Users}
          href="/assignments"
        />

        <MetricCard
          label="Needs Maintenance"
          value={String(maintenanceBikes)}
          detail="bikes requiring service"
          icon={Wrench}
          tone={maintenanceBikes > 0 ? 'warning' : 'default'}
          href="/maintenance"
        />

        <MetricCard
          label="Unpaid Earnings"
          value={earningsCounts ? String(earningsCounts.draft + earningsCounts.approved) : '0'}
          detail={earningsCounts?.paid ? `${earningsCounts.paid} paid` : 'no paid periods'}
          icon={DollarSign}
          href="/earnings"
        />
      </section>

      {/* Quick Actions */}
      <QuickActions />

      {/* Bike Fleet Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BikeFleetStatus bikeCounts={bikeCounts} totalBikes={totalBikes} />
        <RecentActivity
          activeAssignments={activeAssignments}
          overdueCount={overdueAssignments.length}
          maintenanceCount={maintenanceBikes}
        />
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <section aria-label="Quick actions" className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/assignments/new">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Assign Bike
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/couriers/new">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New Courier
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/bikes/new">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Bike
        </Link>
      </Button>
    </section>
  );
}

function BikeFleetStatus({
  bikeCounts,
  totalBikes
}: {
  bikeCounts: Record<string, number> | null;
  totalBikes: number;
}) {
  if (!bikeCounts) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Bike Fleet Status</h2>
        <p className="mt-3 text-sm text-muted-foreground">No data available</p>
      </section>
    );
  }

  const statuses = [
    { label: 'Available', value: bikeCounts.available, color: 'text-success' },
    { label: 'Assigned', value: bikeCounts.assigned, color: 'text-blue-600' },
    { label: 'Maintenance', value: bikeCounts.maintenance, color: 'text-warning' },
    { label: 'Damaged', value: bikeCounts.damaged, color: 'text-destructive' },
    { label: 'Retired', value: bikeCounts.retired, color: 'text-muted-foreground' },
  ];

  return (
    <section
      aria-labelledby="fleet-status-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 id="fleet-status-heading" className="text-sm font-semibold">
        Bike Fleet Status
      </h2>
      <p className="text-xs text-muted-foreground">Total: {totalBikes} bikes</p>
      <dl className="mt-4 space-y-2">
        {statuses.map((status) => (
          <div key={status.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{status.label}</dt>
            <dd className={`text-sm font-medium tabular-nums ${status.color}`}>
              {status.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RecentActivity({
  activeAssignments,
  overdueCount,
  maintenanceCount,
}: {
  activeAssignments: number;
  overdueCount: number;
  maintenanceCount: number;
}) {
  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 id="activity-heading" className="text-sm font-semibold">
        Activity Overview
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-sm text-muted-foreground">Active Assignments</dt>
          <dd className="mt-1 text-2xl font-semibold">{activeAssignments}</dd>
        </div>
        {overdueCount > 0 && (
          <div>
            <dt className="text-sm text-destructive">Overdue Returns</dt>
            <dd className="mt-1 text-2xl font-semibold text-destructive">{overdueCount}</dd>
          </div>
        )}
        {maintenanceCount > 0 && (
          <div>
            <dt className="text-sm text-warning">Pending Maintenance</dt>
            <dd className="mt-1 text-2xl font-semibold text-warning">{maintenanceCount}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" asChild className="flex-1">
          <Link href="/assignments">View All</Link>
        </Button>
        <Button size="sm" variant="outline" asChild className="flex-1">
          <Link href="/bikes">Manage Fleet</Link>
        </Button>
      </div>
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[104px] animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}
