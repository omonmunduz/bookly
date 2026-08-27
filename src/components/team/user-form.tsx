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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isEdit = !!user;

  // Generate a random password
  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let generatedPassword = '';
    for (let i = 0; i < length; i++) {
      generatedPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(generatedPassword);
    setShowPassword(true);
  };

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

    if (!isEdit && !password.trim()) {
      toast({
        title: 'Validation error',
        description: 'Password is required',
        variant: 'destructive',
      });
      return;
    }

    if (!isEdit && password.length < 8) {
      toast({
        title: 'Validation error',
        description: 'Password must be at least 8 characters',
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
            email: email.trim(),
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            role,
            password: password.trim(),
          });

      if (result.success) {
        toast({
          title: 'Success',
          description: isEdit
            ? 'User updated successfully'
            : `User created! Share these credentials: Email: ${email}, Password: ${password}`,
          duration: 10000, // Show for 10 seconds so admin can copy
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
          <CardTitle>{isEdit ? 'Edit User' : 'Add Team Member'}</CardTitle>
          <CardDescription>
            {isEdit
              ? 'Update user details and role'
              : 'Create a new user account. You will set their initial password and share it with them.'}
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

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  disabled={isPending}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  disabled={isPending}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You will share this password with the team member. They can change it after logging in.
              </p>
            </div>
          )}

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
