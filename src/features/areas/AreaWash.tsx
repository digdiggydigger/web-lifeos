import { familyFor, familyTokens } from '@/domain/lifeAreas';
import type { LifeArea } from '@/domain/types';

/** Class names painting an element with an area's family: tint surface, vivid rail, `on` text. */
export function areaClasses(area: Pick<LifeArea, 'id' | 'colour' | 'palette'>): {
  tint: string;
  rail: string;
  text: string;
  solid: string;
  on: string;
} {
  const t = familyTokens(familyFor(area));
  return {
    tint: `bg-${t.tint}`,
    rail: `bg-${t.vivid}`,
    text: `text-${t.base}`,
    solid: `bg-${t.base}`,
    on: `text-${t.on}`,
  };
}

/** Every family class name spelled out once so Tailwind's scanner emits them (the names above are built at runtime). */
export const AREA_CLASS_SAFELIST =
  'bg-area-work-tint bg-area-health-tint bg-area-admin-tint bg-area-growth-tint bg-area-hobby-tint bg-area-green-tint bg-area-orange-tint bg-area-red-tint bg-area-slate-tint ' +
  'bg-area-work-vivid bg-area-health-vivid bg-area-admin-vivid bg-area-growth-vivid bg-area-hobby-vivid bg-area-green-vivid bg-area-orange-vivid bg-area-red-vivid bg-area-slate-vivid ' +
  'bg-area-work bg-area-health bg-area-admin bg-area-growth bg-area-hobby bg-area-green bg-area-orange bg-area-red bg-area-slate ' +
  'text-area-work text-area-health text-area-admin text-area-growth text-area-hobby text-area-green text-area-orange text-area-red text-area-slate ' +
  'text-on-area-work text-on-area-health text-on-area-admin text-on-area-growth text-on-area-hobby text-on-area-green text-on-area-orange text-on-area-red text-on-area-slate';
