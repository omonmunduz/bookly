'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { markEarningsPeriodAsPaidAction } from '@/app/actions/earnings';
import { formatCurrency } from '@/lib/utils/format';

interface MarkAsPaidButtonProps {
  periodId: string;
  netPayout: number;
  courierName: string;
  /** Show as a compact icon button (for list view) or full button (for edit page) */
  variant?: 'icon' | 'full';
  /** Current status - button is disabled if already paid */
  status: 'draft' | 'approved' | 'paid';
}

export function MarkAsPaidButton({
  periodId,
  netPayout,
  courierName,
  variant = 'full',
  status,
}: MarkAsPaidButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleMarkAsPaid = () => {
    startTransition(async () => {
      const result = await markEarningsPeriodAsPaidAction(periodId);

      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Период выплат отмечен как оплаченный',
        });
        setOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Ошибка',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const isPaid = status === 'paid';

  if (variant === 'icon') {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPaid || isPending}
          title={isPaid ? 'Уже оплачено' : 'Отметить как оплачено'}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <Check className="h-4 w-4" />
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Отметить как оплачено?"
          description={`Подтвердите, что курьеру ${courierName} была выплачена сумма ${formatCurrency(netPayout)} за этот период. Это действие нельзя отменить. Период будет заблокирован, и дальнейшие изменения будут невозможны.`}
          confirmLabel="Подтвердить оплату"
          isPending={isPending}
          onConfirm={handleMarkAsPaid}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="default"
        disabled={isPaid || isPending}
        onClick={() => setOpen(true)}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Check className="h-4 w-4" />
        {isPaid ? 'Уже оплачено' : 'Отметить как оплачено'}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Отметить как оплачено?"
        description={`Подтвердите, что курьеру ${courierName} была выплачена сумма ${formatCurrency(netPayout)} за этот период. Это действие нельзя отменить. Период будет заблокирован, и дальнейшие изменения будут невозможны.`}
        confirmLabel="Подтвердить оплату"
        isPending={isPending}
        onConfirm={handleMarkAsPaid}
      />
    </>
  );
}
