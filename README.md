# web-lifeos

The web companion to [ADHD LifeOS](https://github.com/digdiggydigger/ADHDLifeOS): a browser client
for the same Firebase backend (same Auth users, same Firestore documents, same Storage paths). The
phone stays the trigger source for places, routines, widgets and notifications; the web gives a
full-size, keyboard-driven surface for everything else.

## Status

**Phase 0 and Phase 1 are complete** on this branch: tooling and the design tokens, Firebase and the
codec, auth and seeding, Tasks, Life Areas and Tags, Journal, Captures, Recently Deleted and Undo,
Settings and account deletion, and the Tools tab. Phase 2 (momentum on Today, focus sprints) and
Phase 3 (places, read-only) are next. Voice captures wait for a server transcription function.

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
