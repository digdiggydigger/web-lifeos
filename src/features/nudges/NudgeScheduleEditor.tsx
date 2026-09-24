/** `NudgeScheduleEditor`: the Repeat presets, the Custom day row, the summary line and the time. */
import { useState } from 'react';

import {
  daySummary,
  matchingPreset,
  NUDGE_SCHEDULE_PRESETS,
  presetTitle,
  presetWeekdays,
  WEEKDAY_INITIALS,
  WEEKDAY_SYMBOLS,
} from '@/domain/nudges';
import type { NudgeSchedule } from '@/domain/nudges';
import { chipClass, fieldClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';

interface NudgeScheduleEditorProps {
  readonly schedule: NudgeSchedule;
  readonly onChange: (schedule: NudgeSchedule) => void;
  readonly idPrefix: string;
}

export function NudgeScheduleEditor({ schedule, onChange, idPrefix }: NudgeScheduleEditorProps) {
  const [showsCustomDays, setShowsCustomDays] = useState<boolean | undefined>(undefined);
  const preset = matchingPreset(schedule.weekdays);
  const showingDays = showsCustomDays ?? preset === 'custom';
  const timeId = `${idPrefix}-time`;
  const clock = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;

  function toggleDay(day: number): void {
    const next = new Set(schedule.weekdays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange({ ...schedule, weekdays: next });
  }

  const summary = (
    <p
      className={`text-sm ${schedule.weekdays.size === 0 ? 'text-state-risk' : 'text-label-secondary'}`}
    >
      {daySummary(schedule.weekdays)}
    </p>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SectionLabel>Repeat</SectionLabel>
        <div role="group" aria-label="Repeat" className="grid grid-cols-2 gap-2">
          {NUDGE_SCHEDULE_PRESETS.map((option) => {
            const selected = option === 'custom' ? showingDays : preset === option && !showingDays;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const days = presetWeekdays(option);
                  if (days) {
                    onChange({ ...schedule, weekdays: days });
                    setShowsCustomDays(false);
                  } else {
                    setShowsCustomDays(true);
                  }
                }}
                className={chipClass}
              >
                {presetTitle(option)}
              </button>
            );
          })}
        </div>
        {!showingDays ? summary : null}
      </div>
      {showingDays ? (
        <div className="flex flex-col gap-2">
          <div role="group" aria-label="Days" className="flex gap-1">
            {WEEKDAY_INITIALS.map((initial, day) => (
              <button
                key={day}
                type="button"
                aria-label={WEEKDAY_SYMBOLS[day]}
                aria-pressed={schedule.weekdays.has(day)}
                onClick={() => toggleDay(day)}
                className="spring flex size-11 items-center justify-center rounded-card border border-card-border text-sm font-semibold text-label-secondary aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-area-work"
              >
                {initial}
              </button>
            ))}
          </div>
          {summary}
        </div>
      ) : null}
      <hr className="border-card-border" />
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={timeId} className="text-base">
          Time
        </label>
        <input
          id={timeId}
          type="time"
          value={clock}
          onChange={(e) => {
            const [h, m] = e.target.value.split(':').map(Number);
            if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return;
            onChange({ ...schedule, hour: h, minute: m });
          }}
          className={`${fieldClass} w-auto`}
        />
      </div>
    </div>
  );
}
