import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
import { getBikeAction } from '@/app/actions/bikes';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EditBikeForm } from '@/components/bikes/edit-bike-form';

export default async function EditBikePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  const result = await getBikeAction(id);

  if (!result.success) {
    notFound();
  }

  const bike = result.data;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/bikes/${bike.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit bike</h1>
        <p className="text-muted-foreground">
          Update {bike.bike_number} details
        </p>
      </div>

      {bike.status === 'assigned' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This bike is assigned to a courier. Changes here will not affect the
            active assignment.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bike information</CardTitle>
          <CardDescription>
            Update the bike details. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditBikeForm bike={bike} />
        </CardContent>
      </Card>
    </div>
  );
}
