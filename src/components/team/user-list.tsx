'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Search, Mail, Phone, Pencil, UserX, UserCheck, Trash2, MailPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MoreVertical } from 'lucide-react';
import { ROLE_LABELS, ROLE_VARIANTS, ROLE_DESCRIPTIONS } from '@/features/users/labels';
import { deactivateUserAction, reactivateUserAction, deleteUserAction, resendInviteAction } from '@/app/actions/users';
import type { User } from '@/features/users/types';
import { useToast } from '@/hooks/use-toast';

interface UserListProps {
  users: User[];
}

export function UserList({ users }: UserListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const name = user.full_name.toLowerCase();
      const email = user.email.toLowerCase();
      const role = ROLE_LABELS[user.role].toLowerCase();

      return name.includes(query) || email.includes(query) || role.includes(query);
    });
  }, [users, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredUsers.length} of {users.length} members
        </p>
      )}

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No members match your search' : 'No team members found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className={`transition-colors hover:bg-accent/50 ${
                !user.is_active ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <Badge variant={ROLE_VARIANTS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                      {!user.is_active && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {ROLE_DESCRIPTIONS[user.role]}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <UserActions user={user} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UserActions({ user }: { user: User }) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDeactivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await deactivateUserAction(user.id);

      if (!result.success) {
        setError(result.error);
      } else {
        setDeactivateDialogOpen(false);
        toast({
          title: 'User deactivated',
          description: `${user.full_name} has been deactivated.`,
        });
      }
    });
  };

  const handleReactivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await reactivateUserAction(user.id);

      if (!result.success) {
        setError(result.error);
      } else {
        setReactivateDialogOpen(false);
        toast({
          title: 'User reactivated',
          description: `${user.full_name} has been reactivated.`,
        });
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAction(user.id);

      if (!result.success) {
        setError(result.error);
      } else {
        setDeleteDialogOpen(false);
        toast({
          title: 'User deleted',
          description: `${user.full_name} has been permanently deleted.`,
        });
      }
    });
  };

  const handleResendInvite = () => {
    setError(null);
    startTransition(async () => {
      const result = await resendInviteAction(user.id);

      if (!result.success) {
        setError(result.error);
      } else {
        setResendDialogOpen(false);
        toast({
          title: 'Invitation resent',
          description: `A new invitation email has been sent to ${user.email}.`,
        });
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/team/${user.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit user
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResendDialogOpen(true)}>
            <MailPlus className="mr-2 h-4 w-4" />
            Resend invite
          </DropdownMenuItem>
          {user.is_active ? (
            <DropdownMenuItem onClick={() => setDeactivateDialogOpen(true)}>
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setReactivateDialogOpen(true)}>
              <UserCheck className="mr-2 h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Deactivate user"
        description={`Are you sure you want to deactivate ${user.full_name}? They will lose access to the system but their data will be preserved.`}
        confirmLabel="Deactivate"
        destructive
        isPending={isPending}
        error={error}
        onConfirm={handleDeactivate}
      />

      {/* Reactivate Confirmation Dialog */}
      <ConfirmDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        title="Reactivate user"
        description={`Are you sure you want to reactivate ${user.full_name}? They will regain access to the system.`}
        confirmLabel="Reactivate"
        isPending={isPending}
        error={error}
        onConfirm={handleReactivate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete user permanently"
        description={`Are you sure you want to permanently delete ${user.full_name}? This action cannot be undone. All their data and history will be removed.`}
        confirmLabel="Delete permanently"
        destructive
        isPending={isPending}
        error={error}
        onConfirm={handleDelete}
      >
        <div className="rounded-md bg-destructive/10 p-3 text-sm">
          <p className="font-semibold text-destructive">Warning: This action is irreversible!</p>
          <p className="mt-1 text-muted-foreground">
            Consider deactivating the user instead to preserve their data.
          </p>
        </div>
      </ConfirmDialog>

      {/* Resend Invite Confirmation Dialog */}
      <ConfirmDialog
        open={resendDialogOpen}
        onOpenChange={setResendDialogOpen}
        title="Resend invitation"
        description={`Send a new invitation email to ${user.email}? This will generate a fresh link if their previous invite expired.`}
        confirmLabel="Resend invite"
        isPending={isPending}
        error={error}
        onConfirm={handleResendInvite}
      />
    </>
  );
}
