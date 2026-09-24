import type { ReactNode } from 'react';

interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly trailing?: ReactNode;
}

export function PageHeader({ title, subtitle, trailing }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-label-secondary">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
