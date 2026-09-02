/**
 * MAINTENANCE LIST
 *
 * The fleet's maintenance history, newest first, with the pending-approval count
 * surfaced for managers.
 *
 * Total spend is deliberately absent from the summary. getTotalMaintenanceCost is
 * per-bike, and summing it across the fleet would mean one query per bike on
 * every page load; the figure belongs on the bike detail page, where it is one
 * call and actually actionable.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Wrench, AlertCircle, ClipboardCheck } from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { hasRole } from '@/features/auth/roles';
import {
  listMaintenanceRecordsAction,
  getMaintenancePendingApprovalAction,
} from '@/app/actions/maintenance';
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
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import { MAINTENANCE_TYPE_LABELS } from '@/features/maintenance/labels';
import type { AuthUser } from '@/features/auth/types';

export const metadata = {
  title: 'Обслуживание',
  description: 'Отслеживание обслуживания и ремонта велосипедов',
};

export default async function MaintenancePage() {
  const user = await requireActiveUser();

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Обслуживание</h1>
          <p className="text-muted-foreground">
            Отслеживание обслуживания и ремонта велосипедов
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/maintenance/inspections">
              <ClipboardCheck className="h-4 w-4" />
              Инспекции
            </Link>
          </Button>
          <Button asChild>
            <Link href="/maintenance/new">
              <Plus className="h-4 w-4" />
              Новая запись
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <MaintenanceContent user={user} />
      </Suspense>
    </div>
  );
}

async function MaintenanceContent({ user }: { user: AuthUser }) {
  const canApprove = hasRole(user, 'manager');

  // The pending-approval query is manager-only, so it is only issued for those
  // who can act on the result.
  const [recordsResult, pendingResult] = await Promise.all([
    listMaintenanceRecordsAction(),
    canApprove ? getMaintenancePendingApprovalAction() : null,
  ]);

  if (!recordsResult.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить записи обслуживания</AlertTitle>
        <AlertDescription>{recordsResult.error}</AlertDescription>
      </Alert>
    );
  }

  const records = recordsResult.data;
  const pendingCount =
    pendingResult?.success ? pendingResult.data.length : 0;
  const awaitingApproval = records.filter(
    (record) => record.requires_approval && !record.approved_at
  ).length;

  return (
    <>
      {canApprove && pendingCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ожидают одобрения</AlertTitle>
          <AlertDescription>
            {pendingCount === 1
              ? '1 запись требует одобрения.'
              : `${pendingCount} записей требуют одобрения.`}{' '}
            <Link href="/maintenance/approvals" className="font-medium underline">
              Просмотреть сейчас
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего записей</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
            <p className="text-xs text-muted-foreground">
              Все зарегистрированное обслуживание
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ожидают одобрения
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingApproval}</div>
            <p className="text-xs text-muted-foreground">
              Ремонтов требуют одобрения менеджера
            </p>
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-10 w-10" />}
          title="Нет записей обслуживания"
          description="Зарегистрируйте первый ремонт или инспекцию, чтобы начать отслеживать работу по парку."
          action={
            <Button asChild>
              <Link href="/maintenance/new">
                <Plus className="h-4 w-4" />
                Новая запись
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <Link
              key={record.id}
              href={`/maintenance/${record.id}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {MAINTENANCE_TYPE_LABELS[record.maintenance_type]}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(record.performed_at)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        record.approved_at
                          ? 'default'
                          : record.requires_approval
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {record.approved_at
                        ? 'Одобрено'
                        : record.requires_approval
                          ? 'Ожидает'
                          : 'Завершено'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Cost</p>
                      <p className="text-base font-medium">
                        {record.cost === null
                          ? '—'
                          : formatCurrency(record.cost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Parts replaced
                      </p>
                      <p className="text-base font-medium">
                        {record.parts_replaced || '—'}
                      </p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {record.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
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
