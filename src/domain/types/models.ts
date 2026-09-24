/**
 * The domain models, mirroring the iOS `*Models.swift` types field for field. Pure data: no
 * Firebase types here. Dates are `Date`; ids are uppercase-UUID strings; an absent optional means
 * "not recorded" (never `null`), matching the documents on the wire.
 */

export type TaskStatus = 'open' | 'done';
export const TASK_STATUSES: readonly TaskStatus[] = ['open', 'done'];

export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4';
export const TASK_PRIORITIES: readonly TaskPriority[] = ['p1', 'p2', 'p3', 'p4'];

/** `Tasks/TaskModels.swift` (`TaskItem`) + `Tasks/TaskDetailModels.swift` (`TaskDetail`). */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly lifeAreaId?: string;
  readonly notes?: string;
  readonly dueDate?: Date;
  /** Required on every document iOS writes; optional on read so an old document never blanks a list. */
  readonly createdAt?: Date;
  readonly focusDurationSeconds?: number;
  readonly nudgesCount?: number;
  /** Stamped with `status: done`, erased on reopen (`TaskCompletionStamp`). */
  readonly completedAt?: Date;
  /** Where the task CAN be done (intent). */
  readonly atPlaceId?: string;
  /** Where the task WAS closed; travels with `completedAt`. */
  readonly placeId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** Soft-delete stamp. Absent means LIVE. */
  readonly deletedAt?: Date;
  /** Membership written only via arrayUnion/arrayRemove; never encoded on create. */
  readonly tagIds?: readonly string[];
}

/** `Home/HomeModels.swift` (`LifeArea`). `colour` holds an EMOJI; `palette` is the colour family override. */
export interface LifeArea {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly palette?: string;
}

/** `Tasks/TagModels.swift`. */
export interface Tag {
  readonly id: string;
  readonly name: string;
  readonly deletedAt?: Date;
}

export type CaptureKind = 'note' | 'task' | 'link' | 'voice' | 'photo';
export const CAPTURE_KINDS: readonly CaptureKind[] = ['note', 'task', 'link', 'voice', 'photo'];

export interface CaptureLinkPreview {
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly thumbnailURL?: string;
}

/** `Capture/CaptureModels.swift`. */
export interface Capture {
  readonly id: string;
  readonly content: string;
  readonly kind: CaptureKind;
  readonly processed: boolean;
  readonly createdAt: Date;
  readonly title?: string;
  readonly lifeAreaId?: string;
  readonly mediaURL?: string;
  readonly mediaContentType?: string;
  readonly thumbnailURL?: string;
  readonly linkPreview?: CaptureLinkPreview;
  readonly aiAssessment?: string;
  readonly notes?: string;
  /** When the capture left the inbox; deleted again when an archive is undone. */
  readonly clearedAt?: Date;
  /** The archive flag: seen stays unprocessed so it can still be promoted. Absent means false. */
  readonly seen?: boolean;
  readonly tagIds?: readonly string[];
  readonly placeId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly deletedAt?: Date;
}

export type LogType = 'log' | 'journal';
export const LOG_TYPES: readonly LogType[] = ['log', 'journal'];

export type EnergyLevel = 'low' | 'medium' | 'high';
export const ENERGY_LEVELS: readonly EnergyLevel[] = ['low', 'medium', 'high'];

/** `Journal/LogModels.swift`. Append-only on the wire: rules deny update. */
export interface Log {
  readonly id: string;
  readonly type: LogType;
  readonly body: string;
  readonly entryDate: Date;
  readonly createdAt: Date;
  readonly lifeAreaId?: string;
  /** Journal entries only; an energy level this build does not know decodes as absent, never as an error. */
  readonly energyLevel?: EnergyLevel;
  readonly moodEmoji?: string;
  /** Written once at create: logs cannot be updated. */
  readonly tagIds?: readonly string[];
  readonly placeId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

/** `Nudges/NudgeModels.swift`: `nudges/{id}`, snake_case; `schedule` is a `MIN HOUR * * DOW` cron string end to end. */
export interface Nudge {
  readonly id: string;
  readonly label: string;
  readonly schedule: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** The last dismissal; dueness is measured from it (or from `createdAt` before the first). */
  readonly lastFiredAt?: Date;
  readonly completionDates?: readonly Date[];
}

/** `Focus/FocusModels.swift` `CompletedFocusSession`: a finished sprint, `focus_sessions/{id}`, snake_case. */
export interface CompletedFocusSession {
  readonly id: string;
  readonly taskTitle: string;
  readonly lifeAreaEmoji: string;
  readonly plannedSeconds: number;
  readonly focusedSeconds: number;
  readonly checkpointsReached: number;
  readonly completedNaturally: boolean;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly taskId?: string;
  readonly placeId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly confirmedAt?: Date;
}

/** `users/{uid}` (`FirebaseManager.signUp`, `+Seed`). */
export interface Profile {
  readonly email?: string;
  readonly createdAt?: Date;
  readonly displayName?: string;
  /** The first-login marker: present once seeding has run. */
  readonly seededAt?: Date;
}
