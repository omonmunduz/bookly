/**
 * ConfirmDialog — a modal confirmation prompt.
 *
 * Built on the native <dialog> element rather than @radix-ui/react-alert-dialog,
 * matching this project's minimal dependency set. showModal() gives focus
 * trapping, Escape-to-close, and the top-layer backdrop for free — the three
 * things the Radix primitive would otherwise be carried in for.
 *
 * Semantics follow the alertdialog role: the prompt is modal and requires an
 * explicit choice, so Escape and backdrop clicks cancel rather than silently
 * confirming.
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Label for the confirming action. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive for irreversible actions. */
  destructive?: boolean;
  /** Disables both buttons and shows a spinner while the action runs. */
  isPending?: boolean;
  /** Error from a failed attempt, rendered inline so the dialog stays open. */
  error?: string | null;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isPending = false,
  error = null,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  // Drive the native dialog from the `open` prop. showModal() is imperative and
  // throws if called on an already-open dialog, hence the guards.
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      // The browser fires `cancel` for Escape; `close` covers every path out.
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      // A click landing on the dialog itself (not its content) is the backdrop.
      onClick={(event) => {
        if (event.target === ref.current && !isPending) onOpenChange(false);
      }}
      aria-labelledby="confirm-dialog-title"
      className={cn(
        'w-[calc(100vw-2rem)] max-w-lg rounded-lg border bg-background p-6 text-foreground shadow-lg',
        'backdrop:bg-black/80'
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {children}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
