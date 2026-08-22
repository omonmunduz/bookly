/**
 * Bikes List Page
 *
 * Displays all bikes with filtering by status and search.
 * Quick actions: add bike, view details, change status.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';

import { requireServerUser } from '@/lib/supabase/session';
import { listBikesAction } from '@/app/actions/bikes';
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
import type { BikeFilters } from '@/lib/types/ebike';

export const metadata = {
  title: 'Bikes',
  description: 'Manage bike fleet',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function BikesPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireServerUser()]);

  const filters: BikeFilters = {
    status: params.status as any,
    search: params.search,
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bikes</h1>
          <p className="text-sm text-muted-foreground">Manage your bike fleet</p>
        </div>
        <Button asChild>
          <Link href="/bikes/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Bike
          </Link>
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by bike number or model..."
            className="pl-10"
            defaultValue={params.search}
            name="search"
          />
        </div>

        <StatusFilter currentStatus={params.status} />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <BikesTable filters={filters} />
      </Suspense>
    </div>
  );
}

function StatusFilter({ currentStatus }: { currentStatus?: string }) {
  const statuses = [
    { value: '', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'damaged', label: 'Damaged' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {statuses.map((status) => (
        <Link
          key={status.value}
          href={`/bikes${status.value ? `?status=${status.value}` : ''}`}
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

async function BikesTable({ filters }: { filters: BikeFilters }) {
  const result = await listBikesAction(filters);

  if (!result.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const bikes = result.data;

  if (bikes.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {filters.search || filters.status
            ? 'No bikes found matching your filters.'
            : 'No bikes yet. Add your first bike to get started.'}
        </p>
        {!filters.search && !filters.status && (
          <Button asChild className="mt-4">
            <Link href="/bikes/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Bike
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
            <TableHead>Bike Number</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Serial Number</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bikes.map((bike) => (
            <TableRow key={bike.id}>
              <TableCell className="font-medium">{bike.bike_number}</TableCell>
              <TableCell>{bike.model}</TableCell>
              <TableCell>
                <BikeStatusBadge status={bike.status} />
              </TableCell>
              <TableCell>{bike.serial_number || '—'}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/bikes/${bike.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BikeStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    available: 'default',
    assigned: 'secondary',
    maintenance: 'outline',
    damaged: 'destructive',
    retired: 'outline',
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
            <TableHead>Bike Number</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Serial Number</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
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
