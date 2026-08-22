'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateEarningsPeriodStatusAction } from '@/app/actions/earnings';
import type { EarningsPeriodWithDeductions, EarningsStatus } from '@/lib/types/ebike';

interface ChangeEarningsStatusButtonProps {
  period: EarningsPeriodWithDeductions;
}

/**
 * The moves available from each status.
 *
 * Rendered as plain buttons rather than a dropdown: no status has more than two
 * transitions, so a menu would add a click to reach what fits inline. Paid is
 * terminal — the period is a historical record once money has moved.
 */
const TRANSITIONS: Record<
  EarningsStatus,
  { value: EarningsStatus; label: string; icon: typeof Check }[]
> = {
  draft: [{ value: 'approved', label: 'Approve', icon: Check }],
  approved: [
    { value: 'paid', label: 'Mark as paid', icon: Coins },
    { value: 'draft', label: 'Move to draft', icon: Clock },
  ],
  paid: [],
};

export function ChangeEarningsStatusButton({
  period,
}: ChangeEarningsStatusButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const transitions = TRANSITIONS[period.status];

  if (transitions.length === 0) {
    return null;
  }

  const handleStatusChange = (status: EarningsStatus) => {
    setError(null);

    startTransition(async () => {
      const result = await updateEarningsPeriodStatusAction(period.id, status);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {transitions.map((transition, index) => {
          const Icon = transition.icon;

          return (
            <Button
              key={transition.value}
              // The first move is the expected one; the rest are corrections.
              variant={index === 0 ? 'default' : 'outline'}
              onClick={() => handleStatusChange(transition.value)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {transition.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
