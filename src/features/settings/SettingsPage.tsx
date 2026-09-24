import { useState } from 'react';

import { APPEARANCES, appearanceLabel, readAppearance, setAppearance } from '@/theme/theme';
import type { Appearance } from '@/theme/theme';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

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
    </>
  );
}
