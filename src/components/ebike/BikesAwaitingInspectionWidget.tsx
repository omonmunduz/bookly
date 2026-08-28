/**
 * Bikes Awaiting Inspection Widget
 *
 * Dashboard widget showing bikes in 'returned' status that need inspection.
 * Used primarily by mechanics to see their inspection queue.
 */

import Link from 'next/link';
import { ClipboardCheck, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Bike } from '@/lib/types/ebike';

interface BikesAwaitingInspectionWidgetProps {
  bikes: Bike[];
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export function BikesAwaitingInspectionWidget({ bikes }: BikesAwaitingInspectionWidgetProps) {
  if (bikes.length === 0) {
    return (
      <section
        aria-labelledby="inspection-queue-heading"
        className="rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="inspection-queue-heading" className="text-sm font-semibold">
            Bikes Awaiting Inspection
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">No bikes waiting for inspection</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="inspection-queue-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-warning" aria-hidden="true" />
          <h2 id="inspection-queue-heading" className="text-sm font-semibold">
            Bikes Awaiting Inspection
          </h2>
        </div>
        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          {bikes.length}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Bikes recently returned that need inspection
      </p>

      <ul className="mt-4 space-y-3">
        {bikes.slice(0, 5).map((bike) => (
          <li
            key={bike.id}
            className="flex items-start justify-between gap-3 rounded border border-border bg-muted/30 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">
                  {bike.bike_number}
                </span>
                {bike.model && (
                  <span className="text-xs text-muted-foreground truncate">
                    {bike.model}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>
                  Returned {getTimeAgo(new Date(bike.updated_at))}
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/maintenance/inspections/new?bikeId=${bike.id}`}>
                Inspect
              </Link>
            </Button>
          </li>
        ))}
      </ul>

      {bikes.length > 5 && (
        <div className="mt-4 text-center">
          <Button size="sm" variant="ghost" asChild className="text-xs">
            <Link href="/bikes?status=returned">
              View all {bikes.length} bikes
            </Link>
          </Button>
        </div>
      )}

      {bikes.length <= 5 && bikes.length > 0 && (
        <div className="mt-4">
          <Button size="sm" variant="outline" asChild className="w-full">
            <Link href="/bikes?status=returned">
              View All Returned Bikes
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
