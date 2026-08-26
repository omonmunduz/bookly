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
import { formatCurrency } from '@/lib/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import { EarningsList } from '@/components/earnings/earnings-list';

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
        <EarningsList periods={periods} courierNames={courierNames} />
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
