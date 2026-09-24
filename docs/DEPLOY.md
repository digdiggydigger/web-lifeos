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
npm run check          # lint, spacing grid, hosting-only guard, format, typecheck, unit tests, build
npm run deploy         # = firebase deploy --only hosting:web  (uses the dist/ from the build)
```

`npm run deploy` needs the Firebase CLI login on the Mac (`npx firebase login:list`). It uploads
`dist/` to the `web` target and nothing else.

## What to check after the first deploy

1. Open `https://adhd-lifeos-web.web.app`, sign in with your real account.
2. Today shows your real life areas (names and emoji) from Firestore.
3. Install it to the Home Screen on the phone (Share → Add to Home Screen); it opens standalone.
4. On the iPhone app, nothing has changed: same data, same rules.

## Local development against the real project

```bash
npm run dev            # loads .env.local (real project). Never commit .env.local.
npm run dev:emulator   # loads .env.test and talks to the local Emulator Suite
npm run emulators      # start the Emulator Suite on its own (UI at http://127.0.0.1:4000)
```
