import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getActiveCouriersAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateEarningsPeriodForm } from '@/components/earnings/create-period-form';

export const metadata = {
  title: 'New Earnings Period',
  description: 'Create a new earnings period',
};

export default async function NewEarningsPeriodPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/earnings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Earnings Period</h1>
          <p className="text-muted-foreground">
            Create a new earnings period for a courier
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <FormContent />
      </Suspense>
    </div>
  );
}

async function FormContent() {
  // Only active couriers: an inactive or suspended courier is not earning, so
  // offering them here would create a period nobody will ever pay out.
  const couriersResult = await getActiveCouriersAction();
  const couriers = couriersResult.success ? couriersResult.data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Period Details</CardTitle>
        <CardDescription>
          Enter the date range and select the courier for this earnings period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateEarningsPeriodForm couriers={couriers} />
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
}
