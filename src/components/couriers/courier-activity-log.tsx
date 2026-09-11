/**
 * Courier Activity Log Component
 *
 * Shows audit trail for transaction operations on this courier.
 * Displayed on the courier detail page for managers/admins.
 */

import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { History } from 'lucide-react';

interface CourierActivityLogProps {
  courierId: string;
  courierName: string;
}

export async function CourierActivityLog({
  courierId,
  courierName,
}: CourierActivityLogProps) {
  const supabase = await createClient();

  // Fetch audit logs for this courier's transactions
  // We need to filter by courier name in metadata since audit logs don't have courier_id
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'transaction')
    .contains('metadata', { courier_name: courierName })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Failed to fetch courier activity logs:', error);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <CardTitle>Журнал активности</CardTitle>
        </div>
        <CardDescription>
          История операций с транзакциями этого курьера
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Не удалось загрузить журнал активности</p>
        ) : !logs || logs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>Пока нет записей в журнале активности</p>
            <p className="mt-2 text-xs">
              Создайте транзакцию, чтобы увидеть записи здесь
            </p>
          </div>
        ) : (
          <>
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
            </div>

            {logs.length === 20 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Показано последние 20 записей
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
