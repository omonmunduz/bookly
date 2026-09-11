/**
 * Courier Transactions Section
 *
 * Shows transaction history and activity log for a specific courier.
 * Displayed on the courier detail page for managers/admins.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionList } from '@/components/payouts/transaction-list';
import { Badge } from '@/components/ui/badge';
import { listTransactionsWithCourierAction } from '@/app/actions/courier-transactions';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

interface CourierTransactionsSectionProps {
  courierId: string;
  courierName: string;
}

export async function CourierTransactionsSection({
  courierId,
  courierName,
}: CourierTransactionsSectionProps) {
  const supabase = await createClient();

  // Fetch transactions
  const transactionsResult = await listTransactionsWithCourierAction({ courier_id: courierId, limit: 50 });
  const transactions = transactionsResult.success ? transactionsResult.data : [];

  // Fetch audit logs for this courier's transactions
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'transaction')
    .contains('metadata', { courier_name: courierName })
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <Card id="transactions">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>История транзакций</CardTitle>
            <CardDescription>
              Все операции по балансу курьера {courierName}
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href={`/couriers/${courierId}/transactions/new`}>
              <Plus className="h-4 w-4" />
              Добавить
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions">
              Транзакции ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              Журнал активности ({logs?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Нет транзакций для этого курьера
              </div>
            ) : (
              <TransactionList transactions={transactions} showCourier={false} />
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {!logs || logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>Пока нет записей в журнале активности</p>
                <p className="mt-2 text-xs">
                  Создайте транзакцию, чтобы увидеть записи здесь
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const metadata = log.metadata as any;
                  const isCreated = log.action === 'TRANSACTION_CREATED';
                  const isDeleted = log.action === 'TRANSACTION_DELETED';

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isCreated ? 'default' : isDeleted ? 'destructive' : 'outline'}
                          >
                            {isCreated ? 'Создано' : isDeleted ? 'Удалено' : log.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(log.created_at)}
                          </span>
                        </div>

                        <p className="font-medium">
                          {log.actor_name_snapshot}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({log.actor_role_snapshot})
                          </span>
                        </p>

                        {metadata && (
                          <div className="space-y-1 text-muted-foreground">
                            <p>
                              {metadata.direction === 'credit' ? '+ ' : '- '}
                              {metadata.amount} сом
                              {' · '}
                              {metadata.type?.replace(/_/g, ' ')}
                            </p>
                            {metadata.note && (
                              <p className="text-xs italic">"{metadata.note}"</p>
                            )}
                            {metadata.period_start && metadata.period_end && (
                              <p className="text-xs">
                                Период: {metadata.period_start} — {metadata.period_end}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {logs.length === 20 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Показано последние 20 записей
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
