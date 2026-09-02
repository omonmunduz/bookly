/**
 * NEW MAINTENANCE RECORD
 *
 * Assigned bikes are filtered out of the picker: the service refuses maintenance
 * on a bike that is out with a courier, so offering it would only produce an
 * error after submit.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { requireActiveUser } from '@/features/auth/guards';
import { listBikesAction } from '@/app/actions/bikes';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateMaintenanceForm } from '@/components/maintenance/create-form';

export const metadata = {
  title: 'New maintenance record',
  description: 'Record maintenance performed on a bike',
};

export default async function NewMaintenancePage() {
  await requireActiveUser();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance" aria-label="Назад к обслуживанию">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            New maintenance record
          </h1>
          <p className="text-muted-foreground">
            Record work performed on a bike
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <NewMaintenanceContent />
      </Suspense>
    </div>
  );
}

async function NewMaintenanceContent() {
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

  return <CreateMaintenanceForm bikes={bikes} />;
}

function LoadingSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
}
