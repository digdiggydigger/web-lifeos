import { Settings } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function TodayPage() {
  return (
    <>
      <PageHeader
        title="Today"
        trailing={
          <Link
            to="/settings"
            aria-label="Settings"
            className="spring flex size-11 items-center justify-center rounded-card text-label-secondary hover:bg-card-surface-secondary md:hidden"
          >
            <Settings aria-hidden="true" className="size-6" />
          </Link>
        }
      />
      <EmptyState
        title="Momentum arrives in Phase 2"
        body="Until then, Tasks is the place to start."
        action={
          <Link to="/tasks" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Go to Tasks
          </Link>
        }
      />
    </>
  );
}
