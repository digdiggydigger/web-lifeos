import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  FOCUS_GOAL_RANGE,
  formatAbout,
  GOAL_RANGE,
  goalLabel,
  SPRINT_MINUTES_RANGE,
} from '@/domain/settings';
import type { MomentumPreferences } from '@/domain/settings';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';
import {
  appearanceExplanation,
  appearanceLabel,
  APPEARANCES,
  readAppearance,
  setAppearance,
} from '@/theme/theme';
import type { Appearance } from '@/theme/theme';

import { AccountDeletionSection } from './AccountDeletionSection';
import { AccountSection } from './AccountSection';
import { preferencesStore } from './preferencesStore';

type BoolKey = {
  [K in keyof MomentumPreferences]: MomentumPreferences[K] extends boolean ? K : never;
}[keyof MomentumPreferences];
type IntKey = 'dailyGoal' | 'focusDailyGoalMinutes' | 'defaultSprintMinutes';

function Toggle({ label, prefKey }: { readonly label: string; readonly prefKey: BoolKey }) {
  const value = useStore(preferencesStore, (s) => s.preferences[prefKey]);
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={value}
        checked={value}
        onChange={(e) => preferencesStore.getState().update({ [prefKey]: e.target.checked })}
        className="size-6 accent-accent"
      />
    </label>
  );
}

function Stepper({
  label,
  prefKey,
  range,
  step = 1,
  format,
}: {
  readonly label: string;
  readonly prefKey: IntKey;
  readonly range: { readonly min: number; readonly max: number };
  readonly step?: number;
  readonly format: (value: number) => string;
}) {
  const value = useStore(preferencesStore, (s) => s.preferences[prefKey]);
  const setValue = (next: number) => preferencesStore.getState().update({ [prefKey]: next });
  return (
    <div
      className="flex min-h-11 items-center justify-between gap-4 text-sm"
      role="group"
      aria-label={label}
    >
      <span>
        {label}: <span className="font-semibold">{format(value)}</span>
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= range.min}
          onClick={() => setValue(value - step)}
          className="spring flex size-11 items-center justify-center rounded-card border border-card-border text-accent disabled:text-label-tertiary"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= range.max}
          onClick={() => setValue(value + step)}
          className="spring flex size-11 items-center justify-center rounded-card border border-card-border text-accent disabled:text-label-tertiary"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </span>
    </div>
  );
}

/** `SettingsView`: momentum, focus, appearance, the editors' doors, account, about, and Delete Account. */
export function SettingsPage() {
  const [appearance, setLocal] = useState<Appearance>(() => readAppearance());

  function choose(next: Appearance) {
    setAppearance(next);
    setLocal(next);
  }

  return (
    <>
      <PageHeader title="Settings" />
      <SectionLabel className="mb-2">What counts as momentum</SectionLabel>
      <Card className="flex flex-col">
        <Stepper label="Daily goal" prefKey="dailyGoal" range={GOAL_RANGE} format={goalLabel} />
        <Toggle label="Show streaks" prefKey="showStreaks" />
        <Toggle label="Count cleared captures" prefKey="countClearedCaptures" />
        <Toggle label="Count nudges" prefKey="countNudges" />
        <Toggle label="Show weekly charts" prefKey="showCharts" />
        <p className="mt-2 text-xs text-label-tertiary">
          Turn streaks off and the app keeps every number but stops counting consecutive days.
          Counting cleared captures lets anything you archive, promote or journal from the inbox
          advance the ring too. Counting nudges does the same for every nudge you dismiss today.
          Weekly charts can be hidden without losing any numbers.
        </p>
      </Card>
      <SectionLabel className="mt-6 mb-2">Focus</SectionLabel>
      <Card className="flex flex-col">
        <Stepper
          label="Daily focus goal"
          prefKey="focusDailyGoalMinutes"
          range={FOCUS_GOAL_RANGE}
          step={5}
          format={(v) => `${v} min`}
        />
        <Stepper
          label="Default sprint length"
          prefKey="defaultSprintMinutes"
          range={SPRINT_MINUTES_RANGE}
          step={5}
          format={(v) => `${v} min`}
        />
        <p className="mt-2 text-xs text-label-tertiary">
          The daily goal is what the focus charts measure against. The sprint length is where a
          one-tap start begins for a task with no plan of its own — a task's saved plan always wins.
        </p>
      </Card>
      <SectionLabel className="mt-6 mb-2">Appearance</SectionLabel>
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
        <p className="mt-4 text-sm text-label-secondary">{appearanceExplanation(appearance)}</p>
      </Card>
      <SectionLabel className="mt-6 mb-2">Organise</SectionLabel>
      <Card className="p-0">
        <ul className="divide-y divide-card-border">
          <li>
            <Link to="/areas/editor" className="flex min-h-14 flex-col justify-center px-4">
              <span className="text-base font-medium">Life Areas</span>
              <span className="text-xs text-label-secondary">
                Rename, re-emoji, recolour, create, and archive your grid.
              </span>
            </Link>
          </li>
          <li>
            <Link to="/tags" className="flex min-h-14 flex-col justify-center px-4">
              <span className="text-base font-medium">Tag Editor</span>
              <span className="text-xs text-label-secondary">Rename, merge, and delete tags.</span>
            </Link>
          </li>
          <li>
            <Link
              to="/tools/recently-deleted"
              className="flex min-h-14 flex-col justify-center px-4"
            >
              <span className="text-base font-medium">Recently Deleted</span>
              <span className="text-xs text-label-secondary">
                Restore something you deleted by mistake.
              </span>
            </Link>
          </li>
        </ul>
      </Card>
      <AccountSection />
      <SectionLabel className="mt-6 mb-2">About</SectionLabel>
      <Card>
        <p className="flex min-h-11 items-center justify-between text-sm">
          <span className="text-label-secondary">Version</span>
          <span>{formatAbout(__APP_VERSION__, import.meta.env.VITE_BUILD)}</span>
        </p>
      </Card>
      <AccountDeletionSection />
    </>
  );
}
