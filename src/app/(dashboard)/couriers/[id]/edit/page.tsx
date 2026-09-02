import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { requireMinimumRole } from '@/features/auth/guards';
import { getCourierAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EditCourierForm } from '@/components/couriers/edit-courier-form';

export default async function EditCourierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  const result = await getCourierAction(id);

  if (!result.success) {
    notFound();
  }

  const courier = result.data;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/couriers/${courier.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Редактировать courier</h1>
        <p className="text-muted-foreground">
          Update {courier.full_name} ({courier.courier_code})
        </p>
      </div>

      {courier.status !== 'active' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This courier is {courier.status}. Change their status from the
            courier page to make them assignable again.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Courier information</CardTitle>
          <CardDescription>
            Update the courier details. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditCourierForm courier={courier} />
        </CardContent>
      </Card>
    </div>
  );
}
