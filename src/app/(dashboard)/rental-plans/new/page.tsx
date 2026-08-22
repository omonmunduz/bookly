import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
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

export const metadata = {
  title: 'New Rental Plan',
  description: 'Create a new pricing plan for bike rentals',
};

export default async function NewRentalPlanPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rental-plans">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">New rental plan</h1>
        <p className="text-muted-foreground">
          Create a new pricing plan for bike rentals
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Assignments snapshot the plan they were created with, so changing a
          plan later never rewrites past assignments.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
          <CardDescription>
            Set the pricing and terms for this plan. Fields marked with * are
            required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RentalPlanForm />
        </CardContent>
      </Card>
    </div>
  );
}
