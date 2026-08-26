'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { updateEarningsPeriodAction } from '@/app/actions/earnings';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { AddDeductionButton } from '@/components/earnings/add-deduction-button';
import { DeleteDeductionButton } from '@/components/earnings/delete-deduction-button';
import {
  DEDUCTION_TYPE_LABELS,
  EARNINGS_STATUS_LABELS,
  EARNINGS_STATUS_VARIANT,
} from '@/features/earnings/labels';
import type { EarningsPeriodWithDeductions } from '@/lib/types/ebike';

interface EditEarningsFormProps {
  period: EarningsPeriodWithDeductions;
}

export function EditEarningsForm({ period }: EditEarningsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [grossEarnings, setGrossEarnings] = useState(String(period.gross_earnings));
  const [notes, setNotes] = useState(period.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const earnings = parseFloat(grossEarnings);
    if (isNaN(earnings) || earnings < 0) {
      toast({
        title: 'Invalid amount',
        description: 'Gross earnings must be a valid positive number',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await updateEarningsPeriodAction(period.id, {
        gross_earnings: earnings,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Earnings period updated successfully',
        });
        router.push(`/earnings/${period.id}`);
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

  const totalDeductions = period.deductions.reduce(
    (sum, deduction) => sum + deduction.amount,
    0
  );
  const netPayout = parseFloat(grossEarnings || '0') - totalDeductions;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Period Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Period Information</CardTitle>
              <CardDescription>
                {formatDate(period.period_start)} – {formatDate(period.period_end)}
              </CardDescription>
            </div>
            <Badge variant={EARNINGS_STATUS_VARIANT[period.status]}>
              {EARNINGS_STATUS_LABELS[period.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Courier</p>
              <p className="text-lg font-semibold">{period.courier.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Courier Code</p>
              <p className="text-lg font-semibold">{period.courier.courier_code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earnings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings</CardTitle>
          <CardDescription>Update gross earnings and notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gross_earnings">Gross Earnings</Label>
            <Input
              id="gross_earnings"
              type="number"
              step="0.01"
              min="0"
              value={grossEarnings}
              onChange={(e) => setGrossEarnings(e.target.value)}
              placeholder="0.00"
              required
              disabled={period.status === 'paid'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this earnings period..."
              rows={3}
              disabled={period.status === 'paid'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Deductions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deductions</CardTitle>
              <CardDescription>
                {period.deductions.length} deduction{period.deductions.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {period.status === 'draft' && (
              <AddDeductionButton periodId={period.id} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {period.deductions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No deductions for this period</p>
              {period.status === 'draft' && (
                <p className="text-sm mt-2">Click "Add deduction" to get started</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {period.status === 'draft' && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.deductions.map((deduction) => (
                  <TableRow key={deduction.id}>
                    <TableCell>
                      {DEDUCTION_TYPE_LABELS[deduction.deduction_type]}
                    </TableCell>
                    <TableCell>{deduction.description}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(deduction.amount)}
                    </TableCell>
                    {period.status === 'draft' && (
                      <TableCell>
                        <DeleteDeductionButton deductionId={deduction.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Gross Earnings</span>
            <span className="text-xl font-semibold">
              {formatCurrency(parseFloat(grossEarnings || '0'))}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Total Deductions</span>
            <span className="text-xl font-semibold text-destructive">
              -{formatCurrency(totalDeductions)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-semibold">Net payout</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(netPayout)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/earnings/${period.id}`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || period.status === 'paid'}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {period.status === 'paid' && (
        <p className="text-sm text-muted-foreground text-center">
          This period has been marked as paid and cannot be edited.
        </p>
      )}
    </form>
  );
}
