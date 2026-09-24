/**
 * `Focus/ConfettiPhysics.swift`: one piece of confetti, and where it is at any instant. A pure
 * function of time, never accumulated frame to frame, so the same instant always draws the same
 * frame and a dropped frame costs nothing but that frame.
 */
import type { Point, Size } from './celebrationModels';

export interface Vector {
  readonly dx: number;
  readonly dy: number;
}

/** One piece's whole flight, fixed at launch. y grows DOWNWARD. */
export interface ConfettiPiece {
  readonly origin: Point;
  /** Pixels per second at launch; a negative `dy` is thrown upward. */
  readonly velocity: Vector;
  /** Seconds after the burst before the piece exists. */
  readonly delay: number;
  /** Seconds the piece exists for, counted from its own launch. */
  readonly lifetime: number;
  readonly size: Size;
  readonly shape: 'rectangle' | 'circle';
  /** A token name from `src/theme/tokens.css` (design rule 4). Never a hue. */
  readonly colorName: string;
  readonly spinStart: number;
  /** Radians per second. */
  readonly spinRate: number;
  readonly tumbleRate: number;
  readonly tumblePhase: number;
  readonly flutterAmplitude: number;
  readonly flutterRate: number;
  readonly flutterPhase: number;
}

export interface ConfettiPieceState {
  readonly position: Point;
  /** Radians. */
  readonly rotation: number;
  /** The horizontal squash that reads as a piece turning over; floored, never zero. */
  readonly tumbleScale: number;
  readonly opacity: number;
}

export const CONFETTI_PHYSICS = {
  /** Pixels per second squared, downward. */
  gravity: 520,
  /** Linear drag per second: horizontal travel can never exceed `velocity.dx / drag`. */
  drag: 2.2,
  /** A piece fades out over the last `fadeOut` seconds of its life. */
  fadeOut: 0.7,
  /** Sway eases in over the first `flutterRampIn` seconds. */
  flutterRampIn: 0.6,
  minimumTumbleScale: 0.15,
} as const;

/**
 * Where `piece` is `time` seconds after its burst, or `null` before its delay and after its life.
 *
 *     x(t) = x₀ + vₓ/k · (1 − e^(−k·t)) + flutter(t)
 *     y(t) = y₀ + (v_y − g/k)/k · (1 − e^(−k·t)) + (g/k)·t
 *
 * A firework spark is the same flight under its own gravity and drag (150 / 2.4).
 */
export function confettiState(
  piece: ConfettiPiece,
  time: number,
  gravity: number = CONFETTI_PHYSICS.gravity,
  drag: number = CONFETTI_PHYSICS.drag,
): ConfettiPieceState | null {
  const flight = time - piece.delay;
  if (flight < 0 || flight > piece.lifetime) return null;
  const damping = 1 - Math.exp(-drag * flight);
  const terminal = gravity / drag;
  const flutter =
    piece.flutterAmplitude *
    Math.sin(piece.flutterRate * flight + piece.flutterPhase) *
    Math.min(1, flight / CONFETTI_PHYSICS.flutterRampIn);
  const across = piece.origin.x + (piece.velocity.dx / drag) * damping + flutter;
  const down =
    piece.origin.y + ((piece.velocity.dy - terminal) / drag) * damping + terminal * flight;
  return {
    position: { x: across, y: down },
    rotation: piece.spinStart + piece.spinRate * flight,
    tumbleScale: Math.max(
      CONFETTI_PHYSICS.minimumTumbleScale,
      Math.abs(Math.cos(piece.tumbleRate * flight + piece.tumblePhase)),
    ),
    opacity: Math.min(1, Math.max(0, (piece.lifetime - flight) / CONFETTI_PHYSICS.fadeOut)),
  };
}

const MASK_64 = (1n << 64n) - 1n;

/** Wraps to an unsigned 64-bit value, as Swift's `&*` / `&+` / `&-` do. */
export function u64(value: bigint): bigint {
  return value & MASK_64;
}

/**
 * SplitMix64, as the iOS `ConfettiRandom`. Deterministic is the point: the same burst must replay
 * the same pieces, and a web burst of ordinal N draws exactly the paper the phone draws for N.
 */
export class ConfettiRandom {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = u64(seed);
  }

  next(): bigint {
    this.state = u64(this.state + 0x9e3779b97f4a7c15n);
    let mixed = this.state;
    mixed = u64((mixed ^ (mixed >> 30n)) * 0xbf58476d1ce4e5b9n);
    mixed = u64((mixed ^ (mixed >> 27n)) * 0x94d049bb133111ebn);
    return mixed ^ (mixed >> 31n);
  }

  /** Uniform in `0..<1`, from the top 53 bits. */
  unit(): number {
    return Number(this.next() >> 11n) / 2 ** 53;
  }

  uniform(low: number, high: number): number {
    return low + (high - low) * this.unit();
  }
}
