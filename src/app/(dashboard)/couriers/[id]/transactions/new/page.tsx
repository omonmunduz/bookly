import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireMinimumRole } from '@/features/auth/guards';
import { getCourierAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddTransactionForm } from '@/components/payouts/add-transaction-form';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const courierResult = await getCourierAction(id);

  const courierName = courierResult.success && courierResult.data
    ? courierResult.data.full_name
    : 'Курьер';

  return {
    title: `Новая транзакция — ${courierName}`,
    description: 'Добавить транзакцию в баланс курьера',
  };
}

export default async function NewCourierTransactionPage({ params }: PageProps) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('manager')]);

  const courierResult = await getCourierAction(id);

  if (!courierResult.success || !courierResult.data) {
    notFound();
  }

  const courier = courierResult.data;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/couriers/${courier.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Новая транзакция</h1>
          <p className="text-muted-foreground">
            Добавить списание или пополнение для {courier.full_name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о транзакции</CardTitle>
          <CardDescription>
            Заполните форму для добавления транзакции. Примечание обязательно для всех ручных операций.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddTransactionForm
            couriers={[courier]}
            preselectedCourierId={courier.id}
            redirectPath={`/couriers/${courier.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
