import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function CapturesPage() {
  return (
    <>
      <PageHeader title="Captures" />
      <EmptyState title="Coming soon" body="The inbox and triage arrive in M1.4." />
    </>
  );
}
