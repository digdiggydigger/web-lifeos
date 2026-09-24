/** The Firebase implementation of `AuthClient` (the iOS `FirebaseAuthClientAdapter` + `FirebaseManager` auth half). */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import { firebase } from '../firebase';
import { ensureProfile } from '../repos/profileRepo';
import { seedDefaultContentIfNeeded } from '../seed';
import type { AuthClient, AuthUser } from './authClient';

function project(user: User, displayName?: string): AuthUser {
  const result: { uid: string; email?: string; displayName?: string } = { uid: user.uid };
  if (user.email) result.email = user.email;
  const name = displayName ?? user.displayName ?? undefined;
  if (name) result.displayName = name;
  return result;
}

/** Best-effort, like iOS: the session is live by now, so a seeding failure must not fail sign-in. */
async function seedQuietly(uid: string): Promise<void> {
  try {
    await seedDefaultContentIfNeeded(firebase().db, uid);
  } catch (error) {
    console.warn('Seeding failed; it retries on the next sign-in.', error);
  }
}

export class FirebaseAuthClient implements AuthClient {
  subscribe(onChange: (user: AuthUser | null) => void): () => void {
    const { auth } = firebase();
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        onChange(null);
        return;
      }
      // Seed BEFORE announcing the session, so no screen can write before the starter content lands.
      void seedQuietly(user.uid).then(() => onChange(project(user)));
    });
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { auth } = firebase();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await seedQuietly(credential.user.uid);
    return project(credential.user);
  }

  async signUp(
    email: string,
    password: string,
    displayName: string | undefined,
  ): Promise<AuthUser> {
    const { auth, db } = firebase();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      // Best-effort: the account exists and the session is live; a name that failed to stick must not fail sign-up.
      try {
        await updateProfile(credential.user, { displayName });
      } catch (error) {
        console.warn('Display name did not stick on the Auth user.', error);
      }
    }
    await ensureProfile(db, credential.user.uid, credential.user.email ?? email, displayName);
    await seedQuietly(credential.user.uid);
    return project(credential.user, displayName);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(firebase().auth, email);
  }

  async updateDisplayName(displayName: string | undefined): Promise<AuthUser> {
    const { auth } = firebase();
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in.');
    await updateProfile(user, { displayName: displayName ?? null });
    return project(user, displayName);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(firebase().auth);
  }
}
