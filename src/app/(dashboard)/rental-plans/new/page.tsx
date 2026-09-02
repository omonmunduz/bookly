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
  title: 'Новый тарифный план',
  description: 'Создать новый тарифный план для аренды велосипедов',
};

export default async function NewRentalPlanPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rental-plans">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Новый тарифный план</h1>
        <p className="text-muted-foreground">
          Создать новый тарифный план для аренды велосипедов
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Назначения сохраняют снимок тарифа при создании, поэтому изменение тарифа позже не влияет на прошлые назначения.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Детали тарифа</CardTitle>
          <CardDescription>
            Установите цены и условия для этого тарифа. Поля, отмеченные *, обязательны для заполнения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RentalPlanForm />
        </CardContent>
      </Card>
    </div>
  );
}
