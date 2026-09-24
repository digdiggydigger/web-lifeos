/**
 * `Tools/ToolsCatalog.swift`: the two doors, Places first. On the web a door either opens a route
 * or names the phone as where it lives (the companion posture: the phone stays the trigger source).
 */
export type ToolsDestination = 'places' | 'lifeAreas';
export const TOOLS_DESTINATIONS: readonly ToolsDestination[] = ['places', 'lifeAreas'];

export interface ToolsEntry {
  readonly destination: ToolsDestination;
  readonly title: string;
  readonly caption: string;
  /** A semantic glyph key; the screen maps it to an icon. */
  readonly glyph: 'pin' | 'grid';
  /** Where the door goes on the web, or `phone` when the feature lives on the phone for now. */
  readonly availability:
    { readonly kind: 'route'; readonly path: string } | { readonly kind: 'phone' };
}

export const TOOLS_ENTRIES: readonly ToolsEntry[] = [
  {
    destination: 'places',
    title: 'Places',
    caption: 'The spots you keep coming back to — home, the office, the gym.',
    glyph: 'pin',
    availability: { kind: 'phone' },
  },
  {
    destination: 'lifeAreas',
    title: 'Life Areas',
    caption: 'Rename, re-emoji, recolour, create, and archive your Home grid.',
    glyph: 'grid',
    availability: { kind: 'route', path: '/areas/editor' },
  },
];

export function toolsEntryId(entry: Pick<ToolsEntry, 'destination'>): string {
  return `tools-${entry.destination}`;
}

export const PHONE_ONLY_BADGE = 'On your phone';
export const PHONE_ONLY_NOTE =
  'Places, routines and arrival nudges need the phone in your pocket. Set them up in the iOS app; what they record shows up here.';
export const ROUTINES_SECTION_TITLE = 'Routines';
