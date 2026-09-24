import { Link } from 'react-router';

import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState
        title="There is nothing at this address."
        action={
          <Link to="/today" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Back to Today
          </Link>
        }
      />
    </>
  );
}
