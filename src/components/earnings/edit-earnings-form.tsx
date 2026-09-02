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
import { AddIncomeButton } from '@/components/earnings/add-income-button';
import { DeleteIncomeButton } from '@/components/earnings/delete-income-button';
import { AddDeductionButton } from '@/components/earnings/add-deduction-button';
import { DeleteDeductionButton } from '@/components/earnings/delete-deduction-button';
import { MarkAsPaidButton } from '@/components/earnings/mark-as-paid-button';
import { EarningsActivityLog } from '@/components/earnings/activity-log';
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

  const [notes, setNotes] = useState(period.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateEarningsPeriodAction(period.id, {
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Период выплат обновлен успешно',
        });
        router.push(`/earnings/${period.id}`);
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

  const totalIncome = period.income_entries.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
  const totalDeductions = period.deductions.reduce(
    (sum, deduction) => sum + deduction.amount,
    0
  );
  const netPayout = totalIncome - totalDeductions;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Period Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Информация о периоде</CardTitle>
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
              <p className="text-sm text-muted-foreground">Курьер</p>
              <p className="text-lg font-semibold">{period.courier.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Код курьера</p>
              <p className="text-lg font-semibold">{period.courier.courier_code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earnings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Записи дохода</CardTitle>
              <CardDescription>
                {period.income_entries.length} entr{period.income_entries.length !== 1 ? 'ies' : 'y'}
              </CardDescription>
            </div>
            {period.status === 'draft' && (
              <AddIncomeButton periodId={period.id} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {period.income_entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет записей дохода для этого периода</p>
              {period.status === 'draft' && (
                <p className="text-sm mt-2">Нажмите "Добавить доход" для начала</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Примечания</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  {period.status === 'draft' && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.income_entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell>{entry.notes || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    {period.status === 'draft' && (
                      <TableCell>
                        <DeleteIncomeButton incomeId={entry.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes Card */}
      <Card>
        <CardHeader>
          <CardTitle>Примечания</CardTitle>
          <CardDescription>Optional notes about this period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Примечания (необязательно)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Добавьте дополнительные примечания об этом периоде выплат..."
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
              <CardTitle>Удержания</CardTitle>
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
              <p>Нет удержаний для этого периода</p>
              {period.status === 'draft' && (
                <p className="text-sm mt-2">Нажмите "Добавить удержание" для начала</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
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
          <CardTitle>Итоговая сводка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Всего доход</span>
            <span className="text-xl font-semibold">
              {formatCurrency(totalIncome)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Всего удержаний</span>
            <span className="text-xl font-semibold text-destructive">
              -{formatCurrency(totalDeductions)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-semibold">Сумма к выплате</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(netPayout)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <EarningsActivityLog activities={period.activity} />

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
        <MarkAsPaidButton
          periodId={period.id}
          netPayout={netPayout}
          courierName={period.courier.full_name}
          status={period.status}
          variant="full"
        />
      </div>

      {period.status === 'paid' && (
        <p className="text-sm text-muted-foreground text-center">
          This period has been marked as paid and cannot be edited.
        </p>
      )}
    </form>
  );
}
