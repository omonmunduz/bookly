'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { returnBikeAction } from '@/app/actions/assignments';

interface ReturnBikeFormProps {
  assignmentId: string;
  /** Shown in the submit warning so the consequence is concrete. */
  isOverdue: boolean;
}

/**
 * Close an assignment by recording the bike's condition on return.
 *
 * Condition is required because it is the counterpart to the condition recorded
 * at assignment, and it is what a mechanic reads when deciding whether the bike
 * needs work before going out again. Mechanics may submit this, so the action
 * behind it does not require a manager role.
 */
export function ReturnBikeForm({
  assignmentId,
  isOverdue,
}: ReturnBikeFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const condition = (formData.get('condition_at_return') as string)?.trim();
    const notes = (formData.get('return_notes') as string)?.trim();

    startTransition(async () => {
      const result = await returnBikeAction({
        assignment_id: assignmentId,
        condition_at_return: condition,
        return_notes: notes ? notes : null,
      });

      if (result.success) {
        router.push(`/assignments/${assignmentId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="condition_at_return">
          Condition on return <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="condition_at_return"
          name="condition_at_return"
          required
          rows={5}
          maxLength={500}
          placeholder="Battery health, tires, brakes, lights, frame — and any new damage"
        />
        <p className="text-xs text-muted-foreground">
          Compared against the condition recorded when the bike went out.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="return_notes">Примечания</Label>
        <Textarea
          id="return_notes"
          name="return_notes"
          rows={3}
          maxLength={1000}
          placeholder="Courier feedback or anything unusual about this return"
        />
      </div>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">On submit:</span>
          <ul className="ml-2 mt-2 list-inside list-disc space-y-1 text-sm">
            <li>
              The bike goes back to{' '}
              <Badge variant="secondary" className="inline">
                available
              </Badge>
            </li>
            <li>The courier can be assigned another bike</li>
            <li>The full plan price applies — early returns are not prorated</li>
            {isOverdue && (
              <li className="font-medium text-destructive">
                This return is late; any late fee is handled outside the app
              </li>
            )}
          </ul>
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={`/assignments/${assignmentId}`}>Отмена</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Complete return
        </Button>
      </div>
    </form>
  );
}
