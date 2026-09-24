import { useId, useState } from 'react';

import { LIFE_AREA_EMOJI, SINGLE_EMOJI_ERROR, validateEmoji } from '@/domain/lifeAreas';
import { fieldClass } from '@/shared/Chips';

interface EmojiPickerProps {
  readonly value: string;
  readonly onChange: (emoji: string) => void;
}

/** `Theme/EmojiPicker.swift`: the 40-glyph palette plus a "type your own" field that accepts one grapheme. */
export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const id = useId();
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  function submitCustom(raw: string) {
    setCustom(raw);
    const result = validateEmoji(raw);
    if (result.kind === 'valid') {
      setError(undefined);
      onChange(result.emoji);
    } else {
      setError(result.kind === 'invalidEmpty' ? undefined : SINGLE_EMOJI_ERROR);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Emoji" className="grid grid-cols-8 gap-1">
        {LIFE_AREA_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={emoji === value}
            aria-label={emoji}
            onClick={() => onChange(emoji)}
            className="spring flex size-11 items-center justify-center rounded-card text-2xl aria-checked:bg-card-surface-secondary aria-checked:ring-2 aria-checked:ring-accent"
          >
            {emoji}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="mt-4 mb-1 block text-sm text-label-secondary">
        Or type your own
      </label>
      <input
        id={id}
        className={fieldClass}
        value={custom}
        onChange={(e) => submitCustom(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="One emoji"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-state-risk">
          {error}
        </p>
      ) : null}
    </div>
  );
}
