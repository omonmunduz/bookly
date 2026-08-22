/**
 * Couriers List Page
 *
 * Displays all couriers with filtering by status and search.
 * Shows active assignments and quick actions.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Search, Phone } from 'lucide-react';

import { requireServerUser } from '@/lib/supabase/session';
import { listCouriersAction } from '@/app/actions/couriers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CourierFilters } from '@/lib/types/ebike';

export const metadata = {
  title: 'Couriers',
  description: 'Manage couriers',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function CouriersPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireServerUser()]);

  const filters: CourierFilters = {
    status: params.status as any,
    search: params.search,
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Couriers</h1>
          <p className="text-sm text-muted-foreground">
            Manage courier profiles and assignments
          </p>
        </div>
        <Button asChild>
          <Link href="/couriers/new">
            <Plus className="mr-2 h-4 w-4" />
            New Courier
          </Link>
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, code, or phone..."
            className="pl-10"
            defaultValue={params.search}
            name="search"
          />
        </div>

        <StatusFilter currentStatus={params.status} />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <CouriersTable filters={filters} />
      </Suspense>
    </div>
  );
}

function StatusFilter({ currentStatus }: { currentStatus?: string }) {
  const statuses = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {statuses.map((status) => (
        <Link
          key={status.value}
          href={`/couriers${status.value ? `?status=${status.value}` : ''}`}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            (currentStatus || '') === status.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {status.label}
        </Link>
      ))}
    </div>
  );
}

async function CouriersTable({ filters }: { filters: CourierFilters }) {
  const result = await listCouriersAction(filters);

  if (!result.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const couriers = result.data;

  if (couriers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {filters.search || filters.status
            ? 'No couriers found matching your filters.'
            : 'No couriers yet. Add your first courier to get started.'}
        </p>
        {!filters.search && !filters.status && (
          <Button asChild className="mt-4">
            <Link href="/couriers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Courier
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Courier Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {couriers.map((courier) => (
            <TableRow key={courier.id}>
              <TableCell className="font-medium">{courier.courier_code}</TableCell>
              <TableCell>{courier.full_name}</TableCell>
              <TableCell>
                <a
                  href={`tel:${courier.phone}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {courier.phone}
                </a>
              </TableCell>
              <TableCell>
                <CourierStatusBadge status={courier.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/couriers/${courier.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CourierStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    inactive: 'secondary',
    suspended: 'destructive',
  };

  return (
    <Badge variant={variants[status] || 'outline'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Courier Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell className="text-right">
                <div className="ml-auto h-8 w-16 animate-pulse rounded bg-muted" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
