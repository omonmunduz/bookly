import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Users, ShieldCheck } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { listUsersAction } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserList } from '@/components/team/user-list';

export const metadata = {
  title: 'Команда',
  description: 'Управление участниками команды и ролями',
};

export default async function TeamPage() {
  await requireMinimumRole('manager');

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Команда</h1>
          <p className="text-muted-foreground">
            Управление участниками команды и их ролями
          </p>
        </div>
        <Button asChild>
          <Link href="/team/new">
            <Plus className="h-4 w-4" />
            Добавить участника
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <TeamContent />
      </Suspense>
    </div>
  );
}

async function TeamContent() {
  const result = await listUsersAction();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const users = result.data;

  // Group users by role for summary cards
  const usersByRole = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeUsers = users.filter((u) => u.is_active).length;
  const inactiveUsers = users.length - activeUsers;

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего участников</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeUsers} активных, {inactiveUsers} неактивных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Администраторы</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.admin || 0}</div>
            <p className="text-xs text-muted-foreground">Полный доступ к системе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Менеджеры</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.manager || 0}</div>
            <p className="text-xs text-muted-foreground">Operations & earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mechanics</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersByRole.mechanic || 0}</div>
            <p className="text-xs text-muted-foreground">Maintenance tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      {users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No team members"
          description="Add your first team member to get started."
          action={
            <Button asChild>
              <Link href="/team/new">
                <Plus className="h-4 w-4" />
                Add team member
              </Link>
            </Button>
          }
        />
      ) : (
        <UserList users={users} />
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
