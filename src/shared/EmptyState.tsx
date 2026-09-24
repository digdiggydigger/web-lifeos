import type { ReactNode } from 'react';

import { Card } from './Card';

interface EmptyStateProps {
  readonly title: string;
  readonly body?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <Card role="status" className="text-center">
      <p className="text-base font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm text-label-secondary">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
