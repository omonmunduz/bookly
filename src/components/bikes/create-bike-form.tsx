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
import { createBikeAction } from '@/app/actions/bikes';

/**
 * Add a bike to the fleet.
 *
 * A photo is required by the database (image_url is NOT NULL), so it is enforced
 * here too rather than letting the insert fail. Until a file-upload component
 * ships this takes a URL.
 *
 * bike_number is omitted deliberately — the database generates it (BIKE-0001 and
 * up), and it cannot be changed afterwards.
 */
export function CreateBikeForm() {
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
        setError('Enter a purchase price of zero or more, or leave it blank.');
        return;
      }
      purchasePrice = parsed;
    }

    startTransition(async () => {
      const result = await createBikeAction({
        model,
        image_url: imageUrl,
        serial_number: serialNumber ? serialNumber : null,
        purchase_date: purchaseDate ? purchaseDate : null,
        purchase_price: purchasePrice,
        battery_info: batteryInfo ? batteryInfo : null,
        condition_notes: conditionNotes ? conditionNotes : null,
      });

      if (result.success) {
        router.push(`/bikes/${result.data.id}`);
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
          Model <span className="text-destructive">*</span>
        </Label>
        <Input
          id="model"
          name="model"
          placeholder="e.g. Urban E-Bike X1"
          required
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serial_number">Serial number</Label>
        <Input
          id="serial_number"
          name="serial_number"
          placeholder="e.g. SN123456789"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          Manufacturer serial number, if the bike has one.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image_url">
          Photo URL <span className="text-destructive">*</span>
        </Label>
        <Input
          id="image_url"
          name="image_url"
          type="url"
          placeholder="https://example.com/bike.jpg"
          required
        />
        <p className="text-xs text-muted-foreground">
          A photo of the bike is required. File upload is coming soon.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input id="purchase_date" name="purchase_date" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_price">Purchase price</Label>
          <Input
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="battery_info">Battery</Label>
        <Input
          id="battery_info"
          name="battery_info"
          placeholder="e.g. 48V 15Ah, replaced March 2026"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="condition_notes">Condition notes</Label>
        <Textarea
          id="condition_notes"
          name="condition_notes"
          placeholder="Anything worth recording about the bike's condition"
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          A fleet number is generated automatically. The bike starts as
          available.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add bike
        </Button>
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href="/bikes">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
