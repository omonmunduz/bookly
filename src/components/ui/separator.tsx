/**
 * Separator — shadcn/ui primitive.
 *
 * Written against a plain <div> rather than @radix-ui/react-separator: a
 * horizontal rule needs no focus management or keyboard behaviour, so the
 * dependency would buy nothing. `decorative` mirrors Radix's API — a separator
 * that is purely visual is hidden from assistive tech, while one that genuinely
 * divides content is announced.
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Visual-only dividers are hidden from screen readers. */
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = 'Separator';

export { Separator };
