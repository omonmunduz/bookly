import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
import { getRentalPlanAction } from '@/app/actions/rental-plans';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RentalPlanForm } from '@/components/rental-plans/rental-plan-form';

export default async function EditRentalPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  const result = await getRentalPlanAction(id);

  if (!result.success) {
    notFound();
  }

  const plan = result.data;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rental-plans">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit rental plan</h1>
        <p className="text-muted-foreground">Update {plan.name}</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Assignments already created with this plan keep the price and duration
          they were made with. Changes here affect new assignments only.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
          <CardDescription>
            Update the pricing and terms. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RentalPlanForm plan={plan} />
        </CardContent>
      </Card>
    </div>
  );
}
