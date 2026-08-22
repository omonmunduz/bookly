/**
 * Checkbox — native <input type="checkbox">, styled with accent-color.
 *
 * Not the Radix/shadcn version, which needs @radix-ui/react-checkbox — a package
 * this project deliberately does not install. The native input is already
 * keyboard accessible and announces its checked state to screen readers, so the
 * only thing worth adding is sizing and the focus ring.
 *
 * Consequence for callers: this is a real checkbox, so it reports state through
 * `checked` + `onChange` (event.target.checked), not Radix's
 * `onCheckedChange(boolean)`.
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={cn(
          // h-5/w-5 rather than the stock h-4: a 16px checkbox is an awkward tap
          // target on a phone, and the label is usually clickable too.
          'h-5 w-5 shrink-0 cursor-pointer rounded border-input accent-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
