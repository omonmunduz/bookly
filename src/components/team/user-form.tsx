'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createUserAction, updateUserAction } from '@/app/actions/users';
import type { User, UserRole } from '@/features/users/types';

interface UserFormProps {
  user?: User;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full system access - can manage users and settings',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Manage operations, earnings, and assignments',
  },
  {
    value: 'mechanic',
    label: 'Mechanic',
    description: 'Handle maintenance tasks and inspections',
  },
];

export function UserForm({ user }: UserFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'mechanic');

  const isEdit = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Full name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!isEdit && !email.trim()) {
      toast({
        title: 'Validation error',
        description: 'Email is required',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateUserAction(user.id, {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            role,
          })
        : await createUserAction({
            organization_id: '', // Set by the action
            email: email.trim(),
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            role,
          });

      if (result.success) {
        toast({
          title: 'Success',
          description: isEdit
            ? 'User updated successfully'
            : 'User created successfully',
        });
        router.push('/team');
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit User' : 'User Information'}</CardTitle>
          <CardDescription>
            {isEdit
              ? 'Update user details and role'
              : 'Enter the details for the new team member'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              disabled={isPending || isEdit}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed after creation
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isPending}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </Select>
          </div>

          {/* Role descriptions */}
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="mb-2 text-sm font-semibold">Role Permissions</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• <strong>Admin:</strong> Manage users, full access to all features</li>
              <li>• <strong>Manager:</strong> Manage operations, earnings, assignments, expenses</li>
              <li>• <strong>Mechanic:</strong> View and manage maintenance tasks only</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/team')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
