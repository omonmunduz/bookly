/**
 * Select — native <select>, styled to match Input.
 *
 * Not the Radix/shadcn composite (SelectTrigger/SelectContent/SelectItem): that
 * needs @radix-ui/react-select, which this project deliberately does not
 * install. The native control also gets platform-correct behaviour for free —
 * the iOS wheel picker, Android's dialog, hardware keyboard type-ahead — which
 * matters for a mobile-first app.
 *
 * Pass options as children:
 *   <Select value={x} onChange={...}>
 *     <option value="a">A</option>
 *   </Select>
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          // h-11 matches Input: 44px is the minimum comfortable tap target.
          'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export { Select };
