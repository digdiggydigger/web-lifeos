// Ports of ConfettiPhysicsTests, ConfettiRecipeTests, CelebrationRecipeTests,
// ConfirmFireworksScheduleTests and ConfirmFireworksPhysicsTests. The asset-catalog lookups become
// lookups in the generated token list (a name missing there draws nothing, just as on iOS).
import { describe, expect, it } from 'vitest';

import { COLOR_TOKENS } from '@/theme/tokens';

import {
  CELEBRATION_RECIPES,
  CONFETTI_PALETTE,
  CONFETTI_PHYSICS,
  CONFIRM_CELEBRATION_GLOW,
  CONFIRM_CELEBRATION_DIM,
  ConfettiRandom,
  FIREWORK_SIZE_CLASSES,
  FIREWORKS_PALETTE,
  FIREWORK_SHELLS,
  FIREWORKS_PHYSICS,
  apexPoint,
  burstTime,
  confettiState,
  confirmFireworks,
  cannons,
  everyConfirm,
  everyConfirmLength,
  fireworkFlash,
  fireworkSparks,
  lastSparkTime,
  launchPoint,
  pace,
  popPieces,
  rain,
  riseDuration,
  shellPosition,
  sparkOpacity,
  stillField,
  stillFieldEnvelope,
  stillFieldState,
  stillPop,
  type ConfettiPiece,
  type FireworkShell,
} from '.';

const canvas = { width: 393, height: 852 };

function piece(overrides: Partial<ConfettiPiece> = {}): ConfettiPiece {
  return {
    origin: { x: 100, y: 200 },
    velocity: { dx: 0, dy: 0 },
    delay: 0,
    lifetime: 3,
    size: { width: 8, height: 5 },
    shape: 'rectangle',
    colorName: 'area-work-vivid',
    spinStart: 0,
    spinRate: 0,
    tumbleRate: 0,
    tumblePhase: 0,
    flutterAmplitude: 0,
    flutterRate: 0,
    flutterPhase: 0,
    ...overrides,
  };
}

function must<T>(value: T | null): T {
  expect(value).not.toBeNull();
  return value as T;
}

const tokenNames = new Set<string>(COLOR_TOKENS.map((t) => t.name));

describe('ConfettiRandom (SplitMix64)', () => {
  it('matches the reference SplitMix64 sequence for seed 0', () => {
    const random = new ConfettiRandom(0n);
    expect(random.next()).toBe(0xe220a8397b1dcdafn);
    expect(random.next()).toBe(0x6e789e6aa1b965f4n);
  });

  it('unit is in [0, 1) and deterministic per seed', () => {
    const a = new ConfettiRandom(7n);
    const b = new ConfettiRandom(7n);
    for (let i = 0; i < 100; i += 1) {
      const u = a.unit();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(b.unit()).toBe(u);
    }
  });
});

