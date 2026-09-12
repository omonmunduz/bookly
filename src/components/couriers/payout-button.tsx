'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { payoutCourierBalanceAction } from '@/app/actions/courier-transactions';
import { formatCurrency } from '@/lib/utils/format';

interface PayoutButtonProps {
  courierId: string;
  courierName: string;
  balance: number;
}

export function PayoutButton({ courierId, courierName, balance }: PayoutButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Only show button if there's a positive balance to pay out
  if (balance <= 0) {
    return null;
  }

  const handlePayout = () => {
    setError(null);
    startTransition(async () => {
      const result = await payoutCourierBalanceAction(courierId);

      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="flex-1 bg-green-600 hover:bg-green-700"
        onClick={() => setOpen(true)}
      >
        <DollarSign className="mr-1 h-4 w-4" />
        Выплатить
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Подтвердите выплату"
        description={`Вы собираетесь выплатить баланс курьера ${courierName}`}
        confirmLabel="Подтвердить выплату"
        cancelLabel="Отмена"
        isPending={isPending}
        error={error}
        onConfirm={handlePayout}
      >
        <div className="rounded-lg border p-4 text-center">
          <p className="text-sm text-muted-foreground">Сумма к выплате</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(balance)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            После выплаты баланс курьера будет обнулен.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
