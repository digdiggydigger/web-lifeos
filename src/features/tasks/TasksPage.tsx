import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" />
      <EmptyState title="Coming soon" body="Your open and closed tasks land here in M1.1." />
    </>
  );
}