describe('ConfettiPhysics', () => {
  it('a piece is at its origin the moment it launches', () => {
    const launched = piece({
      velocity: { dx: 300, dy: -400 },
      delay: 0.25,
      spinStart: 1,
      spinRate: 5,
      flutterAmplitude: 12,
      flutterRate: 4,
      flutterPhase: 1.1,
    });
    const state = must(confettiState(launched, 0.25));
    expect(state.position.x).toBeCloseTo(100, 9);
    expect(state.position.y).toBeCloseTo(200, 9);
    expect(state.rotation).toBeCloseTo(1, 9);
    expect(state.opacity).toBeCloseTo(1, 9);
  });

  it('nothing is drawn before its delay or after its life', () => {
    const delayed = piece({ delay: 0.5, lifetime: 3 });
    expect(confettiState(delayed, 0.49)).toBeNull();
    expect(confettiState(delayed, 2)).not.toBeNull();
    expect(confettiState(delayed, 3.51)).toBeNull();
  });

  it('the flight is the record’s closed form', () => {
    const thrown = piece({ origin: { x: 50, y: 60 }, velocity: { dx: 200, dy: -300 } });
    const state = must(confettiState(thrown, 1));
    const damping = 1 - Math.exp(-2.2);
    expect(state.position.x).toBeCloseTo(50 + (200 / 2.2) * damping, 6);
    expect(state.position.y).toBeCloseTo(60 + ((-300 - 520 / 2.2) / 2.2) * damping + 520 / 2.2, 6);
    expect(CONFETTI_PHYSICS).toMatchObject({ gravity: 520, drag: 2.2 });
  });

  it('gravity wins, so every piece eventually falls', () => {
    const thrown = piece({ velocity: { dx: 0, dy: -900 }, lifetime: 10 });
    expect(must(confettiState(thrown, 0.1)).position.y).toBeLessThan(200);
    expect(must(confettiState(thrown, 3)).position.y).toBeGreaterThan(300);
  });

  it('drag bounds how far a piece can travel sideways', () => {
    const fired = piece({ velocity: { dx: 1900, dy: 0 }, lifetime: 10 });
    const travelled = must(confettiState(fired, 9)).position.x - 100;
    expect(travelled).toBeLessThan(1900 / 2.2);
    expect(travelled).toBeGreaterThan((0.99 * 1900) / 2.2);
  });

  it('a piece fades only over the last seven tenths', () => {
    const short = piece({ lifetime: 3 });
    expect(must(confettiState(short, 2)).opacity).toBeCloseTo(1, 9);
    expect(must(confettiState(short, 2.65)).opacity).toBeCloseTo(0.5, 9);
    expect(must(confettiState(short, 3)).opacity).toBeCloseTo(0, 9);
  });

  it('tumble never turns a piece fully edge-on', () => {
    const turning = piece({ lifetime: 4, tumbleRate: 1, tumblePhase: 0 });
    expect(must(confettiState(turning, Math.PI / 2)).tumbleScale).toBeCloseTo(0.15, 9);
    expect(must(confettiState(turning, Math.PI)).tumbleScale).toBeCloseTo(1, 9);
  });

  it('flutter eases in rather than jumping', () => {
    const swaying = piece({ flutterAmplitude: 10, flutterRate: 0, flutterPhase: Math.PI / 2 });
    expect(must(confettiState(swaying, 0.3)).position.x).toBeCloseTo(105, 9);
    expect(must(confettiState(swaying, 1)).position.x).toBeCloseTo(110, 9);
  });
});

