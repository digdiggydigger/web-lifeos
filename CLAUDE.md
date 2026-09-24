# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**The web companion to ADHD LifeOS.** The iOS app lives in `digdiggydigger/ADHDLifeOS` (SwiftUI, Firebase). This repo is a browser client for the **same Firebase backend** (project `adhdlifeos-acb49`): same Auth users, same Firestore documents, same Storage paths. It is a companion, not a replacement: the phone stays the trigger source for places, routines, widgets and notifications; the web gives a full-size, keyboard-driven surface for everything else.

The assessment that scoped this work is `docs/ios-to-web-assessment.md`. Read it before touching the data layer: it holds the field-by-field contract and the traps.

**E is the design authority, in chat.** Direct instructions from E are the work queue. Stop and wait for E's review when a milestone is complete unless told to continue.

## What this repo owns, and what it does not

| Owned here                                                               | Owned by the iOS repo (never edit or deploy from here)                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| The web client, its tests, CI, `firebase.json` (hosting only), this file | `firestore.rules`, `storage.rules`, `functions/`, the Firestore schema and its conventions |

`firebase/*.rules` in this repo are **verbatim copies** for the emulator. If they drift from the iOS repo, update the copy; never edit them to make a web test pass. A schema change is an iOS-repo decision first.

## Commands

```bash
npm install
npm run check            # lint + format:check + typecheck + unit tests + build; the bar for every change
npm run test:emulator    # data-layer tests against the Firebase Emulator Suite with the real rules (from M0.3)
npm run test:e2e         # Playwright journeys. In this cloud container prefix with
                         #   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium  (uses the pre-installed browser)
npm run dev              # local dev server
npm run deploy           # firebase deploy --only hosting:web  — E runs this, not Claude Code
```

A change is not done until `npm run check` passes and, where the data layer or a screen changed, the emulator and e2e suites too. **Paste the real terminal output in the report**; "it passes" without output is an unverified claim (E's standing rule, inherited from the iOS repo).

## Architecture

```
src/domain/    pure TypeScript ported from the iOS pure-logic files, tests beside each file. No Firebase, no React, no data layer (ESLint enforces it).
src/data/      Firebase only here. codec/ is the ONE place that knows the Firestore conventions; repos/ run the exact iOS queries; store/ feeds onSnapshot into slices.
src/features/  screens, one folder per iOS feature directory.
src/theme/     tokens.css (the iOS colour sets, light + dark), motion, appearance override.
src/app/       router, shell, providers, auth gate.
src/shared/    reusable UI primitives.
tests/emulator/ repo tests run under `firebase emulators:exec`. tests/e2e/ Playwright.
```

**Writes go only through `src/data/codec/payloads/*` and the schemas.** Never build a Firestore field dictionary inline in a repo or a screen. The codec tests assert the wrong naming convention is _absent_ as well as the right one present, because a wrong key raises nothing and writes a field nothing reads.

**Conventions that must hold on every write** (details and sources in the assessment):

- Document IDs are UPPERCASE UUID strings, duplicated in an `id` field. Reference fields (`life_area_id`, `tag_ids[]`, `place_id`…) are uppercase too.
- Dates are Firestore `Timestamp`s. Never ISO strings or numbers.
- Absent optionals are omitted, never `null`. Clearing a field uses `deleteField()`.
- Tasks, tags, logs, life areas, nudges, places, focus_sessions, routine_runs are snake_case. **Captures are camelCase** (`lifeAreaId`, `mediaURL`, `deletedAt`, `clearedAt`) except `created_at` and `tag_ids`.
- Paired writes stay paired: `status` + `completed_at` (+ location stamp); `processed: true` + `clearedAt`.
- `life_areas.colour` holds an emoji. `save` on life areas writes the whole document.
- iOS decodes strictly: an unknown enum value or a missing required field on ONE document blanks the whole list on the phone. Write only known values.

**Reads are defensive.** `decodeList` skips a document that fails its schema, logs it, and surfaces the count to the UI. Never silently hide a bad document.

**Domain first, TDD.** For every piece of logic, port the Swift test file first (`ADHD LifeOSTests/<Name>Tests.swift`), watch it fail, then port the implementation. The Swift tests are the spec that keeps both clients agreeing on what a streak or a due nudge is.

## Design rules (adapted from the iOS repo's §1–§7; `pt` → `px`)

1. **Typography:** semantic scale only (Tailwind `text-*` steps), strong hierarchy, `tracking-tight` on large titles, system font stack. No fixed pixel font sizes on content.
2. **Spacing grid:** **4 / 8 / 16 / 24 px only.** `12` and `20` are banned. (The iOS tab-bar `12` waiver is iOS-only.)
3. **Hit targets:** 44 × 44 px minimum on every interactive element, on every viewport. Whole card zones are tappable.
4. **Colour:** **zero hex outside `src/theme/tokens.css`.** Consume tokens through Tailwind's `@theme` names. Both appearances always; the in-app appearance override (system/light/dark) is intentional.
5. **Motion:** spring-like easing on state changes; **under `prefers-reduced-motion` replace motion with an opacity fade, never remove the feedback** and never hard-cut something that appears or disappears.
6. **Layout:** every screen works at 375 px wide and on a desktop. Bottom navigation at ≤ 768 px, sidebar above. Sheets on phone widths may be dialogs on desktop.
7. **Accessibility:** labels on every control, `aria-live` for undo and status, focus visible, keyboard reachable.

## Git

- Branch for this arc: `claude/nifty-sagan-tl3gt0`. One commit per milestone (or a `WIP:` commit mid-milestone), pushed immediately after each commit.
- Commit format: `M<phase>.<n>: <short description>` for milestone work, `chore:` / `docs:` / `fix:` otherwise.
- Never end a session with uncommitted or unpushed changes.

## Manual steps are E's

Firebase console changes (registering the Web App, creating the hosting site, authorized domains), `npm run deploy`, and anything needing the Firebase CLI's login are E's steps. Claude Code prepares and verifies; E publishes.

## Public repository

This repo is public. The Firebase **web** config (API key, project id, app id) is a client identifier, not a secret, but it stays in the gitignored `.env.local` by default. Never commit a service-account key, a token, `.env.local`, or anything from the Firebase console beyond the web config.
