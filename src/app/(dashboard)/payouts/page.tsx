import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import {
  listTransactionsWithCourierAction,
  getAllBalancesAction,
} from '@/app/actions/courier-transactions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import { EmptyState } from '@/components/shared/EmptyState';
import { TransactionListWithActions } from '@/components/payouts/transaction-list-with-actions';

export const metadata = {
  title: 'Выплаты',
  description: 'Управление балансами и транзакциями курьеров',
};

export default async function PayoutsPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Выплаты</h1>
          <p className="text-muted-foreground">
            Баланс и транзакции курьеров
          </p>
        </div>
        <Button asChild>
          <Link href="/payouts/new">
            <Plus className="h-4 w-4" />
            Новая транзакция
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <PayoutsContent />
      </Suspense>
    </div>
  );
}

async function PayoutsContent() {
  const [transactionsResult, balancesResult] = await Promise.all([
    listTransactionsWithCourierAction({ limit: 50 }),
    getAllBalancesAction(),
  ]);

  if (!transactionsResult.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{transactionsResult.error}</p>
      </div>
    );
  }

  const transactions = transactionsResult.data;
  const balances = balancesResult.success ? balancesResult.data : [];

  // Calculate summary stats
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);
  const totalDebits = transactions
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = transactions
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Общий баланс
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance < 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              По всем {balances.length} курьерам
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Списания</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalDebits)}
            </div>
            <p className="text-xs text-muted-foreground">
              Аренда, штрафы, ремонт
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Пополнения</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCredits)}
            </div>
            <p className="text-xs text-muted-foreground">
              Оплаты от курьеров
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Courier Balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Баланс курьеров</CardTitle>
            <CardDescription>
              Текущий баланс каждого курьера (отрицательный = долг)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {balances.slice(0, 10).map((balance) => (
                <Link
                  key={balance.courier_id}
                  href={`/couriers/${balance.courier_id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{balance.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {balance.courier_code} · {balance.transaction_count} транзакций
                    </p>
                  </div>
                  <div className={`text-lg font-semibold ${balance.balance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {formatCurrency(balance.balance)}
                  </div>
                </Link>
              ))}
            </div>
            {balances.length > 10 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Показано 10 из {balances.length} курьеров
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-10 w-10" />}
          title="Нет транзакций"
          description="Создайте первую транзакцию для отслеживания балансов курьеров."
          action={
            <Button asChild>
              <Link href="/payouts/new">
                <Plus className="h-4 w-4" />
                Новая транзакция
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Последние транзакции</CardTitle>
            <CardDescription>
              История операций по всем курьерам
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionListWithActions transactions={transactions} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
