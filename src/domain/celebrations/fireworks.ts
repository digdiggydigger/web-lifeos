/**
 * `Focus/ConfirmFireworksSchedule.swift` and `ConfirmFireworksPhysics.swift`: which fireworks a
 * stack-clearing Confirm fires, where and when, and where a shell and its sparks are at any
 * instant. The 14-shell schedule is FIXED (E chose it by video); only the confetti around it is
 * seeded per burst.
 */
import type { Point, Size } from './celebrationModels';
import { ConfettiRandom, u64, type ConfettiPiece } from './confettiPhysics';
import { CONFETTI_PALETTE } from './confettiRecipes';

export type FireworkBurstKind = 'single' | 'twoTone' | 'ringInRing';
export type FireworkSizeClass = 'big' | 'medium' | 'small';

export const FIREWORK_SIZE_CLASSES: Record<
  FireworkSizeClass,
  { readonly sparkCount: number; readonly sparkSpeed: number; readonly sparkLife: number }
> = {
  big: { sparkCount: 72, sparkSpeed: 400, sparkLife: 1.45 },
  medium: { sparkCount: 56, sparkSpeed: 310, sparkLife: 1.3 },
  small: { sparkCount: 40, sparkSpeed: 220, sparkLife: 1.1 },
};

export interface FireworkShell {
  /** Seconds after the Confirm, on the choreography clock. */
  readonly launch: number;
  /** Where it bursts, as fractions of the canvas width and height. */
  readonly apex: Point;
  readonly burst: FireworkBurstKind;
  /** Token names: one for a single shell, two otherwise. */
  readonly colorNames: readonly string[];
  readonly size: FireworkSizeClass;
}

/** The confetti's seven plus two more for E's "OTHER COLOURED" (#7). */
export const FIREWORKS_PALETTE = [...CONFETTI_PALETTE, 'area-admin-vivid', 'area-red-vivid'];

function shell(
  launch: number,
  x: number,
  y: number,
  burst: FireworkBurstKind,
  colorNames: string[],
  size: FireworkSizeClass,
): FireworkShell {
  return { launch, apex: { x, y }, burst, colorNames, size };
}

/** 14 shells over 2.6 s; the last two are the finale. */
export const FIREWORK_SHELLS: readonly FireworkShell[] = [
  shell(0.05, 0.28, 0.3, 'single', ['state-warn-vivid'], 'big'),
  shell(0.3, 0.72, 0.22, 'twoTone', ['area-growth-vivid', 'area-health-vivid'], 'big'),
  shell(0.55, 0.5, 0.4, 'ringInRing', ['area-hobby-vivid', 'area-admin-vivid'], 'big'),
  shell(0.8, 0.18, 0.18, 'single', ['area-work-vivid'], 'medium'),
  shell(0.95, 0.84, 0.36, 'twoTone', ['state-go-vivid', 'area-admin-vivid'], 'medium'),
  shell(1.2, 0.4, 0.16, 'ringInRing', ['area-orange-vivid', 'area-health-vivid'], 'big'),
  shell(1.4, 0.64, 0.46, 'single', ['area-growth-vivid'], 'small'),
  shell(1.55, 0.26, 0.5, 'twoTone', ['area-red-vivid', 'state-warn-vivid'], 'small'),
  shell(1.75, 0.78, 0.14, 'single', ['area-health-vivid'], 'big'),
  shell(1.95, 0.5, 0.28, 'twoTone', ['area-hobby-vivid', 'area-work-vivid'], 'big'),
  shell(2.2, 0.15, 0.34, 'ringInRing', ['state-go-vivid', 'area-growth-vivid'], 'medium'),
  shell(2.35, 0.86, 0.26, 'single', ['area-admin-vivid'], 'medium'),
  shell(2.55, 0.36, 0.22, 'twoTone', ['area-orange-vivid', 'area-growth-vivid'], 'big'),
  shell(2.6, 0.66, 0.24, 'ringInRing', ['state-warn-vivid', 'area-hobby-vivid'], 'big'),
];

export const FIREWORKS_PHYSICS = {
  sparkGravity: 150,
  sparkDrag: 2.4,
  launchLead: 0.02,
  launchHeight: 0.96,
  baseRise: 0.55,
  riseForFullHeight: 0.25,
  innerRingSpeed: 0.55,
  sparkSize: { width: 2.4, height: 2.4 },
  sparkFadePower: 1.4,
  flashDuration: 0.35,
  flashStartRadius: 40,
  flashEndRadius: 240,
  flashPeakAlpha: 0.35,
  /** A spark is drawn as a stroke from where it was this long ago; a shell, from this long ago. */
  sparkTrail: 0.07,
  shellTrail: 0.08,
} as const;

export function riseDuration(s: FireworkShell): number {
  return FIREWORKS_PHYSICS.baseRise + FIREWORKS_PHYSICS.riseForFullHeight * (1 - s.apex.y);
}

export function burstTime(s: FireworkShell): number {
  return s.launch + riseDuration(s);
}

export function launchPoint(s: FireworkShell, canvas: Size): Point {
  return {
    x: (s.apex.x + FIREWORKS_PHYSICS.launchLead) * canvas.width,
    y: FIREWORKS_PHYSICS.launchHeight * canvas.height,
  };
}

