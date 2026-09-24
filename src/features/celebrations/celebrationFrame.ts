/**
 * `Celebrations/CelebrationFrame.swift` and `Focus/ConfirmFireworksDrawing.swift`: one frame of every
 * live celebration at an explicit instant. Back to front: the dim (light appearance, stack-clearing
 * bursts only), the glow, the fireworks, then the confetti.
 *
 * Reduced motion is NOT read here: each scene arrives with its rendering already resolved by
 * `resolveCelebrationRendering` (E's waiver keeps Confirm in full).
 */
import {
  CONFIRM_CELEBRATION_DIM,
  CONFIRM_CELEBRATION_GLOW,
  FIREWORKS_PHYSICS,
  apexPoint,
  burstLength,
  burstTime,
  choreographyTime,
  confettiState,
  confirmFireworks,
  everyConfirm,
  fireworkFlash,
  popPieces,
  resolveCelebrationRendering,
  shellPosition,
  sparkOpacity,
  stillField,
  stillFieldState,
  stillPop,
  strongestDimEnvelope,
  strongestGlowEnvelope,
  type CelebrationBurst,
  type CelebrationRendering,
  type ConfettiPiece,
  type ConfettiPieceState,
  type ConfirmFireworks,
  type Size,
} from '@/domain/celebrations';

export interface CelebrationScene {
  readonly burst: CelebrationBurst;
  readonly rendering: CelebrationRendering;
  readonly confetti: readonly ConfettiPiece[];
  /** Only for a stack-clearing Confirm: the fireworks ARE the bigger burst. */
  readonly fireworks: ConfirmFireworks | null;
}

/** A burst's pieces, generated once per burst (never per frame). An origin-less pop is centred. */
export function sceneFor(
  burst: CelebrationBurst,
  canvas: Size,
  reduceMotion: boolean,
): CelebrationScene {
  const rendering = resolveCelebrationRendering(reduceMotion, burst.kind);
  const origin = burst.origin ?? { x: canvas.width / 2, y: canvas.height / 2 };
  let confetti: ConfettiPiece[];
  if (burst.kind.kind === 'pop') {
    confetti =
      rendering === 'full' ? popPieces(origin, burst.ordinal) : stillPop(origin, burst.ordinal);
  } else {
    // E's F8: milestones are the every-Confirm size, so they share its recipe exactly.
    confetti =
      rendering === 'full'
        ? everyConfirm(canvas, burst.ordinal)
        : stillField(canvas, burst.ordinal);
  }
  const cleared = burst.kind.kind === 'confirm' && burst.kind.clearedStack;
  return { burst, rendering, confetti, fireworks: cleared ? confirmFireworks(canvas) : null };
}

/** A token's resolved colour as `r, g, b, a` channels (the canvas normalises any CSS colour). */
export type ResolveColour = (tokenName: string) => readonly [number, number, number, number];

function rgba([r, g, b, a]: readonly [number, number, number, number], alpha = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${a * alpha})`;
}

function pieceState(scene: CelebrationScene, piece: ConfettiPiece, now: number, elapsed: number) {
  if (scene.rendering === 'full') return confettiState(piece, elapsed);
  return stillFieldState(piece, (now - scene.burst.start) / 1000, burstLength(scene.burst));
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: ConfettiPiece,
  state: ConfettiPieceState,
  colour: string,
): void {
  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.translate(state.position.x, state.position.y);
  ctx.rotate(state.rotation);
  ctx.scale(state.tumbleScale, 1);
  ctx.fillStyle = colour;
  const { width, height } = piece.size;
  if (piece.shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }
  ctx.restore();
}

function drawFireworks(
  ctx: CanvasRenderingContext2D,
  fireworks: ConfirmFireworks,
  time: number,
  resolve: ResolveColour,
): void {
  const p = FIREWORKS_PHYSICS;
  fireworks.shells.forEach((shell, index) => {
    const first = resolve(shell.colorNames[0] ?? 'state-warn-vivid');
    // The shell climbing: a 5 px head with a 2.5 px round-capped trail at 55%.
    const head = shellPosition(shell, time, fireworks.canvas);
    if (head) {
      const tail = shellPosition(
        shell,
        Math.max(shell.launch, time - p.shellTrail),
        fireworks.canvas,
      );
      ctx.save();
      ctx.strokeStyle = rgba(first);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo((tail ?? head).x, (tail ?? head).y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(first);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const sinceBurst = time - burstTime(shell);
    if (sinceBurst < 0) return;
    const flash = fireworkFlash(sinceBurst);
    if (flash) {
      const apex = apexPoint(shell, fireworks.canvas);
      const gradient = ctx.createRadialGradient(apex.x, apex.y, 0, apex.x, apex.y, flash.radius);
      gradient.addColorStop(0, rgba(first, flash.alpha));
      gradient.addColorStop(1, rgba(first, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(apex.x, apex.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4;
    for (const spark of fireworks.sparks[index] ?? []) {
      const at = confettiState(spark, time, p.sparkGravity, p.sparkDrag);
      if (!at) continue;
      const from =
        confettiState(
          spark,
          Math.max(spark.delay, time - p.sparkTrail),
          p.sparkGravity,
          p.sparkDrag,
        )?.position ?? at.position;
      ctx.globalAlpha = sparkOpacity(spark.lifetime, time - spark.delay);
      ctx.strokeStyle = rgba(resolve(spark.colorName));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(at.position.x, at.position.y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/** Draws every scene at `now` (epoch ms) onto a context already scaled to CSS pixels. */
export function drawCelebrationFrame(
  ctx: CanvasRenderingContext2D,
  scenes: readonly CelebrationScene[],
  now: number,
  canvas: Size,
  resolve: ResolveColour,
  darkAppearance: boolean,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bursts = scenes.map((s) => s.burst);

  // Light only (E, #7): dark never dims.
  const dim = darkAppearance ? 0 : strongestDimEnvelope(bursts, now);
  if (dim > 0) {
    ctx.fillStyle = rgba(
      resolve(CONFIRM_CELEBRATION_DIM.colorName),
      CONFIRM_CELEBRATION_DIM.peakOpacity * dim,
    );
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const glow = strongestGlowEnvelope(bursts, now);
  if (glow > 0) {
    const g = CONFIRM_CELEBRATION_GLOW;
    const colour = resolve(g.colorName);
    const cx = canvas.width / 2;
    const cy = canvas.height;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.radius);
    gradient.addColorStop(0, rgba(colour, g.peakOpacity * glow));
    gradient.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (const scene of scenes) {
    const elapsed = choreographyTime(scene.burst, now);
    if (scene.fireworks) drawFireworks(ctx, scene.fireworks, elapsed, resolve);
    for (const piece of scene.confetti) {
      const state = pieceState(scene, piece, now, elapsed);
      if (state) drawPiece(ctx, piece, state, rgba(resolve(piece.colorName)));
    }
  }
}
