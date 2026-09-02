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
import { updateCourierAction } from '@/app/actions/couriers';
import type { Courier } from '@/lib/types/ebike';

interface EditCourierFormProps {
  courier: Courier;
}

/**
 * Edit a courier's details.
 *
 * Status is not editable here — it moves through the status modal, which warns
 * when deactivating a courier who still has a bike out. courier_code and
 * start_date are fixed at creation and the update schema does not accept them.
 */
export function EditCourierForm({ courier }: EditCourierFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const fullName = (formData.get('full_name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim();
    const idNumber = (formData.get('identification_number') as string)?.trim();
    const address = (formData.get('address') as string)?.trim();
    const emergencyContact = (
      formData.get('emergency_contact') as string
    )?.trim();
    const yandexIdentifier = (
      formData.get('yandex_identifier') as string
    )?.trim();
    const notes = (formData.get('notes') as string)?.trim();

    if (idNumber && idNumber.length < 5) {
      setError(
        'ИНН должен содержать не менее 5 символов или быть пустым.'
      );
      return;
    }

    startTransition(async () => {
      const result = await updateCourierAction(courier.id, {
        full_name: fullName,
        phone,
        identification_number: idNumber ? idNumber : null,
        address: address ? address : null,
        emergency_contact: emergencyContact ? emergencyContact : null,
        yandex_identifier: yandexIdentifier ? yandexIdentifier : null,
        notes: notes ? notes : null,
      });

      if (result.success) {
        router.push(`/couriers/${courier.id}`);
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
        <Label htmlFor="full_name">
          Полное имя <span className="text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={courier.full_name}
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          Номер телефона <span className="text-destructive">*</span>
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={courier.phone}
          required
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">
          Must not already belong to another courier.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identification_number">ИНН</Label>
        <Input
          id="identification_number"
          name="identification_number"
          defaultValue={courier.identification_number ?? ''}
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Адрес</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={courier.address ?? ''}
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergency_contact">Контакт для экстренной связи</Label>
        <Input
          id="emergency_contact"
          name="emergency_contact"
          defaultValue={courier.emergency_contact ?? ''}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="yandex_identifier">ID Яндекс</Label>
        <Input
          id="yandex_identifier"
          name="yandex_identifier"
          defaultValue={courier.yandex_identifier ?? ''}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Примечания</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={courier.notes ?? ''}
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={`/couriers/${courier.id}`}>Отмена</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить changes
        </Button>
      </div>
    </form>
  );
}
