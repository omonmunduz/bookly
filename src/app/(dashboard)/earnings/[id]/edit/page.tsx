import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getEarningsPeriodWithDeductionsAction } from '@/app/actions/earnings';
import { Button } from '@/components/ui/button';
import { EditEarningsForm } from '@/components/earnings/edit-earnings-form';

interface PageProps {
  /** Next 15 passes route params as a promise. */
  params: Promise<{ id: string }>;
}

export default async function EditEarningsPeriodPage({ params }: PageProps) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <EditEarningsPeriodContent periodId={id} />
      </Suspense>
    </div>
  );
}

async function EditEarningsPeriodContent({ periodId }: { periodId: string }) {
  const result = await getEarningsPeriodWithDeductionsAction(periodId);

  if (!result.success || !result.data) {
    notFound();
  }

  const period = result.data;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/earnings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Earnings Period</h1>
          <p className="text-muted-foreground">
            Update gross earnings and manage deductions
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <EditEarningsForm period={period} />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
