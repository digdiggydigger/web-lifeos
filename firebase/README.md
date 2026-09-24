# firebase/

**Verbatim copies** of `firestore.rules` and `storage.rules` from the iOS repo
(`digdiggydigger/ADHDLifeOS`), used ONLY by the emulator (`firebase.emulators.json`) so the
data-layer tests exercise the real security rules.

The iOS repo owns the rules. Never edit these to make a web test pass; if they drift, re-copy
them. This repo's `firebase.json` deliberately has no `firestore`/`storage` keys, so nothing
here can be deployed from this repo.
