/**
 * `Celebrations/CelebrationLayer.swift`: where a celebration is DRAWN. One fixed, click-through,
 * `aria-hidden` canvas over the shell (the `root` surface), drawing every live burst on
 * `requestAnimationFrame` only while something is in the air, and pruning each burst the moment it
 * ends so the frame loop stops.
 *
 * Reduced motion is read HERE and handed to the frame as a resolved rendering per burst.
 * `data-last-burst` / `data-burst-count` are for the e2e suite: a pop lives one second, so a test
 * asserts what was played rather than racing to see it mid-flight.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import type { CelebrationBurst, CelebrationSurface } from '@/domain/celebrations';

import { celebrationNow, celebrations } from './appCelebrations';
import type { CelebrationCenter } from './celebrationCenter';
import { drawCelebrationFrame, sceneFor } from './celebrationFrame';
import type { CelebrationScene, ResolveColour } from './celebrationFrame';

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function isDarkAppearance(): boolean {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Reads each token off the root and lets a canvas normalise it to channels. */
function colourResolver(): ResolveColour {
  const scratch = document.createElement('canvas').getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const cache = new Map<string, readonly [number, number, number, number]>();
  return (name) => {
    const hit = cache.get(name);
    if (hit) return hit;
    let channels: readonly [number, number, number, number] = [0, 0, 0, 1];
    const css = style.getPropertyValue(`--lifeos-${name}`).trim();
    if (scratch && css) {
      scratch.fillStyle = '#000';
      scratch.fillStyle = css;
      const normalised = String(scratch.fillStyle);
      const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normalised);
      const fn = /^rgba?\(([^)]+)\)$/i.exec(normalised);
      if (hex) {
        channels = [
          parseInt(hex[1] ?? '0', 16),
          parseInt(hex[2] ?? '0', 16),
          parseInt(hex[3] ?? '0', 16),
          1,
        ];
      } else if (fn) {
        const parts = (fn[1] ?? '')
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        channels = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      }
    }
    cache.set(name, channels);
    return channels;
  };
}

interface Props {
  readonly center?: CelebrationCenter;
  readonly surface?: CelebrationSurface;
}

export function CelebrationLayer({ center = celebrations, surface = 'root' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bursts = useStore(center.store, (s) => s.bursts);
  const mine = useMemo(() => bursts.filter((b) => b.surface === surface), [bursts, surface]);
  const [played, setPlayed] = useState<{ last?: string; count: number }>({ count: 0 });
  const lastOrdinal = useRef(0);

  // A record of what played, for the e2e suite (updated only when a new burst arrives).
  useEffect(() => {
    const newest = mine[mine.length - 1];
    if (!newest || newest.ordinal <= lastOrdinal.current) return;
    const fresh = mine.filter((b) => b.ordinal > lastOrdinal.current);
    lastOrdinal.current = newest.ordinal;
    setPlayed((p) => ({ last: newest.kind.kind, count: p.count + fresh.length }));
  }, [mine]);

  const live = mine.length > 0;
  useEffect(() => {
    if (!live) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let size = { width: 0, height: 0 };
    const scenes = new Map<number, CelebrationScene>();
    const resolve = colourResolver();
    const dark = isDarkAppearance();
    const reduceMotion = prefersReducedMotion();

    function fit(): void {
      if (!canvas || !ctx) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width === size.width && height === size.height) return;
      size = { width, height };
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      scenes.clear();
    }

    function sceneList(current: readonly CelebrationBurst[]): CelebrationScene[] {
      const live = new Set(current.map((b) => b.ordinal));
      for (const ordinal of scenes.keys()) if (!live.has(ordinal)) scenes.delete(ordinal);
      return current.map((burst) => {
        const cached = scenes.get(burst.ordinal);
        if (cached && cached.burst.start === burst.start) return cached;
        const scene = sceneFor(burst, size, reduceMotion);
        scenes.set(burst.ordinal, scene);
        return scene;
      });
    }

    function tick(): void {
      if (!ctx) return;
      const now = celebrationNow();
      center.prune(now);
      const current = center.store.getState().bursts.filter((b) => b.surface === surface);
      fit();
      drawCelebrationFrame(ctx, sceneList(current), now, size, resolve, dark);
      if (current.length > 0) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, size.width, size.height);
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, size.width, size.height);
    };
  }, [live, center, surface]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="celebration-layer"
      data-celebrating={live ? 'true' : 'false'}
      data-last-burst={played.last ?? ''}
      data-burst-count={played.count}
      className="pointer-events-none fixed inset-0 z-50 h-dvh w-screen"
    />
  );
}
