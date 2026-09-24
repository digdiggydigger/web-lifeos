import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function JournalPage() {
  return (
    <>
      <PageHeader title="Journal" />
      <EmptyState title="Coming soon" body="The day-grouped timeline arrives in M1.3." />
    </>
  );
}
