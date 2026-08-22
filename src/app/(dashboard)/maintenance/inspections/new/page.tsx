/**
 * NEW INSPECTION
 *
 * Assigned bikes are filtered out of the picker, matching the service rule that an
 * assigned bike is inspected through the assignment return flow, not here.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { listBikesAction } from '@/app/actions/bikes';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateInspectionForm } from '@/components/maintenance/create-inspection-form';

export const metadata = {
  title: 'New inspection',
  description: 'Record a bike inspection',
};

export default async function NewInspectionPage() {
  await requireActiveUser();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance/inspections" aria-label="Back to inspections">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New inspection</h1>
          <p className="text-muted-foreground">Record the condition of a bike</p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <NewInspectionContent />
      </Suspense>
    </div>
  );
}

async function NewInspectionContent() {
  const result = await listBikesAction();

  if (!result.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load bikes</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const bikes = result.data.filter((bike) => bike.status !== 'assigned');

  return <CreateInspectionForm bikes={bikes} />;
}

function LoadingSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
}
