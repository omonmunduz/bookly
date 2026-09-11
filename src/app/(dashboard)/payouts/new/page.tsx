import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { listCouriersAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddTransactionForm } from '@/components/payouts/add-transaction-form';

export const metadata = {
  title: 'Новая транзакция',
  description: 'Добавить транзакцию в баланс курьера',
};

export default async function NewTransactionPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/payouts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Новая транзакция</h1>
          <p className="text-muted-foreground">
            Добавить списание или пополнение баланса курьера
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <NewTransactionContent />
      </Suspense>
    </div>
  );
}

async function NewTransactionContent() {
  const couriersResult = await listCouriersAction({ status: 'active' });

  if (!couriersResult.success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{couriersResult.error}</p>
        </CardContent>
      </Card>
    );
  }

  const couriers = couriersResult.data;

  if (couriers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Нет активных курьеров. Добавьте курьера, чтобы создать транзакцию.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Информация о транзакции</CardTitle>
        <CardDescription>
          Заполните форму для добавления транзакции. Примечание обязательно для всех ручных операций.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AddTransactionForm couriers={couriers} />
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
