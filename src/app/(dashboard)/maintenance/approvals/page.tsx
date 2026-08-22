/**
 * MAINTENANCE APPROVALS
 *
 * The manager queue: repairs waiting for sign-off, each approvable in place.
 *
 * Reads from the maintenance_pending_approval view, which already carries the bike
 * number and the mechanic's name — the whole point of the view is that this page
 * needs no per-record joins to be useful.
 *
 * requireMinimumRole redirects rather than rendering a denial, so a mechanic
 * following a stale link lands on the dashboard instead of a dead end.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getMaintenancePendingApprovalAction } from '@/app/actions/maintenance';
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
import { ApproveMaintenanceButton } from '@/components/maintenance/approve-button';
import { MAINTENANCE_TYPE_LABELS } from '@/features/maintenance/labels';

export const metadata = {
  title: 'Maintenance approvals',
  description: 'Review and approve maintenance records',
};

export default async function MaintenanceApprovalsPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance" aria-label="Back to maintenance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Maintenance approvals
          </h1>
          <p className="text-muted-foreground">
            Repairs waiting for your sign-off
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <ApprovalsContent />
      </Suspense>
    </div>
  );
}

async function ApprovalsContent() {
  const result = await getMaintenancePendingApprovalAction();

  if (!result.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load pending approvals</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const records = result.data;

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-10 w-10" />}
        title="Nothing to approve"
        description="Every maintenance record has been reviewed."
        action={
          <Button variant="outline" asChild>
            <Link href="/maintenance">Back to maintenance</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Pending approvals</AlertTitle>
        <AlertDescription>
          {records.length === 1
            ? '1 record needs your approval.'
            : `${records.length} records need your approval.`}
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {records.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {record.bike_number} — {record.model}
                  </CardTitle>
                  <CardDescription>
                    {formatDate(record.performed_at)}
                    {record.performed_by_name && ` • ${record.performed_by_name}`}
                  </CardDescription>
                </div>
                <Badge variant="destructive">Pending</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="text-base font-medium">
                    {MAINTENANCE_TYPE_LABELS[record.maintenance_type]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost</p>
                  <p className="text-base font-medium">
                    {record.cost === null ? '—' : formatCurrency(record.cost)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">
                  {record.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ApproveMaintenanceButton recordId={record.id} />
                <Button variant="outline" asChild>
                  <Link href={`/maintenance/${record.id}`}>View details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
