import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EarningsActivityWithActor } from '@/lib/types/ebike';

interface EarningsActivityLogProps {
  activities: EarningsActivityWithActor[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  period_created: 'Period Created',
  period_updated: 'Period Updated',
  period_deleted: 'Period Deleted',
  status_changed: 'Status Changed',
  marked_as_paid: 'Marked as Paid',
  income_added: 'Income Added',
  income_deleted: 'Income Deleted',
  deduction_added: 'Deduction Added',
  deduction_deleted: 'Deduction Deleted',
};

function formatActivityDetails(
  activityType: string,
  details: Record<string, any> | null
): string {
  if (!details) return '';

  switch (activityType) {
    case 'income_added':
      return `Added ${formatCurrency(details.amount)}${details.notes ? ` — ${details.notes}` : ''}`;
    case 'income_deleted':
      return `Deleted ${formatCurrency(details.amount)}${details.notes ? ` — ${details.notes}` : ''}`;
    case 'deduction_added':
      return `Added ${details.type} deduction: ${formatCurrency(details.amount)} — ${details.description}`;
    case 'deduction_deleted':
      return `Deleted ${details.type} deduction: ${formatCurrency(details.amount)} — ${details.description}`;
    case 'status_changed':
      return `Changed from ${details.from} to ${details.to}`;
    case 'marked_as_paid':
      return `Paid ${formatCurrency(details.amount)}`;
    case 'period_created':
      return 'Created earnings period';
    case 'period_updated':
      return details.field ? `Updated ${details.field}` : 'Updated period';
    default:
      return '';
  }
}

export function EarningsActivityLog({ activities }: EarningsActivityLogProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>No activity recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>
          Complete audit trail of all actions on this earnings period
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
                  by {activity.actor.full_name} ({activity.actor.email})
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
