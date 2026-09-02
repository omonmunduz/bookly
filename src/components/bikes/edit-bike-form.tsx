'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateBikeAction } from '@/app/actions/bikes';
import type { Bike } from '@/lib/types/ebike';

interface EditBikeFormProps {
  bike: Bike;
}

/**
 * Edit a bike's details.
 *
 * Status is not editable here — it moves through the status modal, which knows
 * the transitions the assignment workflow reserves. bike_number is fixed at
 * creation and the update schema does not accept it.
 */
export function EditBikeForm({ bike }: EditBikeFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const model = (formData.get('model') as string)?.trim();
    const serialNumber = (formData.get('serial_number') as string)?.trim();
    const imageUrl = (formData.get('image_url') as string)?.trim();
    const purchaseDate = (formData.get('purchase_date') as string)?.trim();
    const rawPrice = (formData.get('purchase_price') as string)?.trim();
    const batteryInfo = (formData.get('battery_info') as string)?.trim();
    const conditionNotes = (formData.get('condition_notes') as string)?.trim();

    let purchasePrice: number | null = null;
    if (rawPrice) {
      const parsed = Number(rawPrice);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError('Введите цену покупки от нуля или оставьте поле пустым.');
        return;
      }
      purchasePrice = parsed;
    }

    startTransition(async () => {
      const result = await updateBikeAction(bike.id, {
        model,
        image_url: imageUrl || null,
        serial_number: serialNumber ? serialNumber : null,
        purchase_date: purchaseDate ? purchaseDate : null,
        purchase_price: purchasePrice,
        battery_info: batteryInfo ? batteryInfo : null,
        condition_notes: conditionNotes ? conditionNotes : null,
      });

      if (result.success) {
        router.push(`/bikes/${bike.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="model">
          Модель <span className="text-destructive">*</span>
        </Label>
        <Input
          id="model"
          name="model"
          defaultValue={bike.model}
          required
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serial_number">Серийный номер</Label>
        <Input
          id="serial_number"
          name="serial_number"
          defaultValue={bike.serial_number ?? ''}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image_url">
          URL изображения
        </Label>
        <Input
          id="image_url"
          name="image_url"
          type="url"
          defaultValue={bike.image_url ?? ''}
        />
        <p className="text-xs text-muted-foreground">
          Фотография велосипеда. Загрузка файлов скоро будет доступна.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Дата покупки</Label>
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={bike.purchase_date ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_price">Цена покупки</Label>
          <Input
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={bike.purchase_price ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="battery_info">Battery</Label>
        <Input
          id="battery_info"
          name="battery_info"
          defaultValue={bike.battery_info ?? ''}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="condition_notes">Примечания о состоянии</Label>
        <Textarea
          id="condition_notes"
          name="condition_notes"
          defaultValue={bike.condition_notes ?? ''}
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={`/bikes/${bike.id}`}>Отмена</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить changes
        </Button>
      </div>
    </form>
  );
}