export function apexPoint(s: FireworkShell, canvas: Size): Point {
  return { x: s.apex.x * canvas.width, y: s.apex.y * canvas.height };
}

/** Eased `1 − (1 − u)²` from launch to apex; `null` before launch and after the burst. */
export function shellPosition(s: FireworkShell, time: number, canvas: Size): Point | null {
  const rise = riseDuration(s);
  const flight = time - s.launch;
  if (flight < 0 || flight > rise) return null;
  const progress = flight / rise;
  const eased = 1 - (1 - progress) * (1 - progress);
  const start = launchPoint(s, canvas);
  const apex = apexPoint(s, canvas);
  return { x: start.x + (apex.x - start.x) * eased, y: start.y + (apex.y - start.y) * eased };
}

/** 0.8…1.0, deterministic per (shell, spark), so a display replays identically. */
function variation(shellIndex: number, spark: number): number {
  const seed = u64(BigInt(shellIndex) * 1_000_003n + BigInt(spark) + 1n);
  return 0.8 + 0.2 * new ConfettiRandom(seed).unit();
}

function sparkPiece(
  angle: number,
  speed: number,
  colorName: string,
  origin: Point,
  delay: number,
  lifetime: number,
): ConfettiPiece {
  return {
    origin,
    velocity: { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed },
    delay,
    lifetime,
    size: FIREWORKS_PHYSICS.sparkSize,
    shape: 'circle',
    colorName,
    spinStart: 0,
    spinRate: 0,
    tumbleRate: 0,
    tumblePhase: 0,
    flutterAmplitude: 0,
    flutterRate: 0,
    flutterPhase: 0,
  };
}

/**
 * The shell's sparks: evenly stepped round the circle at class speed × (0.8 + 0.2 × hash); a
 * two-tone shell alternates colours; a ring-in-ring puts half in a slower inner ring in the second
 * colour, offset half a step.
 */
export function fireworkSparks(s: FireworkShell, index: number, canvas: Size): ConfettiPiece[] {
  const cls = FIREWORK_SIZE_CLASSES[s.size];
  const origin = apexPoint(s, canvas);
  const delay = burstTime(s);
  const first = s.colorNames[0] ?? CONFETTI_PALETTE[0];
  const second = s.colorNames[1] ?? first;
  const make = (angle: number, speed: number, colour: string) =>
    sparkPiece(angle, speed, colour, origin, delay, cls.sparkLife);
  if (s.burst !== 'ringInRing') {
    return Array.from({ length: cls.sparkCount }, (_, spark) =>
      make(
        (2 * Math.PI * spark) / cls.sparkCount,
        cls.sparkSpeed * variation(index, spark),
        s.burst === 'twoTone' && spark % 2 === 1 ? second : first,
      ),
    );
  }
  const half = Math.floor(cls.sparkCount / 2);
  const outer = Array.from({ length: half }, (_, spark) =>
    make((2 * Math.PI * spark) / half, cls.sparkSpeed * variation(index, spark), first),
  );
  const inner = Array.from({ length: half }, (_, spark) =>
    make(
      (2 * Math.PI * (spark + 0.5)) / half,
      cls.sparkSpeed * FIREWORKS_PHYSICS.innerRingSpeed * variation(index, half + spark),
      second,
    ),
  );
  return [...outer, ...inner];
}

/** `(1 − τ/life)^1.4` from the burst; nothing before it or after the life. */
export function sparkOpacity(life: number, sinceBurst: number): number {
  if (sinceBurst < 0 || sinceBurst >= life) return 0;
  return (1 - sinceBurst / life) ** FIREWORKS_PHYSICS.sparkFadePower;
}

export interface FireworkFlash {
  readonly radius: number;
  readonly alpha: number;
}

/** Radius 40 → 240 and alpha 0.35 → 0 over 0.35 s from the burst. */
export function fireworkFlash(sinceBurst: number): FireworkFlash | null {
  const p = FIREWORKS_PHYSICS;
  if (sinceBurst < 0 || sinceBurst >= p.flashDuration) return null;
  const progress = sinceBurst / p.flashDuration;
  return {
    radius: p.flashStartRadius + (p.flashEndRadius - p.flashStartRadius) * progress,
    alpha: p.flashPeakAlpha * (1 - progress),
  };
}

export interface ConfirmFireworks {
  readonly canvas: Size;
  readonly shells: readonly FireworkShell[];
  /** One list per shell, in schedule order. */
  readonly sparks: readonly (readonly ConfettiPiece[])[];
}

/** A stack-clearing display for one canvas, built once per change to the live list. */
export function confirmFireworks(
  canvas: Size,
  schedule: readonly FireworkShell[] = FIREWORK_SHELLS,
): ConfirmFireworks {
  return {
    canvas,
    shells: schedule,
    sparks: schedule.map((s, index) => fireworkSparks(s, index, canvas)),
  };
}

/** When the last spark dies on the choreography clock: 4.79 s, derived from the schedule. */
export function lastSparkTime(): number {
  return Math.max(
    0,
    ...FIREWORK_SHELLS.map((s) => burstTime(s) + FIREWORK_SIZE_CLASSES[s.size].sparkLife),
  );
}
