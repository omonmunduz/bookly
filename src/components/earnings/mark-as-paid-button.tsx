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
          title: 'Success',
          description: 'Earnings period marked as paid',
        });
        setOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Error',
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
          title={isPaid ? 'Already paid' : 'Mark as paid'}
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
          title="Mark as Paid?"
          description={`Confirm that ${courierName} has been paid ${formatCurrency(netPayout)} for this period. This action cannot be undone. The period will be locked and no further changes can be made.`}
          confirmLabel="Confirm Payment"
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
        {isPaid ? 'Already Paid' : 'Mark as Paid'}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Mark as Paid?"
        description={`Confirm that ${courierName} has been paid ${formatCurrency(netPayout)} for this period. This action cannot be undone. The period will be locked and no further changes can be made.`}
        confirmLabel="Confirm Payment"
        isPending={isPending}
        onConfirm={handleMarkAsPaid}
      />
    </>
  );
}
