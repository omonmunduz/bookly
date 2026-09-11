'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createTransactionAction } from '@/app/actions/courier-transactions';
import {
  MANUAL_DEBIT_TYPES,
  MANUAL_CREDIT_TYPES,
  getTransactionTypeLabel,
  getTransactionTypeDescription,
} from '@/features/courier-transactions/labels';
import type { Courier, TransactionType, TransactionDirection } from '@/lib/types/ebike';

interface AddTransactionFormProps {
  couriers: Courier[];
  preselectedCourierId?: string;
  redirectPath?: string;
}

export function AddTransactionForm({
  couriers,
  preselectedCourierId,
  redirectPath = '/payouts'
}: AddTransactionFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<TransactionDirection>('credit');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const note = (formData.get('note') as string)?.trim();
    const amount = parseFloat(formData.get('amount') as string);

    if (!note) {
      setError('Примечание обязательно для ручных транзакций');
      return;
    }

    if (amount <= 0) {
      setError('Сумма должна быть положительной');
      return;
    }

    startTransition(async () => {
      const result = await createTransactionAction({
        courier_id: formData.get('courier_id') as string,
        type: formData.get('type') as TransactionType,
        direction: formData.get('direction') as TransactionDirection,
        amount,
        note,
        period_start: (formData.get('period_start') as string) || null,
        period_end: (formData.get('period_end') as string) || null,
      });

      if (result.success) {
        router.push(redirectPath);
      } else {
        setError(result.error);
      }
    });
  };

  const availableTypes = direction === 'debit' ? MANUAL_DEBIT_TYPES : MANUAL_CREDIT_TYPES;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="courier_id">
          Курьер <span className="text-destructive">*</span>
        </Label>
        <Select
          id="courier_id"
          name="courier_id"
          required
          defaultValue={preselectedCourierId || ''}
          disabled={!!preselectedCourierId}
          className={preselectedCourierId ? 'cursor-not-allowed opacity-60' : ''}
        >
          <option value="" disabled>
            Выберите курьера
          </option>
          {couriers.map((courier) => (
            <option key={courier.id} value={courier.id}>
              {courier.courier_code} — {courier.full_name}
            </option>
          ))}
        </Select>
        {/* Hidden input to ensure preselected courier_id is submitted when select is disabled */}
        {preselectedCourierId && (
          <input type="hidden" name="courier_id" value={preselectedCourierId} />
        )}
      </div>

      <div className="space-y-3">
        <Label>
          Тип операции <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          name="direction"
          value={direction}
          onValueChange={(value) => setDirection(value as TransactionDirection)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="credit" id="credit" />
            <Label htmlFor="credit" className="font-normal cursor-pointer">
              Пополнение (курьер платит)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="debit" id="debit" />
            <Label htmlFor="debit" className="font-normal cursor-pointer">
              Списание (курьер должен)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">
          Категория <span className="text-destructive">*</span>
        </Label>
        <Select id="type" name="type" required>
          <option value="" disabled>
            Выберите категорию
          </option>
          {availableTypes.map((type) => (
            <option key={type} value={type}>
              {getTransactionTypeLabel(type)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {availableTypes[0] && getTransactionTypeDescription(availableTypes[0])}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">
          Сумма <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          id="amount"
          name="amount"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">
          Примечание <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="note"
          name="note"
          placeholder="Опишите причину транзакции"
          required
          rows={3}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          Обязательное поле для всех ручных транзакций
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="period_start">Период начала (необязательно)</Label>
          <Input type="date" id="period_start" name="period_start" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_end">Период окончания (необязательно)</Label>
          <Input type="date" id="period_end" name="period_end" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          Транзакция будет добавлена в баланс курьера.{' '}
          {direction === 'debit'
            ? 'Списание увеличивает долг курьера.'
            : 'Пополнение уменьшает долг курьера.'}
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Создать транзакцию
        </Button>
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={redirectPath}>Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
