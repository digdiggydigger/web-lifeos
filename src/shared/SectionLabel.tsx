import type { HTMLAttributes } from 'react';

/** The iOS `sectionLabel()`: caption, bold, tracked, uppercase, secondary. */
export function SectionLabel({ className = '', ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-xs font-bold tracking-widest text-label-secondary uppercase ${className}`}
      {...rest}
    />
  );
}
