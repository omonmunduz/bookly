/**
 * Вернуть велосипед Page
 *
 * Closes an open assignment. Mechanics reach this page too — they are the ones
 * receiving bikes back — so it requires only an active user, not a manager.
 *
 * An already-returned assignment redirects to its detail page rather than
 * showing a form that would fail on submit.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import { getAssignmentAction } from '@/app/actions/assignments';
import { getBikeAction } from '@/app/actions/bikes';
import { getCourierAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReturnBikeForm } from '@/components/assignments/return-bike-form';
import { formatMoney } from '@/lib/utils/format';
import {
  expectedReturnDate,
  isOverdue,
  daysOverdue,
  daysHeld,
  formatPlanDuration,
} from '@/features/assignments/duration';

export default async function ReturnBikePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }] = await Promise.all([params, requireActiveUser()]);

  const result = await getAssignmentAction(id);

  if (!result.success) {
    notFound();
  }

  const assignment = result.data;

  if (assignment.returned_at) {
    redirect(`/assignments/${assignment.id}`);
  }

  const [bikeResult, courierResult] = await Promise.all([
    getBikeAction(assignment.bike_id),
    getCourierAction(assignment.courier_id),
  ]);

  const bike = bikeResult.success ? bikeResult.data : null;
  const courier = courierResult.success ? courierResult.data : null;

  const overdue = isOverdue(assignment);
  const lateBy = daysOverdue(assignment);
  const heldDays = daysHeld(assignment);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/assignments/${assignment.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Return bike</h1>
        <p className="text-muted-foreground">
          Record the bike&apos;s condition and close this assignment
        </p>
      </div>

      {overdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This bike was due back on{' '}
            {expectedReturnDate(assignment).toLocaleDateString()} — {lateBy}{' '}
            {lateBy === 1 ? 'day' : 'days'} ago. The full plan price still
            applies.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
          <CardDescription>Check this is the right one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Bike</p>
              <p className="font-medium">{bike?.bike_number ?? 'Unknown'}</p>
              {bike && (
                <p className="text-sm text-muted-foreground">{bike.model}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Courier</p>
              <p className="font-medium">{courier?.full_name ?? 'Unknown'}</p>
              {courier && (
                <p className="text-sm text-muted-foreground">
                  {courier.courier_code}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned</p>
              <p className="font-medium">
                {new Date(assignment.assigned_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">
                {heldDays} {heldDays === 1 ? 'day' : 'days'} ago
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="font-medium">{assignment.plan_name}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(assignment.plan_price)} ·{' '}
                {formatPlanDuration(assignment)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium">Condition when it went out</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {assignment.condition_at_assignment}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Return details</CardTitle>
          <CardDescription>
            What you write here is what a mechanic reads before the bike goes out
            again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReturnBikeForm assignmentId={assignment.id} isOverdue={overdue} />
        </CardContent>
      </Card>
    </div>
  );
}
