import { useState } from 'react';
import type { FormEvent } from 'react';

import { DEFAULT_LIFE_AREA_EMOJI, normalizeNewName } from '@/domain/lifeAreas';
import { fieldClass, primaryButtonClass } from '@/shared/Chips';
import { SectionLabel } from '@/shared/SectionLabel';
import { Sheet } from '@/shared/Sheet';

import { EmojiPicker } from './EmojiPicker';

interface AddLifeAreaDialogProps {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onAdd: (name: string, emoji: string) => Promise<boolean>;
}

/** `AddLifeAreaSheet`: a name, an emoji, Add. */
export function AddLifeAreaDialog({ open, busy, onClose, onAdd }: AddLifeAreaDialogProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(DEFAULT_LIFE_AREA_EMOJI);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizeNewName(name) || busy) return;
    if (await onAdd(name, emoji)) {
      setName('');
      setEmoji(DEFAULT_LIFE_AREA_EMOJI);
    }
  }

  return (
    <Sheet open={open} title="New life area" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-area-name" className="mb-1 block text-sm text-label-secondary">
            Name
          </label>
          <input
            id="new-area-name"
            className={fieldClass}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="mb-2">
            <SectionLabel>Emoji</SectionLabel>
          </legend>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </fieldset>
        <button
          type="submit"
          disabled={!normalizeNewName(name) || busy}
          className={primaryButtonClass}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
    </Sheet>
  );
}
