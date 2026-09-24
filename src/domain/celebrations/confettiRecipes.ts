/**
 * `Focus/ConfirmCelebrationRecipe.swift` (every Confirm's confetti) and
 * `Celebrations/CelebrationRecipes.swift` (the pop and the reduced-motion still field).
 *
 * **Every value is drawn from the generator in the iOS order**: shape, size, then origin, velocity
 * and delay, then spin, tumble, flutter and life. That is what makes a seed mean the same paper on
 * both clients.
 */
import type { Point, Size } from './celebrationModels';
import { ConfettiRandom, u64, type ConfettiPiece, type Vector } from './confettiPhysics';

/** The record's seven tokens, cycled in this order. Slate is left out as grey, risk as risk. */
export const CONFETTI_PALETTE = [
  'area-work-vivid',
  'area-health-vivid',
  'area-growth-vivid',
  'area-hobby-vivid',
  'area-orange-vivid',
  'state-go-vivid',
  'state-warn-vivid',
] as const;

const RAIN_COUNT = 120;
const CANNON_COUNT = 100;

function paletteColour(index: number): string {
  return CONFETTI_PALETTE[index % CONFETTI_PALETTE.length] ?? CONFETTI_PALETTE[0];
}

interface Look {
  readonly shape: ConfettiPiece['shape'];
  readonly size: Size;
  readonly colorName: string;
}

/** Colour cycles by index; three rectangles to every circle. */
function drawLook(index: number, random: ConfettiRandom, sizeScale = 1): Look {
  const colorName = paletteColour(index);
  if (random.unit() < 0.75) {
    const width = random.uniform(7, 10) * sizeScale;
    const height = random.uniform(4, 6) * sizeScale;
    return { shape: 'rectangle', size: { width, height }, colorName };
  }
  return { shape: 'circle', size: { width: 6 * sizeScale, height: 6 * sizeScale }, colorName };
}

/** The spin, tumble and flutter every source shares, drawn after the flight. */
function drawMotion(random: ConfettiRandom) {
  const spinStart = random.uniform(0, Math.PI * 2);
  const spinRate = random.uniform(-9, 9);
  const tumbleRate = random.uniform(4, 11);
  const tumblePhase = random.uniform(0, Math.PI * 2);
  const flutterAmplitude = random.uniform(6, 18);
  const flutterRate = random.uniform(3, 6);
  const flutterPhase = random.uniform(0, Math.PI * 2);
  return {
    spinStart,
    spinRate,
    tumbleRate,
    tumblePhase,
    flutterAmplitude,
    flutterRate,
    flutterPhase,
  };
}

function launched(
  look: Look,
  origin: Point,
  velocity: Vector,
  delay: number,
  lifeRange: readonly [number, number],
  random: ConfettiRandom,
): ConfettiPiece {
  const motion = drawMotion(random);
  const lifetime = random.uniform(lifeRange[0], lifeRange[1]);
  return { origin, velocity, delay, lifetime, ...look, ...motion };
}

/** Drifts down across the whole width from just above the top edge. */
export function rain(count: number, canvas: Size, seed: bigint): ConfettiPiece[] {
  const random = new ConfettiRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const look = drawLook(index, random);
    const x = random.uniform(-10, canvas.width + 10);
    const y = random.uniform(-80, -10);
    const dx = random.uniform(-60, 60);
    const dy = random.uniform(420, 720);
    const delay = random.uniform(0, 0.6);
    return launched(look, { x, y }, { dx, dy }, delay, [3.0, 3.6], random);
  });
}

/** Fired up and inward from both bottom corners, alternating left and right. */
export function cannons(count: number, canvas: Size, seed: bigint): ConfettiPiece[] {
  const random = new ConfettiRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const look = drawLook(index, random);
    const fromLeft = index % 2 === 0;
    const origin = { x: fromLeft ? -4 : canvas.width + 4, y: canvas.height * 0.86 };
    // 52°–78° above the horizontal, mirrored for the right corner so both aim inward.
    const elevation = random.uniform(-78, -52);
    const radians = ((fromLeft ? elevation : -180 - elevation) * Math.PI) / 180;
    const speed = random.uniform(1100, 1900);
    const velocity = { dx: Math.cos(radians) * speed, dy: Math.sin(radians) * speed };
    const delay = random.uniform(0, 0.12);
    return launched(look, origin, velocity, delay, [2.8, 3.5], random);
  });
}

