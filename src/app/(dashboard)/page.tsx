/**
 * E-Bike Rental Dashboard
 *
 * Main dashboard for bike rental and courier management.
 * Shows key metrics: bike utilization, active assignments, maintenance alerts,
 * earnings summary, and overdue returns.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Bike, Users, Wrench, DollarSign, AlertTriangle, ClipboardCheck } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import {
  getBikeCountByStatusAction,
  getAvailableBikesAction,
  getBikesNeedingMaintenanceAction,
  getBikesAwaitingInspectionAction,
} from '@/app/actions/bikes';
import { getActiveCouriersAction } from '@/app/actions/couriers';
import {
  getActiveAssignmentsAction,
  getOverdueAssignmentsAction,
} from '@/app/actions/assignments';
import { getEarningsCountByStatusAction } from '@/app/actions/earnings';
import { getMaintenancePendingApprovalAction } from '@/app/actions/maintenance';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BikesAwaitingInspectionWidget } from '@/components/ebike/BikesAwaitingInspectionWidget';

export const metadata = {
  title: 'Панель управления',
  description: 'Управление арендой велосипедов',
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
          Добро пожаловать, {firstName(user.fullName || 'Пользователь')}
        </h1>
        <p className="text-sm text-muted-foreground">Управление арендой велосипедов</p>
      </header>

      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardContent userRole={user.role} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ userRole }: { userRole: string }) {
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
    bikesAwaitingInspectionResult,
  ] = await Promise.all([
    getBikeCountByStatusAction(),
    getAvailableBikesAction(),
    getBikesNeedingMaintenanceAction(),
    getActiveCouriersAction(),
    getActiveAssignmentsAction(),
    getOverdueAssignmentsAction(0),
    getEarningsCountByStatusAction(),
    getMaintenancePendingApprovalAction(),
    getBikesAwaitingInspectionAction(),
  ]);

  const bikeCounts = bikeCountsResult.success ? bikeCountsResult.data : null;
  const availableBikes = availableBikesResult.success ? availableBikesResult.data.length : 0;
  const maintenanceBikes = maintenanceBikesResult.success ? maintenanceBikesResult.data.length : 0;
  const activeCouriers = activeCouriersResult.success ? activeCouriersResult.data.length : 0;
  const activeAssignments = activeAssignmentsResult.success ? activeAssignmentsResult.data.length : 0;
  const overdueAssignments = overdueAssignmentsResult.success ? overdueAssignmentsResult.data : [];
  const earningsCounts = earningsCountsResult.success ? earningsCountsResult.data : null;
  const pendingApprovals = pendingApprovalsResult.success ? pendingApprovalsResult.data.length : 0;
  const bikesAwaitingInspection = bikesAwaitingInspectionResult.success ? bikesAwaitingInspectionResult.data : [];

  const totalBikes = bikeCounts
    ? bikeCounts.available + bikeCounts.assigned + bikeCounts.returned + bikeCounts.maintenance + bikeCounts.damaged + bikeCounts.retired
    : 0;

  const utilizationRate = totalBikes > 0 && bikeCounts
    ? Math.round((bikeCounts.assigned / (bikeCounts.available + bikeCounts.assigned + bikeCounts.returned)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {bikesAwaitingInspection.length > 0 && (
        <Alert>
          <ClipboardCheck className="h-4 w-4" />
          <AlertTitle>Велосипеды ожидают инспекцию</AlertTitle>
          <AlertDescription>
            {bikesAwaitingInspection.length} {bikesAwaitingInspection.length === 1 ? 'велосипед возвращён и ожидает' : 'велосипеда возвращены и ожидают'} инспекции.
            <Link href="/bikes?status=returned" className="ml-2 underline">
              Просмотреть очередь
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {overdueAssignments.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Просроченные возвраты</AlertTitle>
          <AlertDescription>
            {overdueAssignments.length} {overdueAssignments.length === 1 ? 'велосипед просрочен' : 'велосипеда просрочены'} для возврата.
            <Link href="/assignments?overdue=true" className="ml-2 underline">
              Посмотреть детали
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {pendingApprovals > 0 && (
        <Alert>
          <Wrench className="h-4 w-4" />
          <AlertTitle>Требуется одобрение обслуживания</AlertTitle>
          <AlertDescription>
            {pendingApprovals} {pendingApprovals === 1 ? 'запись требует' : 'записи требуют'} одобрения менеджера.
            <Link href="/maintenance/approvals" className="ml-2 underline">
              Просмотреть сейчас
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <section aria-label="Ключевые метрики" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Доступные велосипеды"
          value={String(availableBikes)}
          detail={`${utilizationRate}% используется`}
          icon={Bike}
          tone={availableBikes === 0 ? 'warning' : 'positive'}
          href="/bikes"
        />

        <MetricCard
          label="Активные назначения"
          value={String(activeAssignments)}
          detail={`${activeCouriers} активных курьеров`}
          icon={Users}
          href="/assignments"
        />

        <MetricCard
          label="Требуют обслуживания"
          value={String(maintenanceBikes)}
          detail="велосипедов требуют обслуживания"
          icon={Wrench}
          tone={maintenanceBikes > 0 ? 'warning' : 'default'}
          href="/maintenance"
        />

        <MetricCard
          label="Неоплаченные выплаты"
          value={earningsCounts ? String(earningsCounts.draft + earningsCounts.approved) : '0'}
          detail={earningsCounts?.paid ? `${earningsCounts.paid} оплачено` : 'нет оплаченных периодов'}
          icon={DollarSign}
          href="/earnings"
        />
      </section>

      {/* Quick Actions */}
      <QuickActions userRole={userRole} />

      {/* Bike Fleet Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        {bikesAwaitingInspection.length > 0 && (
          <BikesAwaitingInspectionWidget bikes={bikesAwaitingInspection} />
        )}
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

function QuickActions({ userRole }: { userRole: string }) {
  const isMechanic = userRole === 'mechanic';

  return (
    <section aria-label="Быстрые действия" className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/assignments/new">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Назначить велосипед
        </Link>
      </Button>
      {!isMechanic && (
        <>
          <Button variant="outline" asChild>
            <Link href="/couriers/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Новый курьер
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/bikes/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Добавить велосипед
            </Link>
          </Button>
        </>
      )}
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
        <h2 className="text-sm font-semibold">Статус парка велосипедов</h2>
        <p className="mt-3 text-sm text-muted-foreground">Нет данных</p>
      </section>
    );
  }

  const statuses = [
    { label: 'Доступно', value: bikeCounts.available, color: 'text-success' },
    { label: 'Назначено', value: bikeCounts.assigned, color: 'text-blue-600' },
    { label: 'Возвращено', value: bikeCounts.returned, color: 'text-warning' },
    { label: 'Обслуживание', value: bikeCounts.maintenance, color: 'text-warning' },
    { label: 'Повреждено', value: bikeCounts.damaged, color: 'text-destructive' },
    { label: 'Выведено', value: bikeCounts.retired, color: 'text-muted-foreground' },
  ];

  return (
    <section
      aria-labelledby="fleet-status-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 id="fleet-status-heading" className="text-sm font-semibold">
        Статус парка велосипедов
      </h2>
      <p className="text-xs text-muted-foreground">Всего: {totalBikes} велосипедов</p>
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
        Обзор активности
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-sm text-muted-foreground">Активные назначения</dt>
          <dd className="mt-1 text-2xl font-semibold">{activeAssignments}</dd>
        </div>
        {overdueCount > 0 && (
          <div>
            <dt className="text-sm text-destructive">Просроченные возвраты</dt>
            <dd className="mt-1 text-2xl font-semibold text-destructive">{overdueCount}</dd>
          </div>
        )}
        {maintenanceCount > 0 && (
          <div>
            <dt className="text-sm text-warning">Ожидающее обслуживание</dt>
            <dd className="mt-1 text-2xl font-semibold text-warning">{maintenanceCount}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" asChild className="flex-1">
          <Link href="/assignments">Все назначения</Link>
        </Button>
        <Button size="sm" variant="outline" asChild className="flex-1">
          <Link href="/bikes">Управление парком</Link>
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
