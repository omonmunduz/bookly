'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createDeductionAction } from '@/app/actions/earnings';
import { DEDUCTION_TYPE_LABELS } from '@/features/earnings/labels';
import type { DeductionType } from '@/lib/types/ebike';

const DEDUCTION_TYPES = Object.entries(DEDUCTION_TYPE_LABELS) as [
  DeductionType,
  string,
][];

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10';

interface AddDeductionButtonProps {
  periodId: string;
}

/**
 * Add a deduction to a draft earnings period.
 *
 * Reuses ConfirmDialog with the form as its body rather than introducing a second
 * modal implementation — the confirm button is the submit, and the dialog already
 * handles focus trapping and inline errors.
 *
 * Description is required by the schema, so it is a required field here rather than
 * the optional one an earlier pass assumed.
 */
export function AddDeductionButton({ periodId }: AddDeductionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [deductionType, setDeductionType] = useState<DeductionType>('rental');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setError(null);
    setDeductionType('rental');
    setAmount('');
    setDescription('');
  };

  const handleConfirm = () => {
    setError(null);

    const parsedAmount = Number(amount);
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Введите сумму больше нуля.');
      return;
    }

    if (!description.trim()) {
      setError('Введите описание для этого удержания.');
      return;
    }

    startTransition(async () => {
      const result = await createDeductionAction({
        earnings_period_id: periodId,
        deduction_type: deductionType,
        amount: parsedAmount,
        description: description.trim(),
      });

      if (result.success) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Добавить удержание
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Добавить удержание"
        description="Удержания уменьшают сумму к выплате за этот период."
        confirmLabel="Добавить удержание"
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
      >
        <div className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="deduction_type">Тип</Label>
            <select
              id="deduction_type"
              value={deductionType}
              onChange={(event) =>
                setDeductionType(event.target.value as DeductionType)
              }
              className={SELECT_CLASS}
            >
              {DEDUCTION_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deduction_amount">Сумма</Label>
            <Input
              id="deduction_amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deduction_description">Описание</Label>
            <Textarea
              id="deduction_description"
              placeholder="За что это удержание?"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
