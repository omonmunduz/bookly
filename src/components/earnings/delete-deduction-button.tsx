'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteDeductionAction } from '@/app/actions/earnings';

interface DeleteDeductionButtonProps {
  deductionId: string;
}

/**
 * Remove a deduction from a draft earnings period, behind a confirmation.
 *
 * Errors render inside the dialog rather than through alert(): a failure here is
 * usually the period having been approved in another tab, which is worth reading.
 */
export function DeleteDeductionButton({
  deductionId,
}: DeleteDeductionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);

    startTransition(async () => {
      const result = await deleteDeductionAction(deductionId);

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
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Удалить удержание"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Удалить удержание"
        description="Это удалит удержание из периода. Действие нельзя отменить."
        confirmLabel="Удалить"
        destructive
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
      />
    </>
  );
}
