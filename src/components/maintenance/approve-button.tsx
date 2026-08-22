'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { approveMaintenanceAction } from '@/app/actions/maintenance';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ApproveMaintenanceButtonProps {
  recordId: string;
}

/**
 * Approve a maintenance record, behind a confirmation prompt.
 *
 * Approval is one-way — the service refuses to re-approve — so the prompt exists
 * to make that finality explicit before the write, and errors render inside the
 * still-open dialog rather than vanishing with it.
 */
export function ApproveMaintenanceButton({
  recordId,
}: ApproveMaintenanceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);

    startTransition(async () => {
      const result = await approveMaintenanceAction({ maintenance_id: recordId });

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
      <Button onClick={() => setOpen(true)}>
        <Check className="h-4 w-4" />
        Approve
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Approve maintenance record"
        description="This marks the record as approved and cannot be undone."
        confirmLabel="Approve"
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
      />
    </>
  );
}
