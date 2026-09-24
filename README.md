# web-lifeos

The web companion to [ADHD LifeOS](https://github.com/digdiggydigger/ADHDLifeOS): a browser client
for the same Firebase backend (same Auth users, same Firestore documents, same Storage paths). The
phone stays the trigger source for places, routines, widgets and notifications; the web gives a
full-size, keyboard-driven surface for everything else.

## Status

**Phases 0, 1 and 2 are complete** on this branch. Phase 1: tooling and the design tokens, Firebase
and the codec, auth and seeding, Tasks, Life Areas and Tags, Journal, Captures, Recently Deleted
and Undo, Settings and account deletion, and the Tools tab. Phase 2: momentum on Today (the ring,
best next move, week review), nudges, focus sprints, celebrations and the AI daily summary.
Phase 3 (places, read-only) is next. Voice captures wait for a server transcription function.

### Where the web deliberately differs from the phone

- **No Lock Screen or background notifications.** Nudge and sprint reminders are browser
  notifications, asked for on a Save (a gesture), and they fire only while a tab is open.
- **Sprint timers run in the tab.** A sprint survives a reload (it is persisted per account), and
  a sprint that ended while no tab was open reports itself on the next visit.
- **No location stamps** on captures, closures or sprints until Phase 3; places, routines and
  arrival nudges stay on the phone.
- **Celebrations:** the chime is synthesised with Web Audio (the iOS chime asset is not in this
  repo) and only plays after a click or key press on the page, as browsers require; there are no
  haptics; the routine-finished milestone waits for routines. Any open dialog holds a full-screen
  celebration until it closes (the phone asks UIKit; the web asks for `dialog[open]`).
- **The daily summary** reaches the iOS repo's `dailySummary` function through a same-origin
  Hosting rewrite (`/api/daily-summary`), because the function is deployed with CORS off. When the
  model call fails, the summary is synthesised on the device and labelled so.

The assessment that scoped the work: [`docs/ios-to-web-assessment.md`](docs/ios-to-web-assessment.md).
Deploying: [`docs/DEPLOY.md`](docs/DEPLOY.md). Working rules for Claude Code: [`CLAUDE.md`](CLAUDE.md).

## Commands

```bash
npm install
npm run check            # lint + spacing grid + hosting-only guard + format + typecheck + unit tests + build
npm run test:emulator    # data-layer tests against the Firebase Emulator Suite with the real rules
npm run test:e2e         # Playwright journeys, desktop and phone
npm run dev              # local dev server against the real project (.env.local)
npm run dev:emulator     # local dev server against the emulators (.env.test)
npm run deploy           # firebase deploy --only hosting:web
```

## Layout

```
src/domain/    pure TypeScript ported from the iOS pure-logic files, tests beside each file
src/data/      Firebase only here: codec (the ONE place that knows the Firestore conventions), repos, stores
src/features/  screens, one folder per iOS feature directory
src/theme/     the iOS colour sets as tokens (light + dark), motion, appearance override
src/app/       router, shell, providers, auth gate
tests/         emulator/ (repo tests under firebase emulators:exec) and e2e/ (Playwright)
```
