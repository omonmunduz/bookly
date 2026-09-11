/**
 * Audit Logs Page
 *
 * Shows audit trail for managers and admins.
 */

import { requireMinimumRole } from '@/features/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Audit Logs',
  description: 'View system audit trail',
};

export default async function AuditLogsPage() {
  await requireMinimumRole('manager');

  const supabase = await createClient();

  // Fetch recent audit logs
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Audit Logs</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          System activity trail
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Last {logs?.length || 0} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {log.actor_name_snapshot} ({log.actor_role_snapshot})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {log.entity_type}: {log.entity_name_snapshot}
                    </p>
                    {log.metadata && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
