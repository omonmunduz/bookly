/**
 * MAINTENANCE DETAIL
 *
 * One maintenance record in full, with the approval action for managers.
 *
 * The record stores only bike_id, so the bike is fetched alongside it — a
 * maintenance entry is meaningless without knowing which bike it belongs to, and
 * showing a bare UUID would push that lookup onto the reader.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Wrench,
  Check,
  Clock,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { hasRole } from '@/features/auth/roles';
import { getMaintenanceRecordAction } from '@/app/actions/maintenance';
import { getBikeAction } from '@/app/actions/bikes';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ApproveMaintenanceButton } from '@/components/maintenance/approve-button';
import { MAINTENANCE_TYPE_LABELS } from '@/features/maintenance/labels';
import type { AuthUser } from '@/features/auth/types';

export const metadata = {
  title: 'Maintenance record',
  description: 'View a maintenance record',
};

/** Next 15 passes route params as a promise. */
interface MaintenanceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MaintenanceDetailPage({
  params,
}: MaintenanceDetailPageProps) {
  const [{ id }, user] = await Promise.all([params, requireActiveUser()]);

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
            Maintenance record
          </h1>
          <p className="text-muted-foreground">Work performed on a bike</p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <MaintenanceDetailContent id={id} user={user} />
      </Suspense>
    </div>
  );
}

async function MaintenanceDetailContent({
  id,
  user,
}: {
  id: string;
  user: AuthUser;
}) {
  const result = await getMaintenanceRecordAction(id);

  if (!result.success) {
    notFound();
  }

  const record = result.data;

  // Fetched after the record, since the bike ID comes from it. A missing bike is
  // not fatal here — the maintenance history still stands on its own.
  const bikeResult = await getBikeAction(record.bike_id);
  const bike = bikeResult.success ? bikeResult.data : null;

  const isPending = record.requires_approval && !record.approved_at;
  const canApprove = hasRole(user, 'manager') && isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Status</CardTitle>
              <CardDescription>Approval state of this record</CardDescription>
            </div>
            <Badge
              variant={
                record.approved_at
                  ? 'default'
                  : isPending
                    ? 'destructive'
                    : 'outline'
              }
            >
              {record.approved_at
                ? 'Approved'
                : isPending
                  ? 'Pending approval'
                  : 'Complete'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {record.approved_at ? (
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-success" />
              <span>Approved on {formatDate(record.approved_at)}</span>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Waiting for a manager to approve this repair</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4" />
              <span>No approval required</span>
            </div>
          )}

          {canApprove && <ApproveMaintenanceButton recordId={record.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bike</CardTitle>
          <CardDescription>The bike this work was done on</CardDescription>
        </CardHeader>
        <CardContent>
          {bike ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Bike number</p>
                <Link
                  href={`/bikes/${bike.id}`}
                  className="text-base font-medium underline-offset-4 hover:underline"
                >
                  {bike.bike_number}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="text-base font-medium">{bike.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current status</p>
                <Badge variant="outline" className="capitalize">
                  {bike.status}
                </Badge>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Bike unavailable</AlertTitle>
              <AlertDescription>
                {bikeResult.success ? '' : bikeResult.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>What was done, and what it cost</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="text-base font-medium">
                  {MAINTENANCE_TYPE_LABELS[record.maintenance_type]}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Performed</p>
                <p className="text-base font-medium">
                  {formatDate(record.performed_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-base font-medium">
                  {record.cost === null ? '—' : formatCurrency(record.cost)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-sm font-medium">Description</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {record.description}
            </p>
          </div>

          {record.parts_replaced && (
            <div>
              <p className="mb-2 text-sm font-medium">Parts replaced</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {record.parts_replaced}
              </p>
            </div>
          )}

          {record.notes && (
            <div>
              <p className="mb-2 text-sm font-medium">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {record.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {record.image_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>
              {record.image_urls.length === 1
                ? '1 photo attached'
                : `${record.image_urls.length} photos attached`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Plain <img>: these are arbitrary external URLs entered by hand,
                which next/image would need configured remote patterns for. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {record.image_urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border"
                >
                  <img
                    src={url}
                    alt="Maintenance photo"
                    className="h-48 w-full bg-muted object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">{formatDate(record.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
