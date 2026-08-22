/**
 * Rental Plans List Page
 *
 * The price and duration options a bike can be assigned under, split into the
 * plans available for new assignments and the retired ones kept for history.
 *
 * Retired plans stay visible because assignments still reference them by name,
 * and someone reading an old assignment may want to see the plan behind it.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Coins } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import { listRentalPlansAction } from '@/app/actions/rental-plans';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils/format';
import type { RentalPlan } from '@/lib/types/ebike';

export const metadata = {
  title: 'Rental Plans',
  description: 'Manage pricing plans for bike rentals',
};

export default async function RentalPlansPage() {
  await requireActiveUser();

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Rental plans
          </h1>
          <p className="text-sm text-muted-foreground">
            Pricing and terms for bike rentals
          </p>
        </div>
        <Button asChild>
          <Link href="/rental-plans/new">
            <Plus className="h-4 w-4" />
            New plan
          </Link>
        </Button>
      </header>

      <Suspense fallback={<PlanGridSkeleton />}>
        <RentalPlansList />
      </Suspense>
    </div>
  );
}

async function RentalPlansList() {
  const result = await listRentalPlansAction();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const plans = result.data;

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No rental plans yet. A bike cannot be assigned without one.
        </p>
        <Button asChild className="mt-4">
          <Link href="/rental-plans/new">
            <Plus className="h-4 w-4" />
            Create first plan
          </Link>
        </Button>
      </div>
    );
  }

  const activePlans = plans.filter((plan) => plan.is_active);
  const retiredPlans = plans.filter((plan) => !plan.is_active);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Available for new assignments
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {activePlans.length}
          </span>
        </h2>
        {activePlans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Every plan is retired, so no new assignments can be created.
              Reactivate one or add a new plan.
            </p>
          </div>
        )}
      </section>

      {retiredPlans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Retired
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {retiredPlans.length}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Hidden from new assignments. Assignments already using them are
            unaffected.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {retiredPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: RentalPlan }) {
  const unit =
    plan.duration_value === 1
      ? plan.duration_unit.slice(0, -1)
      : plan.duration_unit;

  return (
    <Card className={plan.is_active ? undefined : 'bg-muted/30'}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            {plan.is_active ? (
              <Badge>Active</Badge>
            ) : (
              <Badge variant="secondary">Retired</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/rental-plans/${plan.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" />
            Price
          </span>
          <span className="text-xl font-bold">
            {formatMoney(plan.price)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Duration
          </span>
          <span className="font-medium">
            {plan.duration_value} {unit}
          </span>
        </div>

        {plan.description && (
          <p className="line-clamp-2 border-t border-border pt-3 text-sm text-muted-foreground">
            {plan.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-14 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
