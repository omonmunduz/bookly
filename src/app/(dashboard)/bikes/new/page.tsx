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
import { CreateBikeForm } from '@/components/bikes/create-bike-form';

export const metadata = {
  title: 'Добавить новый велосипед',
  description: 'Добавить новый велосипед в парк',
};

export default async function NewBikePage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bikes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Добавить новый велосипед</h1>
          <p className="text-sm text-muted-foreground">
            Добавить новый велосипед в ваш парк
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о велосипеде</CardTitle>
          <CardDescription>
            Введите данные для нового велосипеда. Поля, отмеченные *, обязательны для заполнения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBikeForm />
        </CardContent>
      </Card>
    </div>
  );
}
