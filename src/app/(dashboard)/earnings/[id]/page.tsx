import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Coins, User, FileText } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getEarningsPeriodWithDeductionsAction } from '@/app/actions/earnings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ChangeEarningsStatusButton } from '@/components/earnings/change-status-button';
import { AddDeductionButton } from '@/components/earnings/add-deduction-button';
import { DeleteDeductionButton } from '@/components/earnings/delete-deduction-button';
import {
  DEDUCTION_TYPE_LABELS,
  EARNINGS_STATUS_LABELS,
  EARNINGS_STATUS_VARIANT,
} from '@/features/earnings/labels';

interface PageProps {
  /** Next 15 passes route params as a promise. */
  params: Promise<{ id: string }>;
}

export default async function EarningsPeriodDetailPage({ params }: PageProps) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <EarningsPeriodContent periodId={id} />
      </Suspense>
    </div>
  );
}

async function EarningsPeriodContent({ periodId }: { periodId: string }) {
  const result = await getEarningsPeriodWithDeductionsAction(periodId);

  if (!result.success || !result.data) {
    notFound();
  }

  const period = result.data;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/earnings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Earnings Period
            </h1>
            <p className="text-muted-foreground">
              {formatDate(period.period_start)} - {formatDate(period.period_end)}
            </p>
          </div>
        </div>
        <Badge variant={EARNINGS_STATUS_VARIANT[period.status]} className="text-sm">
          {EARNINGS_STATUS_LABELS[period.status]}
        </Badge>
      </div>

      {/* Courier Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Информация о курьере
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-lg font-semibold">{period.courier.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Courier Code</p>
            <p className="text-lg font-semibold">{period.courier.courier_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="text-lg font-semibold">{period.courier.phone || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Earnings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Earnings Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Period</p>
              <p className="text-lg font-semibold">
                {formatDate(period.period_start)} - {formatDate(period.period_end)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-lg font-semibold">
                {period.paid_at ? formatDate(period.paid_at) : '—'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Gross Earnings</span>
              <span className="text-xl font-semibold">
                {formatCurrency(period.gross_earnings)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Total Deductions</span>
              <span className="text-xl font-semibold text-destructive">
                -{formatCurrency(period.total_deductions)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-baseline">
              <span className="text-lg font-semibold">Net payout</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(period.net_payout)}
              </span>
            </div>
          </div>

          {period.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{period.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Deductions
              </CardTitle>
              <CardDescription>
                {period.deductions.length} deduction{period.deductions.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {period.status === 'draft' && (
              <AddDeductionButton periodId={period.id} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {period.deductions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No deductions for this period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {period.status === 'draft' && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.deductions.map((deduction) => (
                  <TableRow key={deduction.id}>
                    <TableCell>
                      {DEDUCTION_TYPE_LABELS[deduction.deduction_type]}
                    </TableCell>
                    <TableCell>{deduction.description}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(deduction.amount)}
                    </TableCell>
                    {period.status === 'draft' && (
                      <TableCell>
                        <DeleteDeductionButton deductionId={deduction.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <ChangeEarningsStatusButton period={period} />
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
