import { useState } from 'react';
import { Link } from 'react-router';

import { APPEARANCES, appearanceLabel, readAppearance, setAppearance } from '@/theme/theme';
import type { Appearance } from '@/theme/theme';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

import { AccountSection } from './AccountSection';

export function SettingsPage() {
  const [appearance, setLocal] = useState<Appearance>(() => readAppearance());

  function choose(next: Appearance) {
    setAppearance(next);
    setLocal(next);
  }

  return (
    <>
      <PageHeader title="Settings" />
      <SectionLabel className="mb-2">Appearance</SectionLabel>
      <Card>
        <fieldset>
          <legend className="sr-only">Appearance</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
            {APPEARANCES.map((option) => (
              <label
                key={option}
                className="spring flex min-h-11 cursor-pointer items-center justify-center rounded-card border border-card-border px-4 py-2 text-sm font-medium has-checked:border-accent has-checked:bg-card-surface-secondary"
              >
                <input
                  type="radio"
                  name="appearance"
                  value={option}
                  className="sr-only"
                  checked={appearance === option}
                  onChange={() => choose(option)}
                />
                {appearanceLabel(option)}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-4 text-sm text-label-secondary">
          System follows your device. The palette carries light and dark variants for every token.
        </p>
      </Card>
      <SectionLabel className="mt-6 mb-2">Organise</SectionLabel>
      <Card className="p-0">
        <ul className="divide-y divide-card-border">
          <li>
            <Link
              to="/areas/editor"
              className="flex min-h-14 items-center px-4 text-base font-medium"
            >
              Life Areas
            </Link>
          </li>
          <li>
            <Link to="/tags" className="flex min-h-14 items-center px-4 text-base font-medium">
              Tag Editor
            </Link>
          </li>
        </ul>
      </Card>
      <AccountSection />
    </>
  );
}