describe('ConfettiRecipe', () => {
  it('every confirm is rain and cannons in the record’s counts', () => {
    const pieces = everyConfirm(canvas, 1);
    expect(pieces).toHaveLength(220);
    expect(pieces.filter((p) => p.origin.y < 0)).toHaveLength(120);
    expect(pieces.filter((p) => Math.abs(p.origin.y - canvas.height * 0.86) < 1e-9)).toHaveLength(
      100,
    );
  });

  it('rain starts above the screen and falls across its whole width', () => {
    const drops = rain(120, canvas, 7n);
    expect(drops).toHaveLength(120);
    for (const p of drops) {
      expect(p.origin.x).toBeGreaterThanOrEqual(-10);
      expect(p.origin.x).toBeLessThanOrEqual(canvas.width + 10);
      expect(p.origin.y).toBeGreaterThanOrEqual(-80);
      expect(p.origin.y).toBeLessThanOrEqual(-10);
      expect(Math.abs(p.velocity.dx)).toBeLessThanOrEqual(60);
      expect(p.velocity.dy).toBeGreaterThanOrEqual(420);
      expect(p.velocity.dy).toBeLessThanOrEqual(720);
      expect(p.delay).toBeLessThanOrEqual(0.6);
      expect(p.lifetime).toBeGreaterThanOrEqual(3.0);
      expect(p.lifetime).toBeLessThanOrEqual(3.6);
    }
    const xs = drops.map((p) => p.origin.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(canvas.width * 0.8);
  });

  it('cannons fire inward and up from both bottom corners', () => {
    const fired = cannons(100, canvas, 7n);
    expect(fired).toHaveLength(100);
    const left = fired.filter((p) => p.origin.x < 0);
    const right = fired.filter((p) => p.origin.x > canvas.width);
    expect(left).toHaveLength(50);
    expect(right).toHaveLength(50);
    for (const p of fired) {
      const degrees = (Math.atan2(-p.velocity.dy, Math.abs(p.velocity.dx)) * 180) / Math.PI;
      const speed = Math.hypot(p.velocity.dx, p.velocity.dy);
      expect(Math.abs(p.origin.y - canvas.height * 0.86)).toBeLessThan(1e-9);
      expect(degrees).toBeGreaterThanOrEqual(52 - 1e-9);
      expect(degrees).toBeLessThanOrEqual(78 + 1e-9);
      expect(speed).toBeGreaterThanOrEqual(1100 - 1e-9);
      expect(speed).toBeLessThanOrEqual(1900 + 1e-9);
      expect(p.delay).toBeLessThanOrEqual(0.12);
      expect(p.lifetime).toBeGreaterThanOrEqual(2.8);
      expect(p.lifetime).toBeLessThanOrEqual(3.5);
    }
    expect(left.every((p) => p.velocity.dx > 0)).toBe(true);
    expect(right.every((p) => p.velocity.dx < 0)).toBe(true);
  });

  it('the shape mix and sizes are the record’s', () => {
    const pieces = everyConfirm(canvas, 3);
    const rectangles = pieces.filter((p) => p.shape === 'rectangle');
    for (const r of rectangles) {
      expect(r.size.width).toBeGreaterThanOrEqual(7);
      expect(r.size.width).toBeLessThanOrEqual(10);
      expect(r.size.height).toBeGreaterThanOrEqual(4);
      expect(r.size.height).toBeLessThanOrEqual(6);
    }
    for (const c of pieces.filter((p) => p.shape === 'circle')) {
      expect(c.size).toEqual({ width: 6, height: 6 });
    }
    expect(Math.abs(rectangles.length / pieces.length - 0.75)).toBeLessThan(0.1);
  });

  it('colours cycle through the seven record tokens', () => {
    expect(CONFETTI_PALETTE).toEqual([
      'area-work-vivid',
      'area-health-vivid',
      'area-growth-vivid',
      'area-hobby-vivid',
      'area-orange-vivid',
      'state-go-vivid',
      'state-warn-vivid',
    ]);
    expect(rain(14, canvas, 1n).map((p) => p.colorName)).toEqual([
      ...CONFETTI_PALETTE,
      ...CONFETTI_PALETTE,
    ]);
  });

  it('every colour is a real token', () => {
    for (const name of [
      ...CONFETTI_PALETTE,
      CONFIRM_CELEBRATION_GLOW.colorName,
      CONFIRM_CELEBRATION_DIM.colorName,
    ]) {
      expect(tokenNames.has(name), name).toBe(true);
    }
  });

  it('the same confirmation replays and the next one differs', () => {
    const first = everyConfirm(canvas, 5);
    expect(first).toHaveLength(220);
    expect(first).toEqual(everyConfirm(canvas, 5));
    expect(first).not.toEqual(everyConfirm(canvas, 6));
  });

  it('a confirm burst lasts until its last piece has landed', () => {
    const pieces = everyConfirm({ width: 393, height: 852 }, 1);
    const lastLanding = Math.max(...pieces.map((p) => p.delay + p.lifetime)) / pace();
    expect(lastLanding).toBeLessThanOrEqual(everyConfirmLength());
    expect(lastLanding).toBeGreaterThan(5);
  });
});

describe('CelebrationRecipes', () => {
  const tap = { x: 120, y: 300 };
  const phone = { width: 390, height: 844 };
  const scale = CELEBRATION_RECIPES.popScale;

  it('the pop scale is the value E chose by looking', () => {
    expect(scale).toBe(1.6);
  });

  it('a pop is between nineteen and thirty-two pieces', () => {
    expect(CELEBRATION_RECIPES.popCount).toEqual({ min: 19, max: 32 });
    for (let ordinal = 1; ordinal <= 40; ordinal += 1) {
      const n = popPieces(tap, ordinal).length;
      expect(n).toBeGreaterThanOrEqual(19);
      expect(n).toBeLessThanOrEqual(32);
    }
  });

  it('a pop leaves from the tap point and is gone within a second', () => {
    const pieces = popPieces(tap, 1);
    const speeds = pieces.map((p) => Math.hypot(p.velocity.dx, p.velocity.dy));
    for (const p of pieces) {
      expect(p.origin.x).toBeCloseTo(tap.x, 4);
      expect(p.origin.y).toBeCloseTo(tap.y, 4);
      expect(p.lifetime).toBeGreaterThanOrEqual(0.7);
      expect(p.lifetime).toBeLessThanOrEqual(1.0);
    }
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(250 * scale - 0.001);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(450 * scale + 0.001);
  });

  it('a pop’s pieces are the confirm’s paper scaled up', () => {
    for (const p of popPieces(tap, 3)) {
      if (p.shape === 'rectangle') {
        expect(p.size.width).toBeGreaterThanOrEqual(7 * scale - 0.001);
        expect(p.size.width).toBeLessThanOrEqual(10 * scale + 0.001);
        expect(p.size.height).toBeGreaterThanOrEqual(4 * scale - 0.001);
        expect(p.size.height).toBeLessThanOrEqual(6 * scale + 0.001);
      } else {
        expect(p.size.width).toBeCloseTo(6 * scale, 3);
      }
    }
  });

  it('the milestone’s still field keeps the confirm’s own paper size', () => {
    for (const p of stillField(phone, 3)) {
      if (p.shape === 'rectangle') {
        expect(p.size.width).toBeGreaterThanOrEqual(7);
        expect(p.size.width).toBeLessThanOrEqual(10);
      } else {
        expect(p.size.width).toBeCloseTo(6, 3);
      }
    }
  });

  it('every new recipe uses the confirm’s seven tokens', () => {
    const palette = new Set<string>(CONFETTI_PALETTE);
    for (const p of [...popPieces(tap, 3), ...stillPop(tap, 3), ...stillField(phone, 3)]) {
      expect(palette.has(p.colorName)).toBe(true);
    }
  });

  it('the same ordinal draws the same pop and the next draws another', () => {
    expect(popPieces(tap, 7)).toEqual(popPieces(tap, 7));
    expect(popPieces(tap, 7)).not.toEqual(popPieces(tap, 8));
  });

  it('the still pop’s spread scales with the pop', () => {
    expect(CELEBRATION_RECIPES.stillPopSpread).toBe(48 * scale);
  });

  it('the still pop is the same count at rest near the tap point', () => {
    for (let ordinal = 1; ordinal <= 20; ordinal += 1) {
      const still = stillPop(tap, ordinal);
      expect(still).toHaveLength(popPieces(tap, ordinal).length);
      for (const p of still) {
        expect(p.velocity).toEqual({ dx: 0, dy: 0 });
        expect(Math.hypot(p.origin.x - tap.x, p.origin.y - tap.y)).toBeLessThanOrEqual(
          CELEBRATION_RECIPES.stillPopSpread + 1e-9,
        );
      }
    }
  });

  it('the still field is 120 pieces at rest across the whole canvas', () => {
    const field = stillField(phone, 1);
    expect(field).toHaveLength(CELEBRATION_RECIPES.stillFieldCount);
    expect(CELEBRATION_RECIPES.stillFieldCount).toBe(120);
    for (const p of field) {
      expect(p.velocity).toEqual({ dx: 0, dy: 0 });
      expect(p.origin.x).toBeGreaterThanOrEqual(0);
      expect(p.origin.x).toBeLessThanOrEqual(phone.width);
      expect(p.origin.y).toBeGreaterThanOrEqual(0);
      expect(p.origin.y).toBeLessThanOrEqual(phone.height);
    }
  });

  it('a still piece never moves from the opening pose it arrives in', () => {
    const p = must(stillField(phone, 1)[0] ?? null);
    const length = 5.4;
    const first = must(stillFieldState(p, 0.01, length));
    const last = must(stillFieldState(p, length - 0.01, length));
    expect(first.position).toEqual(p.origin);
    expect(last.position).toEqual(first.position);
    expect(last.rotation).toBe(first.rotation);
    expect(last.tumbleScale).toBe(first.tumbleScale);
  });

  it('a still piece fades in over 0.3 s and out over the last 0.7 s', () => {
    const p = must(stillField(phone, 1)[0] ?? null);
    const length = 5.4;
    expect(stillFieldState(p, -0.01, length)).toBeNull();
    expect(stillFieldState(p, length + 0.01, length)).toBeNull();
    expect(must(stillFieldState(p, 0.15, length)).opacity).toBeCloseTo(0.5, 2);
    expect(must(stillFieldState(p, 0.3, length)).opacity).toBeCloseTo(1, 4);
    expect(must(stillFieldState(p, 2.0, length)).opacity).toBeCloseTo(1, 4);
    expect(must(stillFieldState(p, length - 0.35, length)).opacity).toBeCloseTo(0.5, 2);
    expect(stillFieldEnvelope(-1, length)).toBe(0);
  });
});

describe('ConfirmFireworksSchedule', () => {
  const shells = FIREWORK_SHELLS;

  it('fourteen shells launch over the record’s 2.6 s', () => {
    expect(shells).toHaveLength(14);
    expect(shells.map((s) => s.launch)).toEqual([
      0.05, 0.3, 0.55, 0.8, 0.95, 1.2, 1.4, 1.55, 1.75, 1.95, 2.2, 2.35, 2.55, 2.6,
    ]);
  });

  it('every shell bursts where the record puts it', () => {
    expect(shells.map((s) => [s.apex.x, s.apex.y])).toEqual([
      [0.28, 0.3],
      [0.72, 0.22],
      [0.5, 0.4],
      [0.18, 0.18],
      [0.84, 0.36],
      [0.4, 0.16],
      [0.64, 0.46],
      [0.26, 0.5],
      [0.78, 0.14],
      [0.5, 0.28],
      [0.15, 0.34],
      [0.86, 0.26],
      [0.36, 0.22],
      [0.66, 0.24],
    ]);
  });

  it('the burst kinds and sizes are the record’s', () => {
    expect(shells.map((s) => s.burst)).toEqual([
      'single',
      'twoTone',
      'ringInRing',
      'single',
      'twoTone',
      'ringInRing',
      'single',
      'twoTone',
      'single',
      'twoTone',
      'ringInRing',
      'single',
      'twoTone',
      'ringInRing',
    ]);
    expect(shells.map((s) => s.size)).toEqual([
      'big',
      'big',
      'big',
      'medium',
      'medium',
      'big',
      'small',
      'small',
      'big',
      'big',
      'medium',
      'medium',
      'big',
      'big',
    ]);
  });

  it('every shell wears the record’s colours', () => {
    expect(shells.map((s) => s.colorNames)).toEqual([
      ['state-warn-vivid'],
      ['area-growth-vivid', 'area-health-vivid'],
      ['area-hobby-vivid', 'area-admin-vivid'],
      ['area-work-vivid'],
      ['state-go-vivid', 'area-admin-vivid'],
      ['area-orange-vivid', 'area-health-vivid'],
      ['area-growth-vivid'],
      ['area-red-vivid', 'state-warn-vivid'],
      ['area-health-vivid'],
      ['area-hobby-vivid', 'area-work-vivid'],
      ['state-go-vivid', 'area-growth-vivid'],
      ['area-admin-vivid'],
      ['area-orange-vivid', 'area-growth-vivid'],
      ['state-warn-vivid', 'area-hobby-vivid'],
    ]);
  });

  it('two-tone and ring-in-ring shells carry two colours and singles one', () => {
    for (const s of shells) {
      expect(s.colorNames).toHaveLength(s.burst === 'single' ? 1 : 2);
    }
  });

  it('the shells use nine real tokens and never grey or risk', () => {
    const used = new Set(shells.flatMap((s) => s.colorNames));
    expect(used.size).toBe(9);
    expect(used).toEqual(new Set(FIREWORKS_PALETTE));
    expect(new Set(FIREWORKS_PALETTE)).toEqual(
      new Set([...CONFETTI_PALETTE, 'area-admin-vivid', 'area-red-vivid']),
    );
    expect(used.has('area-slate-vivid')).toBe(false);
    expect(used.has('state-risk')).toBe(false);
    for (const name of FIREWORKS_PALETTE) expect(tokenNames.has(name), name).toBe(true);
  });

  it('the three size classes are the record’s', () => {
    expect(FIREWORK_SIZE_CLASSES).toEqual({
      big: { sparkCount: 72, sparkSpeed: 400, sparkLife: 1.45 },
      medium: { sparkCount: 56, sparkSpeed: 310, sparkLife: 1.3 },
      small: { sparkCount: 40, sparkSpeed: 220, sparkLife: 1.1 },
    });
  });

  it('the schedule fires 880 sparks in all', () => {
    expect(shells.reduce((sum, s) => sum + FIREWORK_SIZE_CLASSES[s.size].sparkCount, 0)).toBe(880);
  });

  it('the last spark dies at 4.79 s, derived from the schedule', () => {
    expect(lastSparkTime()).toBeCloseTo(4.79, 6);
    const latest = Math.max(
      ...shells.map((s) => burstTime(s) + FIREWORK_SIZE_CLASSES[s.size].sparkLife),
    );
    expect(lastSparkTime()).toBeCloseTo(latest, 9);
  });
});

describe('ConfirmFireworksPhysics', () => {
  function shell(overrides: Partial<FireworkShell> = {}): FireworkShell {
    return {
      launch: 1,
      apex: { x: 0.5, y: 0.3 },
      burst: 'single',
      colorNames: ['state-warn-vivid'],
      size: 'big',
      ...overrides,
    };
  }
  const speed = (p: ConfettiPiece) => Math.hypot(p.velocity.dx, p.velocity.dy);
  const angle = (p: ConfettiPiece) => Math.atan2(p.velocity.dy, p.velocity.dx);
  function angleDistance(a: number, b: number): number {
    const twoPi = 2 * Math.PI;
    let d = (a - b) % twoPi;
    if (d < 0) d += twoPi;
    return Math.min(d, twoPi - d);
  }

  it('a shell rises longer the higher it bursts', () => {
    expect(riseDuration(shell({ apex: { x: 0.5, y: 0.3 } }))).toBeCloseTo(0.725, 9);
    expect(riseDuration(shell({ apex: { x: 0.5, y: 0.14 } }))).toBeCloseTo(0.765, 9);
    expect(burstTime(shell({ launch: 2.6, apex: { x: 0.66, y: 0.24 } }))).toBeCloseTo(3.34, 9);
  });

  it('a shell launches just right of its apex from near the bottom edge', () => {
    const fired = shell({ apex: { x: 0.28, y: 0.3 } });
    const start = launchPoint(fired, canvas);
    expect(start.x).toBeCloseTo(0.3 * 393, 6);
    expect(start.y).toBeCloseTo(0.96 * 852, 6);
    const apex = apexPoint(fired, canvas);
    expect(apex.x).toBeCloseTo(0.28 * 393, 6);
    expect(apex.y).toBeCloseTo(0.3 * 852, 6);
  });

  it('a shell climbs eased from its launch point to its apex, then vanishes', () => {
    const fired = shell({ launch: 1, apex: { x: 0.5, y: 0.3 } });
    expect(shellPosition(fired, 0.99, canvas)).toBeNull();
    expect(must(shellPosition(fired, 1, canvas)).y).toBeCloseTo(0.96 * 852, 6);
    const halfway = must(shellPosition(fired, 1 + 0.725 / 2, canvas));
    const climb = 0.96 * 852 - 0.3 * 852;
    expect(halfway.y).toBeCloseTo(0.96 * 852 - climb * 0.75, 6);
    expect(halfway.x).toBeCloseTo(0.52 * 393 - 0.02 * 393 * 0.75, 6);
    expect(must(shellPosition(fired, 1.725, canvas)).y).toBeCloseTo(0.3 * 852, 6);
    expect(shellPosition(fired, 1.7251, canvas)).toBeNull();
  });

  it('each size class bursts into the record’s spark count', () => {
    expect(fireworkSparks(shell({ size: 'big' }), 0, canvas)).toHaveLength(72);
    expect(fireworkSparks(shell({ size: 'medium' }), 0, canvas)).toHaveLength(56);
    expect(fireworkSparks(shell({ size: 'small' }), 0, canvas)).toHaveLength(40);
  });

  it('sparks leave the apex at the burst and live their class’s life', () => {
    const fired = shell({ launch: 0.3, apex: { x: 0.72, y: 0.22 }, size: 'medium' });
    const sparks = fireworkSparks(fired, 1, canvas);
    expect(sparks).toHaveLength(56);
    const apex = apexPoint(fired, canvas);
    const burst = burstTime(fired);
    for (const s of sparks) {
      expect(Math.abs(s.origin.x - apex.x)).toBeLessThan(1e-9);
      expect(Math.abs(s.origin.y - apex.y)).toBeLessThan(1e-9);
      expect(Math.abs(s.delay - burst)).toBeLessThan(1e-9);
      expect(Math.abs(s.lifetime - 1.3)).toBeLessThan(1e-9);
      expect(s.size).toEqual({ width: 2.4, height: 2.4 });
      expect(s.flutterAmplitude).toBe(0);
      expect(s.spinRate).toBe(0);
      expect(s.tumbleRate).toBe(0);
    }
  });

  it('sparks spread evenly at near their class speed', () => {
    const sparks = fireworkSparks(shell({ size: 'small' }), 3, canvas);
    const speeds = sparks.map(speed);
    for (const v of speeds) {
      expect(v).toBeGreaterThanOrEqual(176 - 1e-9);
      expect(v).toBeLessThanOrEqual(220 + 1e-9);
    }
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(10);
    sparks.forEach((s, i) => {
      expect(angleDistance(angle(s), (2 * Math.PI * i) / 40)).toBeCloseTo(0, 6);
    });
  });

  it('single shells burst in one colour and two-tone shells alternate', () => {
    const single = fireworkSparks(shell({ colorNames: ['area-work-vivid'] }), 0, canvas);
    expect(new Set(single.map((s) => s.colorName))).toEqual(new Set(['area-work-vivid']));
    const twoTone = fireworkSparks(
      shell({ burst: 'twoTone', colorNames: ['area-growth-vivid', 'area-health-vivid'] }),
      0,
      canvas,
    );
    expect(twoTone).toHaveLength(72);
    expect(twoTone.filter((s) => s.colorName === 'area-growth-vivid')).toHaveLength(36);
    expect(twoTone.filter((s) => s.colorName === 'area-health-vivid')).toHaveLength(36);
    expect(twoTone.slice(0, 4).map((s) => s.colorName)).toEqual([
      'area-growth-vivid',
      'area-health-vivid',
      'area-growth-vivid',
      'area-health-vivid',
    ]);
  });

  it('a ring-in-ring shell nests a slower inner ring in the second colour', () => {
    const sparks = fireworkSparks(
      shell({ burst: 'ringInRing', colorNames: ['area-hobby-vivid', 'area-admin-vivid'] }),
      2,
      canvas,
    );
    expect(sparks).toHaveLength(72);
    const outer = sparks.filter((s) => s.colorName === 'area-hobby-vivid');
    const inner = sparks.filter((s) => s.colorName === 'area-admin-vivid');
    expect(outer).toHaveLength(36);
    expect(inner).toHaveLength(36);
    for (const v of outer.map(speed)) {
      expect(v).toBeGreaterThanOrEqual(320 - 1e-9);
      expect(v).toBeLessThanOrEqual(400 + 1e-9);
    }
    for (const v of inner.map(speed)) {
      expect(v).toBeGreaterThanOrEqual(176 - 1e-9);
      expect(v).toBeLessThanOrEqual(220 + 1e-9);
    }
    const step = (2 * Math.PI) / 36;
    outer.forEach((s, i) => expect(angleDistance(angle(s), step * i)).toBeCloseTo(0, 6));
    inner.forEach((s, i) => expect(angleDistance(angle(s), step * (i + 0.5))).toBeCloseTo(0, 6));
  });

  it('the same shell bursts the same way every time', () => {
    const fired = shell({
      burst: 'twoTone',
      colorNames: ['area-red-vivid', 'state-warn-vivid'],
      size: 'small',
    });
    expect(fireworkSparks(fired, 7, canvas)).toEqual(fireworkSparks(fired, 7, canvas));
    expect(fireworkSparks(fired, 7, canvas)).not.toEqual(fireworkSparks(fired, 8, canvas));
  });

  it('sparks fly the confetti model at their own gravity and drag', () => {
    const spark = piece({
      origin: { x: 100, y: 300 },
      velocity: { dx: 200, dy: 0 },
      lifetime: 2,
      size: { width: 2.4, height: 2.4 },
      shape: 'circle',
    });
    const light = must(confettiState(spark, 1, 150, 2.4));
    const paper = must(confettiState(spark, 1));
    const terminal = 150 / 2.4;
    const damping = 1 - Math.exp(-2.4);
    expect(light.position.y).toBeCloseTo(300 + ((-terminal / 2.4) * damping + terminal), 6);
    expect(light.position.x).toBeCloseTo(100 + (200 / 2.4) * damping, 6);
    expect(paper.position.y).toBeGreaterThan(light.position.y);
    expect(paper).toEqual(confettiState(spark, 1, CONFETTI_PHYSICS.gravity, CONFETTI_PHYSICS.drag));
    expect(confettiState(spark, 2.01, 150, 2.4)).toBeNull();
    expect(FIREWORKS_PHYSICS).toMatchObject({ sparkGravity: 150, sparkDrag: 2.4 });
  });

  it('a spark fades on the power curve', () => {
    expect(sparkOpacity(1.45, 0)).toBeCloseTo(1, 9);
    expect(sparkOpacity(1.45, 0.725)).toBeCloseTo(0.5 ** 1.4, 9);
    expect(sparkOpacity(1.45, 1.45)).toBeCloseTo(0, 9);
    expect(sparkOpacity(1.45, 2)).toBeCloseTo(0, 9);
    expect(sparkOpacity(1.45, -0.1)).toBeCloseTo(0, 9);
  });

  it('the burst flash swells and fades over a third of a second', () => {
    expect(fireworkFlash(-0.01)).toBeNull();
    const start = must(fireworkFlash(0));
    expect(start.radius).toBeCloseTo(40, 9);
    expect(start.alpha).toBeCloseTo(0.35, 9);
    const middle = must(fireworkFlash(0.175));
    expect(middle.radius).toBeCloseTo(140, 9);
    expect(middle.alpha).toBeCloseTo(0.175, 9);
    expect(fireworkFlash(0.35)).toBeNull();
  });

  it('a stack-clearing display launches every shell and its sparks once', () => {
    const fireworks = confirmFireworks(canvas);
    expect(fireworks.shells).toHaveLength(14);
    expect(fireworks.sparks).toHaveLength(14);
    expect(fireworks.sparks.reduce((sum, list) => sum + list.length, 0)).toBe(880);
    fireworks.shells.forEach((s, i) => {
      const apex = apexPoint(s, canvas);
      for (const spark of fireworks.sparks[i] ?? []) {
        expect(Math.abs(spark.origin.x - apex.x)).toBeLessThan(1e-9);
        expect(Math.abs(spark.origin.y - apex.y)).toBeLessThan(1e-9);
      }
    });
  });
});
