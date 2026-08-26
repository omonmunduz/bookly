import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireMinimumRole } from '@/features/auth/guards';
import { Button } from '@/components/ui/button';
import { UserForm } from '@/components/team/user-form';

export const metadata = {
  title: 'Add Team Member',
  description: 'Add a new team member',
};

export default async function NewUserPage() {
  await requireMinimumRole('admin');

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Team Member</h1>
          <p className="text-muted-foreground">
            Create a new user account and assign a role
          </p>
        </div>
      </div>

      <UserForm />
    </div>
  );
}
