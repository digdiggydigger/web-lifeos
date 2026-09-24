/** `FocusNotificationPlanning`: one notification per checkpoint still ahead, plus the completion at the deadline. */
import { checkpointPrompt, elapsedSeconds, isSessionComplete } from './focusSession';
import type { FocusSession } from './focusSession';
import { humanSpan } from './focusTimeFormatting';

export type ScheduledFocusNotificationKind =
  { readonly kind: 'checkpoint'; readonly index: number } | { readonly kind: 'sprintComplete' };

export interface ScheduledFocusNotification {
  readonly kind: ScheduledFocusNotificationKind;
  readonly fireDate: Date;
  readonly title: string;
  readonly body: string;
  readonly identifier: string;
}

export const FOCUS_NOTIFICATION_PREFIX = 'focusSprint.';

export function focusNotificationIdentifier(kind: ScheduledFocusNotificationKind): string {
  return kind.kind === 'checkpoint'
    ? `${FOCUS_NOTIFICATION_PREFIX}checkpoint.${kind.index}`
    : `${FOCUS_NOTIFICATION_PREFIX}complete`;
}

export function planFocusNotifications(
  session: FocusSession | undefined,
  deadline: Date | undefined,
  now: Date,
): ScheduledFocusNotification[] {
  if (!session || !deadline || session.isPaused || isSessionComplete(session)) return [];
  const total = session.nudgeCheckpoints.length;
  const elapsed = elapsedSeconds(session);
  const notifications: ScheduledFocusNotification[] = [];
  session.nudgeCheckpoints.forEach((mark, index) => {
    if (session.triggeredCheckpointIndices.has(index) || mark <= elapsed) return;
    const kind = { kind: 'checkpoint', index } as const;
    notifications.push({
      kind,
      fireDate: new Date(now.getTime() + (mark - elapsed) * 1000),
      title: `Checkpoint ${index + 1} of ${total} · ${session.taskTitle}`,
      body: checkpointPrompt(index, total),
      identifier: focusNotificationIdentifier(kind),
    });
  });
  notifications.push({
    kind: { kind: 'sprintComplete' },
    fireDate: deadline,
    title: `${session.lifeAreaEmoji} Sprint complete`,
    body: `${humanSpan(session.durationSeconds)} on ${session.taskTitle}. Tap to log it and clear the Lock Screen.`,
    identifier: focusNotificationIdentifier({ kind: 'sprintComplete' }),
  });
  return notifications;
}
