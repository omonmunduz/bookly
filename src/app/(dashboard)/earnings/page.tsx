import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Coins, Calendar, TrendingDown } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import {
  listEarningsPeriodsAction,
  getEarningsSummaryAction,
} from '@/app/actions/earnings';
import { listCouriersAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  EARNINGS_STATUS_LABELS,
  EARNINGS_STATUS_VARIANT,
} from '@/features/earnings/labels';

export const metadata = {
  title: 'Earnings',
  description: 'Manage courier earnings and payments',
};

/** How far back the summary cards reach. Periods are weekly or fortnightly, so
 * a rolling year covers the current payout cycle and its recent history without
 * asking the user to pick a range before seeing anything. */
const SUMMARY_WINDOW_DAYS = 365;

export default async function EarningsPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground">
            Track courier earnings periods and payments
          </p>
        </div>
        <Button asChild>
          <Link href="/earnings/new">
            <Plus className="h-4 w-4" />
            New period
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <EarningsContent />
      </Suspense>
    </div>
  );
}

async function EarningsContent() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - SUMMARY_WINDOW_DAYS);

  // Couriers are fetched alongside the periods because the earnings list query
  // selects raw rows with no courier join — only courier_id. Resolving names
  // here keeps it to one extra query instead of one per period.
  const [periodsResult, summaryResult, couriersResult] = await Promise.all([
    listEarningsPeriodsAction(),
    getEarningsSummaryAction(startDate, endDate),
    listCouriersAction(),
  ]);

  if (!periodsResult.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{periodsResult.error}</p>
      </div>
    );
  }

  const periods = periodsResult.data;
  const summary = summaryResult.success ? summaryResult.data : null;

  const courierNames = new Map(
    (couriersResult.success ? couriersResult.data : []).map((courier) => [
      courier.id,
      `${courier.full_name} (${courier.courier_code})`,
    ])
  );

  return (
    <>
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Gross earnings
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalGrossEarnings)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {summary.periodCount}{' '}
                {summary.periodCount === 1 ? 'period' : 'periods'} this year
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deductions</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalDeductions)}
              </div>
              <p className="text-xs text-muted-foreground">
                Rentals, damage, and equipment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net payouts</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalNetPayouts)}
              </div>
              <p className="text-xs text-muted-foreground">
                What couriers take home
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {periods.length === 0 ? (
        <EmptyState
          icon={<Coins className="h-10 w-10" />}
          title="No earnings periods"
          description="Create your first earnings period to start tracking courier payments."
          action={
            <Button asChild>
              <Link href="/earnings/new">
                <Plus className="h-4 w-4" />
                New period
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {periods.map((period) => (
            <Card
              key={period.id}
              className="transition-colors hover:bg-accent/50"
            >
              <Link href={`/earnings/${period.id}`} className="block">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {courierNames.get(period.courier_id) ?? 'Courier'}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(period.period_start)} –{' '}
                        {formatDate(period.period_end)}
                      </CardDescription>
                    </div>
                    <Badge variant={EARNINGS_STATUS_VARIANT[period.status]}>
                      {EARNINGS_STATUS_LABELS[period.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Gross earnings
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(period.gross_earnings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Deductions
                      </p>
                      <p className="text-lg font-semibold text-destructive">
                        -{formatCurrency(period.total_deductions)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Net payout
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(period.net_payout)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid</p>
                      <p className="text-lg font-semibold">
                        {period.paid_at ? formatDate(period.paid_at) : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
