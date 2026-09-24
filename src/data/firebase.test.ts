import { describe, expect, it } from 'vitest';

import { readFirebaseSettings } from './firebase';

const full = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'x.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'adhdlifeos-acb49',
  VITE_FIREBASE_STORAGE_BUCKET: 'adhdlifeos-acb49.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1',
  VITE_FIREBASE_APP_ID: '1:1:web:1',
  VITE_USE_EMULATORS: 'false',
};

describe('readFirebaseSettings', () => {
  it('maps the VITE_FIREBASE_* variables onto Firebase options', () => {
    const settings = readFirebaseSettings(full);
    expect(settings.options).toEqual({
      apiKey: 'key',
      authDomain: 'x.firebaseapp.com',
      projectId: 'adhdlifeos-acb49',
      storageBucket: 'adhdlifeos-acb49.firebasestorage.app',
      messagingSenderId: '1',
      appId: '1:1:web:1',
    });
    expect(settings.useEmulators).toBe(false);
  });

  it('turns the emulators on only for the exact string "true"', () => {
    expect(readFirebaseSettings({ ...full, VITE_USE_EMULATORS: 'true' }).useEmulators).toBe(true);
    expect(readFirebaseSettings({ ...full, VITE_USE_EMULATORS: 'TRUE' }).useEmulators).toBe(false);
    expect(readFirebaseSettings({ ...full, VITE_USE_EMULATORS: '1' }).useEmulators).toBe(false);
  });

  it('fails loudly when a required key is missing', () => {
    expect(() => readFirebaseSettings({ ...full, VITE_FIREBASE_API_KEY: '' })).toThrow(
      /VITE_FIREBASE_API_KEY/,
    );
  });
});
