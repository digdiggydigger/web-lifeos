/**
 * E's F5: one soft chime over the FULL-SCREEN celebrations only, behind the "Celebration sounds"
 * switch (off by default). **Web deviation:** the iOS chime is an asset (`CelebrationChime`) that
 * lives in the iOS catalog; this repo has none, so the web synthesises a short two-note chime with
 * the Web Audio API instead.
 *
 * Browsers only let audio start after a user gesture, so the context is created (or resumed) on
 * the first pointer or key press and never at load. A chime that cannot play is swallowed: the
 * confetti is the feedback and the chime is the garnish.
 */

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/** Two sine notes a major third apart, a soft attack and a one-second tail. */
const NOTES = [
  { frequency: 1046.5, at: 0 },
  { frequency: 1318.5, at: 0.12 },
] as const;
const PEAK_GAIN = 0.08;
const ATTACK = 0.015;
const TAIL = 0.9;

export interface CelebrationChime {
  play(): void;
}

export function createWebAudioChime(soundsEnabled: () => boolean): CelebrationChime {
  let context: AudioContext | undefined;

  function prime(): void {
    // No context at all unless the switch is on; the next gesture after turning it on creates one.
    if (!soundsEnabled()) return;
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    try {
      context ??= new Ctor();
      if (context.state === 'suspended') void context.resume();
    } catch {
      context = undefined;
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', prime, { capture: true, passive: true });
    document.addEventListener('keydown', prime, { capture: true });
  }

  return {
    play() {
      if (!soundsEnabled() || !context || context.state !== 'running') return;
      try {
        const start = context.currentTime;
        for (const note of NOTES) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = note.frequency;
          const t0 = start + note.at;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(PEAK_GAIN, t0 + ATTACK);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ATTACK + TAIL);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(t0);
          oscillator.stop(t0 + ATTACK + TAIL + 0.05);
        }
      } catch {
        // Swallowed: a celebration is never lost to an audio problem.
      }
    },
  };
}
