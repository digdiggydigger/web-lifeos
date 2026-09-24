/** `TaskRowSwipe`: rightward swipe-to-close maths (the pop origin is a celebration detail, Phase 2). */
export const SWIPE_THRESHOLD = 75;
export const SWIPE_ELASTIC_LIMIT = 140;

export function swipeCloses(translation: number): boolean {
  return translation > SWIPE_THRESHOLD;
}

export function rubberBanded(translation: number): number {
  if (translation <= 0) return 0;
  if (translation <= SWIPE_THRESHOLD) return translation;
  return Math.min(SWIPE_THRESHOLD + (translation - SWIPE_THRESHOLD) * 0.4, SWIPE_ELASTIC_LIMIT);
}
