'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Pencil } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { MarkAsPaidButton } from '@/components/earnings/mark-as-paid-button';
import {
  EARNINGS_STATUS_LABELS,
  EARNINGS_STATUS_VARIANT,
} from '@/features/earnings/labels';
import type { EarningsPeriod } from '@/lib/types/ebike';

interface EarningsListProps {
  periods: EarningsPeriod[];
  courierNames: Map<string, string>;
}

export function EarningsList({ periods, courierNames }: EarningsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPeriods = useMemo(() => {
    if (!searchQuery.trim()) return periods;

    const query = searchQuery.toLowerCase();
    return periods.filter((period) => {
      const courierName = courierNames.get(period.courier_id)?.toLowerCase() || '';
      const periodStart = formatDate(period.period_start).toLowerCase();
      const periodEnd = formatDate(period.period_end).toLowerCase();
      const status = EARNINGS_STATUS_LABELS[period.status].toLowerCase();

      return (
        courierName.includes(query) ||
        periodStart.includes(query) ||
        periodEnd.includes(query) ||
        status.includes(query)
      );
    });
  }, [periods, courierNames, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Поиск по имени курьера, дате или статусу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Найдено {filteredPeriods.length} из {periods.length} периодов
        </p>
      )}

      {/* Earnings List */}
      {filteredPeriods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'Не найдено периодов, соответствующих поиску' : 'Нет периодов выплат'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPeriods.map((period) => (
            <Card key={period.id} className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-lg">
                      {courierNames.get(period.courier_id) ?? 'Курьер'}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(period.period_start)} – {formatDate(period.period_end)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={EARNINGS_STATUS_VARIANT[period.status]}>
                      {EARNINGS_STATUS_LABELS[period.status]}
                    </Badge>
                    <MarkAsPaidButton
                      periodId={period.id}
                      netPayout={period.net_payout}
                      courierName={courierNames.get(period.courier_id) ?? 'Курьер'}
                      status={period.status}
                      variant="icon"
                    />
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/earnings/${period.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Link href={`/earnings/${period.id}`} className="block">
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Общий доход</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(period.gross_earnings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Удержания</p>
                      <p className="text-lg font-semibold text-destructive">
                        -{formatCurrency(period.total_deductions)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Сумма к выплате</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(period.net_payout)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Оплачено</p>
                      <p className="text-lg font-semibold">
                        {period.paid_at ? formatDate(period.paid_at) : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
