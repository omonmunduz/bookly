import { Suspense } from 'react';
import Link from 'next/link';
import { Wallet, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';
import { getCourierBalanceAction, getCourierStatsAction } from '@/app/actions/courier-transactions';

interface CourierBalanceCardProps {
  courierId: string;
}

export function CourierBalanceCard({ courierId }: CourierBalanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Баланс
          </CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/couriers/${courierId}/transactions/new`}>
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <CardDescription>Текущий баланс курьера</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<BalanceSkeleton />}>
          <BalanceContent courierId={courierId} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function BalanceContent({ courierId }: { courierId: string }) {
  const [balanceResult, statsResult] = await Promise.all([
    getCourierBalanceAction(courierId),
    getCourierStatsAction(courierId),
  ]);

  if (!balanceResult.success || !statsResult.success) {
    return (
      <div className="text-sm text-muted-foreground">
        Не удалось загрузить баланс
      </div>
    );
  }

  const balance = balanceResult.data;
  const stats = statsResult.data;

  return (
    <div className="space-y-4">
      {/* Current Balance */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Текущий баланс</p>
        <p
          className={`text-3xl font-bold ${
            balance.balance < 0
              ? 'text-destructive'
              : balance.balance > 0
              ? 'text-green-600'
              : 'text-muted-foreground'
          }`}
        >
          {formatCurrency(balance.balance)}
        </p>
        {balance.balance < 0 && (
          <p className="text-xs text-muted-foreground mt-1">Курьер должен</p>
        )}
        {balance.balance > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Переплата</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            Списания
          </div>
          <p className="text-sm font-semibold text-destructive">
            {formatCurrency(stats.totalDebits)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Пополнения
          </div>
          <p className="text-sm font-semibold text-green-600">
            {formatCurrency(stats.totalCredits)}
          </p>
        </div>
      </div>

      {/* Transaction count */}
      <div className="text-center">
        <Link
          href={`/payouts?courier=${courierId}`}
          className="text-sm text-primary hover:underline"
        >
          Всего транзакций: {stats.transactionCount}
        </Link>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href={`#transactions`}>
            История
          </Link>
        </Button>
        <Button size="sm" className="flex-1" asChild>
          <Link href={`/couriers/${courierId}/transactions/new`}>
            Добавить
          </Link>
        </Button>
      </div>
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-8 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