/**
 * Every Confirm's 220 pieces, rain first. Odd seeds for the rain and even for the cannons, so
 * ordinal 1 draws exactly the prototype E chose from.
 */
export function everyConfirm(canvas: Size, ordinal: number): ConfettiPiece[] {
  const base = u64(BigInt(ordinal) * 2n);
  return [...rain(RAIN_COUNT, canvas, u64(base - 1n)), ...cannons(CANNON_COUNT, canvas, base)];
}

export const CELEBRATION_RECIPES = {
  /** E's call by LOOKING (2026-09-12, variant C). Do not "tune" it back down. */
  popScale: 1.6,
  /** E's F6 "12 to 20 pieces", scaled by `popScale`. Inclusive. */
  popCount: { min: 19, max: 32 },
  /** A still pop arrives already scattered within this far of the tap. */
  stillPopSpread: 48 * 1.6,
  /** E's #7 for a reduced milestone: 120 pieces at rest, the rain's count. */
  stillFieldCount: 120,
} as const;

/** Odd seeds, so a pop and the Confirm rain of the same ordinal never draw the same paper. */
function recipeSeed(ordinal: number): bigint {
  return u64(BigInt(ordinal) * 2_654_435_761n);
}

function still(look: Look, origin: Point, random: ConfettiRandom): ConfettiPiece {
  return {
    origin,
    velocity: { dx: 0, dy: 0 },
    delay: 0,
    lifetime: 0,
    ...look,
    ...drawMotion(random),
  };
}

/** The in-place pop: pieces thrown radially from the tap point, gone within a second. */
export function popPieces(origin: Point, ordinal: number): ConfettiPiece[] {
  const { popScale, popCount } = CELEBRATION_RECIPES;
  const random = new ConfettiRandom(recipeSeed(ordinal));
  const span = popCount.max - popCount.min + 1;
  const count = Math.min(popCount.min + Math.floor(random.uniform(0, span)), popCount.max);
  return Array.from({ length: count }, (_, index) => {
    const radians = random.uniform(0, Math.PI * 2);
    const speed = random.uniform(250, 450) * popScale;
    const lifetime = random.uniform(0.7, 1.0);
    const look = drawLook(index, random, popScale);
    const velocity = { dx: Math.cos(radians) * speed, dy: Math.sin(radians) * speed };
    return { origin, velocity, delay: 0, lifetime, ...look, ...drawMotion(random) };
  });
}

/** The reduced pop: the same count, already scattered, at rest. */
export function stillPop(origin: Point, ordinal: number): ConfettiPiece[] {
  const random = new ConfettiRandom(recipeSeed(ordinal));
  const count = popPieces(origin, ordinal).length;
  return Array.from({ length: count }, (_, index) => {
    const radians = random.uniform(0, Math.PI * 2);
    const distance = CELEBRATION_RECIPES.stillPopSpread * Math.sqrt(random.unit());
    const look = drawLook(index, random, CELEBRATION_RECIPES.popScale);
    const at = {
      x: origin.x + Math.cos(radians) * distance,
      y: origin.y + Math.sin(radians) * distance,
    };
    return still(look, at, random);
  });
}

/** The reduced milestone: a still field across the canvas, at the Confirm's own paper size. */
export function stillField(canvas: Size, ordinal: number): ConfettiPiece[] {
  const random = new ConfettiRandom(u64(recipeSeed(ordinal) + 1n));
  return Array.from({ length: CELEBRATION_RECIPES.stillFieldCount }, (_, index) => {
    const x = random.uniform(0, canvas.width);
    const y = random.uniform(0, canvas.height);
    return still(drawLook(index, random), { x, y }, random);
  });
}

const STILL_FADE_IN = 0.3;
const STILL_FADE_OUT = 0.7;

/** In over 0.3 s, hold, out over the last 0.7 s. The reduced-motion replacement for travel. */
export function stillFieldEnvelope(time: number, length: number): number {
  if (time < 0 || time > length) return 0;
  if (time < STILL_FADE_IN) return time / STILL_FADE_IN;
  const leaving = length - STILL_FADE_OUT;
  if (time <= leaving) return 1;
  return Math.max(0, (length - time) / STILL_FADE_OUT);
}

/** §7.2's opening-pose rule: the first frame has the final geometry; only opacity travels. */
export function stillFieldState(piece: ConfettiPiece, time: number, length: number) {
  if (time < 0 || time > length) return null;
  return {
    position: piece.origin,
    rotation: piece.spinStart,
    tumbleScale: 1,
    opacity: stillFieldEnvelope(time, length),
  };
}
