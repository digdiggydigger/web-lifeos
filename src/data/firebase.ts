/**
 * The one place Firebase is initialised. Everything else imports `firebase()` from here.
 *
 * Config comes from `VITE_FIREBASE_*` (`.env.local` for a real project, `.env.test` for the
 * emulators). With `VITE_USE_EMULATORS=true` every service is pointed at the local Emulator Suite
 * (ports in `firebase.emulators.json`) before first use.
 */
import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

export interface FirebaseEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
}

export interface FirebaseSettings {
  readonly options: FirebaseOptions;
  readonly useEmulators: boolean;
}

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 } as const;

/** Pure: turns the env block into Firebase options, failing loudly on a missing key. */
export function readFirebaseSettings(env: FirebaseEnv): FirebaseSettings {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  const missing = [
    ['VITE_FIREBASE_API_KEY', apiKey],
    ['VITE_FIREBASE_PROJECT_ID', projectId],
    ['VITE_FIREBASE_APP_ID', appId],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (!apiKey || !projectId || !appId) {
    throw new Error(
      `Firebase config is incomplete: missing ${missing.join(', ')}. Copy .env.example to .env.local.`,
    );
  }
  const options: FirebaseOptions = { apiKey, projectId, appId };
  if (env.VITE_FIREBASE_AUTH_DOMAIN) options.authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  if (env.VITE_FIREBASE_STORAGE_BUCKET) options.storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
  if (env.VITE_FIREBASE_MESSAGING_SENDER_ID) {
    options.messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  }
  return { options, useEmulators: env.VITE_USE_EMULATORS === 'true' };
}

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;
  readonly storage: FirebaseStorage;
  readonly useEmulators: boolean;
}

let services: FirebaseServices | undefined;

/** Whether the persistent (IndexedDB) Firestore cache can be used in this runtime. */
function canPersist(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Initialise (once) and return the Firebase services for this app. */
export function firebase(
  settings: FirebaseSettings = readFirebaseSettings(import.meta.env),
): FirebaseServices {
  if (services) return services;
  if (settings.useEmulators && import.meta.env.PROD) {
    // A production bundle pointed at the emulator would look signed in and store nothing.
    throw new Error('Refusing to start: VITE_USE_EMULATORS=true in a production build.');
  }

  const app = getApps()[0] ?? initializeApp(settings.options);
  const auth = getAuth(app);
  // Offline reads in the browser: the persistent cache is opt-in on web (memory is the default).
  const db = initializeFirestore(app, {
    localCache: canPersist()
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
  });
  const storage = getStorage(app);

  if (settings.useEmulators) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
    connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
  }

  services = { app, auth, db, storage, useEmulators: settings.useEmulators };
  return services;
}
