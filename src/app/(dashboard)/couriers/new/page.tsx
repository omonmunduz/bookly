import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateCourierForm } from '@/components/couriers/create-courier-form';

export const metadata = {
  title: 'Add New Courier',
  description: 'Add a new courier',
};

export default async function NewCourierPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/couriers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Add new courier
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a new courier to the system
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Courier information</CardTitle>
          <CardDescription>
            Enter the details for the new courier. Fields marked with * are
            required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourierForm />
        </CardContent>
      </Card>
    </div>
  );
}
