import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';

export function ToolsPage() {
  return (
    <>
      <PageHeader title="Tools" />
      <EmptyState
        title="Coming soon"
        body="Life Areas, Tags and Recently Deleted arrive in M1.2 and M1.5."
      />
    </>
  );
}
