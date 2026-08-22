'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { updateCourierStatusAction } from '@/app/actions/couriers';
import type { Courier } from '@/lib/types/ebike';

interface ChangeCourierStatusModalProps {
  courier: {
    id: string;
    full_name: string;
    courier_code: string;
    status: Courier['status'];
    hasActiveAssignment?: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: { value: Courier['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10';

/**
 * Change a courier's status, recording an optional reason.
 *
 * Deactivating a courier who still has a bike out is allowed but warned about:
 * the service does not block it, and the bike genuinely needs collecting, so the
 * warning is a reminder rather than an error.
 */
export function ChangeCourierStatusModal({
  courier,
  open,
  onOpenChange,
}: ChangeCourierStatusModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState<Courier['status']>(courier.status);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    setError(null);

    if (status === courier.status) {
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await updateCourierStatusAction(courier.id, {
        status,
        notes: notes.trim() ? notes.trim() : undefined,
      });

      if (result.success) {
        onOpenChange(false);
        setNotes('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const showActiveAssignmentWarning =
    courier.hasActiveAssignment &&
    courier.status === 'active' &&
    (status === 'inactive' || status === 'suspended');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
          setNotes('');
          setStatus(courier.status);
        }
      }}
      title="Change courier status"
      description={`Update the status of ${courier.full_name} (${courier.courier_code}).`}
      confirmLabel="Update status"
      isPending={isPending}
      error={error}
      onConfirm={handleConfirm}
    >
      <div className="space-y-4 text-left">
        {showActiveAssignmentWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This courier still has a bike out. Arrange its return — the status
              change will not do it for you.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="courier_status">New status</Label>
          <select
            id="courier_status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as Courier['status'])
            }
            className={SELECT_CLASS}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="courier_status_notes">Reason</Label>
          <Textarea
            id="courier_status_notes"
            placeholder="Why is the status changing?"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Saved to the courier&apos;s notes.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
