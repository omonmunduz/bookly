import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getUserAction } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { UserForm } from '@/components/team/user-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
  const [{ id }] = await Promise.all([params, requireMinimumRole('admin')]);

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <EditUserContent userId={id} />
      </Suspense>
    </div>
  );
}

async function EditUserContent({ userId }: { userId: string }) {
  const result = await getUserAction(userId);

  if (!result.success || !result.data) {
    notFound();
  }

  const user = result.data;

  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Редактировать Team Member</h1>
          <p className="text-muted-foreground">
            Update user details and role
          </p>
        </div>
      </div>

      <UserForm user={user} />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
