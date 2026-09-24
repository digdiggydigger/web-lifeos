/** `ClosureRing` + the checkpoint dots (`SprintRingGeometry`): the sprint's progress with a mark per nudge. */
import type { ReactNode } from 'react';

import { checkpointDotState, ringDotCenter, sessionProgress } from '@/domain/focus';
import type { FocusSession } from '@/domain/focus';

interface SprintRingProps {
  readonly session: FocusSession;
  readonly size: number;
  readonly lineWidth: number;
  readonly label: string;
  readonly children?: ReactNode;
}

const dotClass = {
  reached: 'fill-state-go',
  next: 'fill-label-primary',
  pending: 'fill-label-tertiary',
} as const;

export function SprintRing({ session, size, lineWidth, label, children }: SprintRingProps) {
  const radius = (size - lineWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = sessionProgress(session);
  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="overflow-visible"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={lineWidth}
          className="stroke-track-neutral"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={`spring transition-[stroke-dashoffset] duration-500 ${session.isPaused ? 'stroke-label-tertiary' : 'stroke-accent'}`}
        />
        {session.nudgeCheckpoints.map((checkpoint, index) => {
          const state = checkpointDotState(index, session);
          const { x, y } = ringDotCenter(checkpoint, session.durationSeconds, size);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={state === 'next' ? 6 : 4}
              className={dotClass[state]}
            />
          );
        })}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
