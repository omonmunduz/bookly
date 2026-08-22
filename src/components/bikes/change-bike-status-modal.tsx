'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { updateBikeStatusAction } from '@/app/actions/bikes';
import type { Bike } from '@/lib/types/ebike';

interface ChangeBikeStatusModalProps {
  bike: {
    id: string;
    bike_number: string;
    status: Bike['status'];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Statuses a manager may set by hand.
 *
 * 'assigned' is deliberately absent: a bike becomes assigned only by creating an
 * assignment, and stops being assigned only by returning one. The service
 * rejects both transitions, so offering them here would be a dead end.
 */
const STATUS_OPTIONS: { value: Bike['status']; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10';

/**
 * Change a bike's status, recording an optional reason.
 *
 * The reason is stored against condition_notes — the bike table has no plain
 * notes column, and a status change is nearly always a statement about
 * condition.
 */
export function ChangeBikeStatusModal({
  bike,
  open,
  onOpenChange,
}: ChangeBikeStatusModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // An assigned bike has no legal manual target, so fall back to its own status
  // and let the blocking notice below explain why nothing can be picked.
  const [status, setStatus] = useState<Bike['status']>(
    bike.status === 'assigned' ? 'assigned' : bike.status
  );
  const [notes, setNotes] = useState('');

  const isAssigned = bike.status === 'assigned';

  const handleConfirm = () => {
    setError(null);

    if (status === bike.status) {
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await updateBikeStatusAction(bike.id, {
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

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
          setNotes('');
          setStatus(bike.status);
        }
      }}
      title="Change bike status"
      description={`Update the status of ${bike.bike_number}.`}
      confirmLabel="Update status"
      isPending={isPending}
      error={error}
      onConfirm={handleConfirm}
    >
      <div className="space-y-4 text-left">
        {isAssigned && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This bike is assigned. Return it before changing its status.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="bike_status">New status</Label>
          <select
            id="bike_status"
            value={status}
            disabled={isAssigned}
            onChange={(event) =>
              setStatus(event.target.value as Bike['status'])
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
          <Label htmlFor="bike_status_notes">Reason</Label>
          <Textarea
            id="bike_status_notes"
            placeholder="Why is the status changing?"
            rows={3}
            maxLength={500}
            value={notes}
            disabled={isAssigned}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Saved to the bike&apos;s condition notes.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
