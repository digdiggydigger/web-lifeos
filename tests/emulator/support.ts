import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';

import { EMULATOR_HOST, EMULATOR_PORTS, firebase } from '@/data/firebase';

const PROJECT_ID = 'demo-adhdlifeos';

/** Wipes Firestore and Auth in the emulators so every test file starts from nothing. */
export async function resetEmulators(): Promise<void> {
  const base = `http://${EMULATOR_HOST}`;
  const firestore = await fetch(
    `${base}:${EMULATOR_PORTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  const auth = await fetch(
    `${base}:${EMULATOR_PORTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'DELETE',
    },
  );
  if (!firestore.ok || !auth.ok) {
    throw new Error(`Emulator reset failed: firestore ${firestore.status}, auth ${auth.status}`);
  }
}

let counter = 0;

/** Creates and signs in a fresh user; returns its uid. */
export async function signUpTestUser(label: string): Promise<string> {
  const { auth } = firebase();
  counter += 1;
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${label}-${Date.now()}-${counter}@example.com`,
    'correct horse battery staple',
  );
  return credential.user.uid;
}

export async function signOutTestUser(): Promise<void> {
  await signOut(firebase().auth);
}
