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
  title: 'Добавить нового курьера',
  description: 'Добавить нового курьера',
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
            Добавить нового курьера
          </h1>
          <p className="text-sm text-muted-foreground">
            Добавить нового курьера в систему
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о курьере</CardTitle>
          <CardDescription>
            Введите данные для нового курьера. Поля, отмеченные *, обязательны для заполнения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourierForm />
        </CardContent>
      </Card>
    </div>
  );
}
