import { PageHeader } from '@/shared/PageHeader';
import { EmptyState } from '@/shared/EmptyState';

export function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-8">
      <PageHeader title="Sign in" subtitle="ADHD LifeOS" />
      <EmptyState title="Sign-in arrives in M0.4" />
    </main>
  );
}
