/**
 * New Assignment Form Page
 *
 * Assign a bike to a courier under a rental plan. All three lists must be
 * non-empty for an assignment to be possible, so the page explains which one is
 * missing rather than showing a form that cannot succeed.
 */

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
import { getAvailableBikesAction } from '@/app/actions/bikes';
import { getActiveCouriersAction } from '@/app/actions/couriers';
import { getActiveRentalPlansAction } from '@/app/actions/rental-plans';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateAssignmentForm } from '@/components/assignments/create-assignment-form';

export const metadata = {
  title: 'Assign Bike',
  description: 'Assign a bike to a courier',
};

interface PageProps {
  searchParams: Promise<{
    bikeId?: string;
    courierId?: string;
  }>;
}

export default async function NewAssignmentPage({ searchParams }: PageProps) {
  const [{ bikeId, courierId }] = await Promise.all([
    searchParams,
    requireMinimumRole('manager'),
  ]);

  const [bikesResult, couriersResult, plansResult] = await Promise.all([
    getAvailableBikesAction(),
    getActiveCouriersAction(),
    getActiveRentalPlansAction(),
  ]);

  const bikes = bikesResult.success ? bikesResult.data : [];
  const couriers = couriersResult.success ? couriersResult.data : [];
  const plans = plansResult.success ? plansResult.data : [];

  const hasNoBikes = bikes.length === 0;
  const hasNoCouriers = couriers.length === 0;
  const hasNoPlans = plans.length === 0;
  const cannotCreateAssignment = hasNoBikes || hasNoCouriers || hasNoPlans;

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/assignments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assign bike</h1>
          <p className="text-sm text-muted-foreground">
            Assign a bike to a courier with a rental plan
          </p>
        </div>
      </div>

      {cannotCreateAssignment ? (
        <>
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span>An assignment needs all three of these:</span>
              {hasNoBikes && <div>• An available bike</div>}
              {hasNoCouriers && <div>• An active courier</div>}
              {hasNoPlans && <div>• An active rental plan</div>}
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            {hasNoBikes && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/bikes/new">Add bike</Link>
              </Button>
            )}
            {hasNoCouriers && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/couriers/new">Add courier</Link>
              </Button>
            )}
            {hasNoPlans && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/rental-plans/new">Add rental plan</Link>
              </Button>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Assignment details</CardTitle>
            <CardDescription>
              Select the bike, courier, and rental plan for this assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssignmentForm
              bikes={bikes}
              couriers={couriers}
              plans={plans}
              defaultBikeId={bikeId}
              defaultCourierId={courierId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
