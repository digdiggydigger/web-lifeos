import {
  ENERGY_LEVELS,
  energyChipLabel,
  energyDetail,
  energyGlyph,
  energyTitle,
  JOURNAL_MOOD_OPTIONS,
} from '@/domain/journal';
import type { ComposerChipPalette } from '@/domain/journal';
import type { EnergyLevel } from '@/domain/types';

interface EnergyMoodPickerProps {
  readonly energyLevel: EnergyLevel;
  readonly moodEmoji: string;
  readonly palette: ComposerChipPalette;
  readonly onEnergy: (level: EnergyLevel) => void;
  readonly onMood: (emoji: string) => void;
}

function chip(palette: ComposerChipPalette, selected: boolean): string {
  return `spring rounded-card ${selected ? `${palette.selectedFill} ${palette.selectedLabel}` : `${palette.quietSurface} ${palette.quietLabel}`}`;
}

/** `JournalEnergyMoodPicker`: three energy chips (glyph + title + detail) and the eight-mood row. */
export function EnergyMoodPicker({
  energyLevel,
  moodEmoji,
  palette,
  onEnergy,
  onMood,
}: EnergyMoodPickerProps) {
  const soft = palette.softInk ?? 'text-label-secondary';
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Energy" className="flex flex-col gap-1">
        <span className={`text-xs font-bold tracking-widest uppercase ${soft}`}>Energy</span>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={energyLevel === level}
              aria-label={`${energyTitle(level)} energy, ${energyDetail(level)}`}
              onClick={() => onEnergy(level)}
              className={`${chip(palette, energyLevel === level)} flex min-h-11 flex-col items-center py-2`}
            >
              <span aria-hidden="true" className="text-sm">
                {energyGlyph(level)}
              </span>
              <span className="text-xs font-bold">{energyTitle(level)}</span>
              <span className="text-xs">{energyDetail(level)}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label="Mood" className="flex flex-col gap-1">
        <span className={`text-xs font-bold tracking-widest uppercase ${soft}`}>Mood</span>
        <div className="flex flex-wrap gap-2">
          {JOURNAL_MOOD_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={moodEmoji === emoji}
              aria-label={`Mood ${emoji}`}
              onClick={() => onMood(emoji)}
              className={`${chip(palette, moodEmoji === emoji)} flex size-11 items-center justify-center text-base`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** `JournalEnergyMoodBadge`: the row's readout, nothing when neither was recorded. */
export function EnergyMoodBadge({
  energyLevel,
  moodEmoji,
}: {
  readonly energyLevel?: EnergyLevel | undefined;
  readonly moodEmoji?: string | undefined;
}) {
  if (!energyLevel && !moodEmoji) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-label-secondary">
      {moodEmoji ? <span aria-label={`Mood ${moodEmoji}`}>{moodEmoji}</span> : null}
      {energyLevel ? <span className="font-semibold">{energyChipLabel(energyLevel)}</span> : null}
    </p>
  );
}
