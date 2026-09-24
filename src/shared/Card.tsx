import type { HTMLAttributes } from 'react';

/** The iOS `.bentoCard()`: card surface, 16px continuous corners, 1px border, 3% shadow. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-card-border bg-card-surface p-4 shadow-card ${className}`}
      {...rest}
    />
  );
}
