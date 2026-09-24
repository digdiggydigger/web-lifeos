# Deploying web-lifeos

This repo deploys **Firebase Hosting only**, to its **own site** in the `adhdlifeos-acb49` project.
It never deploys Firestore rules, Storage rules or Cloud Functions (those belong to the iOS repo),
and `npm run check` fails if `firebase.json` ever gains those keys.

## One-time setup (E, in the Firebase console or CLI on the Mac)

1. **Register a Web App.** Project settings → Your apps → Add app → Web. Copy the config object's
   values into `.env.local` (start from `.env.example`). Set `VITE_USE_EMULATORS=false`.
2. **Create the Hosting site.** Hosting → Add another site → `adhd-lifeos-web`
   (or `npx firebase hosting:sites:create adhd-lifeos-web`). If you pick a different id, change it
   in `.firebaserc` under `targets.adhdlifeos-acb49.hosting.web`. The existing "LifeOS" site is
   untouched: a site is addressed only by its own id.
3. **Authorize the domains for sign-in.** Authentication → Settings → Authorized domains: add
   `adhd-lifeos-web.web.app` and `adhd-lifeos-web.firebaseapp.com` (and any custom domain later).

## Every deploy

```bash
npm ci
VITE_BUILD=$(git rev-parse --short HEAD) npm run check   # lint, spacing grid, hosting-only guard, format, typecheck, unit tests, build
npm run deploy         # = firebase deploy --only hosting:web  (uses the dist/ from the build)
```

`VITE_BUILD` is optional: it is the build number shown in Settings → About next to the package
version (CI sets it to the commit SHA).

`npm run deploy` needs the Firebase CLI login on the Mac (`npx firebase login:list`). It uploads
`dist/` to the `web` target and nothing else.

## What to check after a deploy (the Phase 1 loop)

1. Open `https://adhd-lifeos-web.web.app`, sign in with your real account.
2. Today shows your real life areas (names and emoji) from Firestore.
3. Tasks: the Momentum buckets match the phone; create one, close it, Undo it; open it and rename
   it, then navigate away (autosave); the phone shows the same task on its next refresh.
4. Areas: the cards and the week share match; open an area, close a task from there.
5. Journal: the timeline shows today's closures and entries; write a journal entry (paper pad).
6. Captures: capture a note, Task it, Journal it, Sort it; the capsule undoes each; the phone's
   inbox agrees.
7. Tools → Recently Deleted: a task, a capture and a tag you deleted are there; Restore one.
8. Settings: rename yourself; the appearance override; Delete Account only on a throwaway account.
9. Install it to the Home Screen on the phone (Share → Add to Home Screen); it opens standalone.
10. On the iPhone app, nothing has changed: same data, same rules.

## Local development against the real project

```bash
npm run dev            # loads .env.local (real project). Never commit .env.local.
npm run dev:emulator   # loads .env.test and talks to the local Emulator Suite
npm run emulators      # start the Emulator Suite on its own (UI at http://127.0.0.1:4000)
```
