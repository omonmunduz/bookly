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
import { createCourierAction } from '@/app/actions/couriers';

/**
 * Add a courier.
 *
 * There is no email field: couriers are contacted by phone, and the table has no
 * email column. Phone is the unique identifier the service checks for
 * collisions, so it is required.
 *
 * courier_code is omitted deliberately — the database generates it (COU-0001 and
 * up), and the update schema will not let it change afterwards.
 */
export function CreateCourierForm() {
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
    const startDate = (formData.get('start_date') as string)?.trim();
    const yandexIdentifier = (
      formData.get('yandex_identifier') as string
    )?.trim();
    const notes = (formData.get('notes') as string)?.trim();

    // The schema sets a 5-character floor, so a shorter entry would be rejected
    // server-side with a less specific message.
    if (idNumber && idNumber.length < 5) {
      setError(
        'An identification number must be at least 5 characters, or left blank.'
      );
      return;
    }

    startTransition(async () => {
      const result = await createCourierAction({
        full_name: fullName,
        phone,
        identification_number: idNumber ? idNumber : null,
        address: address ? address : null,
        emergency_contact: emergencyContact ? emergencyContact : null,
        start_date: startDate ? startDate : undefined,
        yandex_identifier: yandexIdentifier ? yandexIdentifier : null,
        notes: notes ? notes : null,
      });

      if (result.success) {
        router.push(`/couriers/${result.data.id}`);
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
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="e.g. John Smith"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="e.g. +1 (555) 123-4567"
          required
          maxLength={20}
          autoComplete="tel"
        />
        <p className="text-xs text-muted-foreground">
          Primary contact number. Must not already belong to another courier.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="identification_number">Identification number</Label>
          <Input
            id="identification_number"
            name="identification_number"
            placeholder="e.g. AB1234567"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" name="start_date" type="date" />
          <p className="text-xs text-muted-foreground">
            Defaults to today if left blank.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          placeholder="Where the courier lives"
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergency_contact">Emergency contact</Label>
        <Input
          id="emergency_contact"
          name="emergency_contact"
          placeholder="e.g. Jane Smith — +1 (555) 987-6543"
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="yandex_identifier">Yandex identifier</Label>
        <Input
          id="yandex_identifier"
          name="yandex_identifier"
          placeholder="Courier ID on the delivery platform"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Anything worth recording about this courier"
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          A courier code is generated automatically. The courier starts as
          active.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add courier
        </Button>
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href="/couriers">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
