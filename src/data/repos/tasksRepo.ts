/**
 * `tasks` (`FirebaseManager+Tasks.swift` + the three task adapters): the exact iOS queries, plus
 * a live watch. Every write goes through the codec builders.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Firestore, Unsubscribe } from 'firebase/firestore';

import { deleted, live, requireLive } from '@/domain/softDelete';
import type { Task, TaskStatus } from '@/domain/types';

import { decodeList } from '../codec/decodeList';
import type { DecodedList } from '../codec/decodeList';
import { taskRestore, taskSoftDelete, taskStatus, taskUpdate } from '../codec/payloads/tasks';
import type { LocationStamp, TaskUpdatePayload } from '../codec/payloads/tasks';
import { decodeTask, encodeTask } from '../codec/schemas';
import type { NewTask } from '../codec/schemas';
import type { WatchCallbacks } from './lifeAreasRepo';

function tasksCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'tasks');
}

function taskDoc(db: Firestore, uid: string, id: string) {
  return doc(db, 'users', uid, 'tasks', id);
}

function newestFirst(db: Firestore, uid: string) {
  return query(tasksCollection(db, uid), orderBy('created_at', 'desc'));
}

function liveList(list: DecodedList<Task>): DecodedList<Task> {
  return { items: live(list.items), skipped: list.skipped };
}

/** `fetchTasks`: newest first, soft-deleted dropped. */
export async function fetchTasks(db: Firestore, uid: string): Promise<DecodedList<Task>> {
  const snapshot = await getDocs(newestFirst(db, uid));
  return liveList(decodeList(snapshot.docs, decodeTask));
}

export function watchTasks(
  db: Firestore,
  uid: string,
  callbacks: WatchCallbacks<Task>,
): Unsubscribe {
  return onSnapshot(
    newestFirst(db, uid),
    (snapshot) => callbacks.onData(liveList(decodeList(snapshot.docs, decodeTask))),
    (error) => callbacks.onError(error),
  );
}

/** `fetchOpenTaskSummaries`: the `status == open` query (Home's badge count). */
export async function fetchOpenTasks(db: Firestore, uid: string): Promise<DecodedList<Task>> {
  const snapshot = await getDocs(query(tasksCollection(db, uid), where('status', '==', 'open')));
  return liveList(decodeList(snapshot.docs, decodeTask));
}

/** `fetchTasks(lifeAreaId:)`: unsorted (a composite index would be needed); callers order for display. */
export async function fetchTasksForLifeArea(
  db: Firestore,
  uid: string,
  lifeAreaId: string,
): Promise<DecodedList<Task>> {
  const snapshot = await getDocs(
    query(tasksCollection(db, uid), where('life_area_id', '==', lifeAreaId)),
  );
  return liveList(decodeList(snapshot.docs, decodeTask));
}

/** The Recently Deleted list: exactly what `fetchTasks` drops. */
export async function fetchDeletedTasks(db: Firestore, uid: string): Promise<DecodedList<Task>> {
  const snapshot = await getDocs(newestFirst(db, uid));
  const list = decodeList(snapshot.docs, decodeTask);
  return { items: deleted(list.items), skipped: list.skipped };
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`No task ${id}`);
    this.name = 'TaskNotFoundError';
  }
}

/** `fetchTaskDetail`: strict single read; throws `ItemIsDeletedError` for a soft-deleted task. */
export async function fetchTask(db: Firestore, uid: string, id: string): Promise<Task> {
  const snapshot = await getDoc(taskDoc(db, uid, id));
  if (!snapshot.exists()) throw new TaskNotFoundError(id);
  return requireLive(decodeTask(snapshot.data()));
}

/** `createTask`: a full-document write; `tag_ids` is never part of it. */
export async function createTask(db: Firestore, uid: string, task: NewTask): Promise<void> {
  await setDoc(taskDoc(db, uid, task.id), encodeTask(task));
}

/** `updateTask` then re-read, as the detail adapter does. An empty payload writes nothing. */
export async function updateTask(
  db: Firestore,
  uid: string,
  id: string,
  payload: TaskUpdatePayload,
): Promise<Task> {
  const fields = taskUpdate(payload);
  if (Object.keys(fields).length > 0) await updateDoc(taskDoc(db, uid, id), fields);
  return fetchTask(db, uid, id);
}

/** `setTaskStatus`: status, completion stamp and location trio in one write, client clock. */
export async function setTaskStatus(
  db: Firestore,
  uid: string,
  id: string,
  status: TaskStatus,
  now: Date,
  stamp?: LocationStamp,
): Promise<void> {
  await updateDoc(taskDoc(db, uid, id), taskStatus(status, now, stamp));
}

export async function softDeleteTask(
  db: Firestore,
  uid: string,
  id: string,
  now: Date,
): Promise<void> {
  await updateDoc(taskDoc(db, uid, id), taskSoftDelete(now));
}

export async function restoreTask(db: Firestore, uid: string, id: string): Promise<void> {
  await updateDoc(taskDoc(db, uid, id), taskRestore());
}

/** The irreversible one: the launch purge and "Delete forever" only. */
export async function hardDeleteTask(db: Firestore, uid: string, id: string): Promise<void> {
  await deleteDoc(taskDoc(db, uid, id));
}
