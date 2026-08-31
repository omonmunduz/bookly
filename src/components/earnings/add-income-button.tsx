'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addIncomeAction } from '@/app/actions/earnings';

interface AddIncomeButtonProps {
  periodId: string;
}

export function AddIncomeButton({ periodId }: AddIncomeButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddIncome = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Income amount must be greater than zero',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await addIncomeAction({
        earnings_period_id: periodId,
        amount: numAmount,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Income added successfully',
        });
        setOpen(false);
        setAmount('');
        setNotes('');
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

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4" />
        Add Income
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Add Income"
        confirmLabel="Add Income"
        isPending={isPending}
        onConfirm={handleAddIncome}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Week 1 earnings, Bonus payment..."
              rows={3}
              disabled={isPending}
            />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
