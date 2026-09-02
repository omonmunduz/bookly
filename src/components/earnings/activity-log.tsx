import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EarningsActivityWithActor } from '@/lib/types/ebike';

interface EarningsActivityLogProps {
  activities: EarningsActivityWithActor[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  period_created: 'Период создан',
  period_updated: 'Период обновлен',
  period_deleted: 'Период удален',
  status_changed: 'Статус изменен',
  marked_as_paid: 'Отмечен как оплачено',
  income_added: 'Доход добавлен',
  income_deleted: 'Доход удален',
  deduction_added: 'Удержание добавлено',
  deduction_deleted: 'Удержание удалено',
};

function formatActivityDetails(
  activityType: string,
  details: Record<string, any> | null
): string {
  if (!details) return '';

  switch (activityType) {
    case 'income_added':
      return `Добавлено ${formatCurrency(details.amount)}${details.notes ? ` — ${details.notes}` : ''}`;
    case 'income_deleted':
      return `Удалено ${formatCurrency(details.amount)}${details.notes ? ` — ${details.notes}` : ''}`;
    case 'deduction_added':
      return `Добавлено удержание ${details.type}: ${formatCurrency(details.amount)} — ${details.description}`;
    case 'deduction_deleted':
      return `Удалено удержание ${details.type}: ${formatCurrency(details.amount)} — ${details.description}`;
    case 'status_changed':
      return `Изменено с ${details.from} на ${details.to}`;
    case 'marked_as_paid':
      return `Оплачено ${formatCurrency(details.amount)}`;
    case 'period_created':
      return 'Создан период выплат';
    case 'period_updated':
      return details.field ? `Обновлено поле: ${details.field}` : 'Обновлен период';
    default:
      return '';
  }
}

export function EarningsActivityLog({ activities }: EarningsActivityLogProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История действий</CardTitle>
          <CardDescription>Действия пока не записаны</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История действий</CardTitle>
        <CardDescription>
          Полный журнал всех действий с этим периодом выплат
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 border-l-2 border-muted pl-4 pb-4 last:pb-0"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {ACTIVITY_LABELS[activity.activity_type] || activity.activity_type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(activity.created_at)}
                  </span>
                </div>
                <p className="text-sm">
                  {formatActivityDetails(activity.activity_type, activity.details)}
                </p>
                <p className="text-xs text-muted-foreground">
                  пользователем {activity.actor.full_name} ({activity.actor.email})
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
