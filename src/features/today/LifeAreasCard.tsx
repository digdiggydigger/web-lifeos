import { Link } from 'react-router';

import { useLifeAreas } from '@/features/areas/useLifeAreas';
import { Card } from '@/shared/Card';
import { SectionLabel } from '@/shared/SectionLabel';

/** A live, read-only list for now: the first thing the phone and the web must agree on. */
export function LifeAreasCard() {
  const state = useLifeAreas();

  return (
    <section aria-labelledby="life-areas-heading" className="mt-6">
      <SectionLabel id="life-areas-heading" className="mb-2">
        Life areas
      </SectionLabel>
      <Card>
        {state.kind === 'loading' ? (
          <p role="status" className="text-sm text-label-secondary">
            Loading…
          </p>
        ) : null}
        {state.kind === 'error' ? (
          <p role="alert" className="text-sm text-state-risk">
            {state.message}
          </p>
        ) : null}
        {state.kind === 'ready' && state.areas.length === 0 ? (
          <p className="text-sm text-label-secondary">No life areas yet.</p>
        ) : null}
        {state.kind === 'ready' && state.areas.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {state.areas.map((area) => (
              <li
                key={area.id}
                className="flex min-h-11 items-center gap-2 rounded-card bg-card-surface-secondary px-4 py-2"
              >
                <span aria-hidden="true" className="text-xl">
                  {area.colour}
                </span>
                <span className="text-sm font-medium">{area.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {state.kind === 'ready' && state.skipped > 0 ? (
          <p role="status" className="mt-2 text-xs text-label-tertiary">
            {state.skipped} {state.skipped === 1 ? 'item' : 'items'} could not be read.
          </p>
        ) : null}
        <p className="mt-4 text-xs text-label-tertiary">
          Editing arrives in Phase 1.{' '}
          <Link to="/areas" className="text-accent">
            Areas tab
          </Link>
        </p>
      </Card>
    </section>
  );
}
