/**
 * Assignment Detail Page
 *
 * One rental, in full: which bike went to which courier, on what terms, and in
 * what condition it left and came back.
 *
 * The assignment row stores bike and courier IDs with no join, so both records
 * are fetched alongside it. The rental terms come from the assignment's own
 * snapshot rather than the live plan, which is why editing a plan never changes
 * what this page says.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Bike as BikeIcon,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils/format';
import {
  expectedReturnDate,
  isOverdue,
  daysOverdue,
  daysHeld,
  formatPlanDuration,
} from '@/features/assignments/duration';

export default async function AssignmentDetailPage({
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

  const [bikeResult, courierResult] = await Promise.all([
    getBikeAction(assignment.bike_id),
    getCourierAction(assignment.courier_id),
  ]);

  const bike = bikeResult.success ? bikeResult.data : null;
  const courier = courierResult.success ? courierResult.data : null;

  const isActive = !assignment.returned_at;
  const dueDate = expectedReturnDate(assignment);
  const overdue = isOverdue(assignment);
  const lateBy = daysOverdue(assignment);
  const heldDays = daysHeld(assignment);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/assignments">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Assignment</h1>
            {isActive ? (
              <Badge>Active</Badge>
            ) : (
              <Badge variant="secondary">Returned</Badge>
            )}
            {overdue && <Badge variant="destructive">{lateBy}d overdue</Badge>}
          </div>
          <p className="text-muted-foreground">
            Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
          </p>
        </div>

        {isActive && (
          <Button asChild>
            <Link href={`/assignments/${assignment.id}/return`}>
              <CheckCircle2 className="h-4 w-4" />
              Return bike
            </Link>
          </Button>
        )}
      </div>

      {overdue && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Bike overdue</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Due back on {dueDate.toLocaleDateString()}, {lateBy}{' '}
                  {lateBy === 1 ? 'day' : 'days'} ago. Process the return when
                  the bike comes in.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BikeIcon className="h-5 w-5" />
              Bike
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bike ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Bike number</p>
                  <Link
                    href={`/bikes/${bike.id}`}
                    className="text-lg font-medium hover:underline"
                  >
                    {bike.bike_number}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="font-medium">{bike.model}</p>
                </div>
                {bike.serial_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Serial number
                    </p>
                    <p className="font-medium">{bike.serial_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">
                    Current status
                  </p>
                  <Badge
                    variant={
                      bike.status === 'assigned' ? 'default' : 'secondary'
                    }
                  >
                    {bike.status}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This bike is no longer on record.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Courier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courier ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <Link
                    href={`/couriers/${courier.id}`}
                    className="text-lg font-medium hover:underline"
                  >
                    {courier.full_name}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Courier code</p>
                  <p className="font-medium">{courier.courier_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <a
                    href={`tel:${courier.phone}`}
                    className="font-medium hover:underline"
                  >
                    {courier.phone}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Current status
                  </p>
                  <Badge
                    variant={
                      courier.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {courier.status}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This courier is no longer on record.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rental terms
          </CardTitle>
          <CardDescription>
            Snapshotted when the bike was assigned. Later edits to the plan do
            not change these.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-lg font-medium">{assignment.plan_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-lg font-medium">
                {formatMoney(assignment.plan_price)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-lg font-medium">
                {formatPlanDuration(assignment)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Assigned</p>
              <p className="font-medium">
                {new Date(assignment.assigned_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(assignment.assigned_at).toLocaleTimeString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due back</p>
              <p className="font-medium">{dueDate.toLocaleDateString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPlanDuration(assignment)} from assignment
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Returned</p>
              {assignment.returned_at ? (
                <>
                  <p className="font-medium">
                    {new Date(assignment.returned_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(assignment.returned_at).toLocaleTimeString()}
                  </p>
                </>
              ) : (
                <Badge variant="outline" className="font-normal">
                  Still out
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Days held</p>
              <p className="font-medium">
                {heldDays} {heldDays === 1 ? 'day' : 'days'}
              </p>
              {isActive && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Ongoing
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Condition at assignment</CardTitle>
            <CardDescription>How the bike went out</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm">
              {assignment.condition_at_assignment}
            </p>
            {assignment.assignment_notes && (
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {assignment.assignment_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition at return</CardTitle>
            <CardDescription>How the bike came back</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignment.returned_at ? (
              <>
                <p className="whitespace-pre-wrap text-sm">
                  {assignment.condition_at_return ?? 'No condition recorded.'}
                </p>
                {assignment.return_notes && (
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {assignment.return_notes}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Bike is still out with the courier.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
