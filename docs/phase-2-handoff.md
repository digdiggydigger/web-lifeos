# Phase 2 handoff — for the next Claude Code session

> **Historical.** Phase 2 was completed after this note: M2.4 Celebrations (`f262d66`), M2.5 AI
> daily summary (`0ee495e`) and M2.6 journeys and deploy notes. The README lists the web
> deviations; `docs/DEPLOY.md` has E's Phase 2 checklist.

Written 2026-09-24 at the end of a session that delivered M2.1–M2.3. Read `CLAUDE.md` first (rules,
commands, design rules); this note is only what a fresh session cannot recover from the repo:
where the work stands, what E has instructed, and the M2.4/M2.5/M2.6 designs already worked out
from the iOS sources.

## Where things stand

- Branch `claude/nifty-sagan-tl3gt0`, head `0cc8f1f` (M2.3: Focus sprints). Working tree clean,
  everything pushed. Phase 2 commits so far: `d61babe` M2.1, `99adc55` M2.2, `0cc8f1f` M2.3.
- Last verified on that head: `npm run check` → 53 files / 397 tests, build ok;
  `npm run test:emulator` → 13 files / 49 tests; e2e → 62 passed (both viewports).
- iOS repo checkout for reference: `/home/user/digdiggydigger/adhdlifeos` (may need re-cloning in a
  fresh container: `digdiggydigger/ADHDLifeOS`). Sources under `ADHD LifeOS/`, tests under
  `ADHD LifeOSTests/`.
- Task list: #13 M2.1, #14 M2.2, #15 M2.3 completed; #16 M2.4 Celebrations in progress (nothing
  written yet); #17 M2.5 AI daily summary; #18 M2.6 Phase 2 journeys and deploy notes.

## E's instructions in force

- "Continue on with phase 2": milestones back to back, one commit per milestone
  (`M2.<n>: …`), pushed immediately, no review pause between milestones. Stop at the end of
  Phase 2 for E's review and deploy.
- Firebase console steps and `npm run deploy` are E's. The Phase 1 checklist in `docs/DEPLOY.md`
  is still E's to run.
- Companion posture: the phone stays the trigger source (Places, routines, widgets, Lock Screen
  notifications). Deviations are recorded in commit messages and the README.
- Reports paste real terminal output. "It passes" without output is unverified.
- Gemini/transcription is a Phase 4 idea (server function in the iOS repo), not Phase 2.

## What Phase 2 has delivered (patterns to reuse)

Each milestone follows the same shape: domain modules with the Swift tests ported
(`src/domain/<area>/*.test.ts`), codec payloads + repo writes with an emulator spec
(`tests/emulator/*.test.ts`), a zustand vanilla store behind a client seam with fake-client
tests (`src/features/<area>/*Store.test.ts`), per-uid store caches (`use<Area>Store.ts`), screens,
an e2e spec (`tests/e2e/*.spec.ts`), then check → emulator → e2e → commit → push.

- **M2.1 Momentum on Today**: `src/domain/momentum/*` (scoreboard, active goal, daily-goal
  tracker, week review/charts, `homeSections.ts`), `src/features/today/*` (home store porting
  HomeService, Today page, week review at `/today/week-review`). Daily-goal crossings are
  announced via `aria-live` only; the celebration is M2.4's.
- **M2.2 Nudges**: `src/domain/nudges/*`, `src/data/codec/payloads/nudges.ts`,
  `src/data/repos/nudgesRepo.ts`, `src/features/nudges/*` (store porting NudgesService, `/nudges`
  page, Today section with the first-run door). The store takes a `celebrate(milestone)` option
  (`'streakSeven'`) that is currently a no-op in `useNudgesStore.ts`. Web rule: a notification
  prompt needs a gesture, so it is asked on Save, never on load.
- **M2.3 Focus sprints**: `src/domain/focus/*`, `encodeFocusSession` + `saveFocusSession`,
  `src/features/focus/*` (store porting FocusSessionService with persistence keyed by uid in
  localStorage, `FocusBar.tsx` mounted in `Shell.tsx`, `/focus` detail, `FocusAnalyticsSection`
  on Today). The store exposes `latestConfirmation { ordinal, clearedStack }` and
  `latestConfirmableCompletion`; M2.4 listens to them. `tests/e2e/support.ts` now has `uidFor`.

## M2.4 Celebrations — design (sources read; ready to write)

iOS sources: `ADHD LifeOS/Celebrations/*` (CelebrationRequesting, CelebrationCenter,
CelebrationPolicy, CelebrationDayMarking, CelebrationBurst (queue), CelebrationRecipes,
CelebrationMotion, CelebrationFrame/Layer), `ADHD LifeOS/Focus/ConfettiPhysics.swift`,
`ConfirmCelebrationRecipe.swift`, `ConfirmFireworksSchedule.swift`, `ConfirmFireworksPhysics.swift`,
`ConfirmFireworksDrawing.swift` (the dim). Tests: `CelebrationCenterTests`,
`CelebrationCenterHeldBurstTests`, `CelebrationPolicyTests`, `CelebrationQueueTests`,
`CelebrationRecipeTests`, `CelebrationMotionTests`, `ConfirmCelebrationTimingTests`,
`ConfirmCelebrationDimTests`, `ConfettiRecipeTests`, `ConfettiPhysicsTests`,
`ConfirmFireworksScheduleTests`, `ConfirmFireworksPhysicsTests`,
`CaptureInboxServiceCelebrationTests`. Skip the `*CallSiteTests` (they grep Swift source) and
the sound-asset tests.

Proposed files:

- `src/domain/celebrations/celebrationModels.ts` — `CelebrationMilestone`
  (`inboxZero | routineFinished | streakSeven | dailyGoal`), `CelebrationKind`
  (`{kind:'confirm', clearedStack}` | `{kind:'milestone', milestone}` | `{kind:'pop'}`),
  `CelebrationSurface` (`root | routineCover | tasksSearch | promoteSheet`; only `promoteSheet`
  `dismissesItself`), `CelebrationOutcome` (`fullScreen | inPlace | nothing`),
  `CelebrationBurst {ordinal, kind, surface, start, origin?}`, `isFullScreen` (everything but
  pop), `clearedStack`.
- `celebrationPolicy.ts` — pop → inPlace always; confirm → fullScreen if enabled else nothing;
  milestone → fullScreen if enabled else inPlace. No clock, no cooldown (E removed it).
- `celebrationQueue.ts` — caps 3 full-screen / 8 pops, counted per family; pop length 1.0 s;
  clocks: `choreographyLength 4.2`, `extraLength 1.2`, `everyConfirmLength 5.4`,
  `stackClearingChoreographyLength 5.0`, `pace = 4.2/5.4`, `stackClearingLength = 5.0/pace ≈ 6.43`;
  milestone and plain confirm last 5.4 s, stack-clearing confirm 6.43 s; `choreographyTime` =
  elapsed × pace for full-screen, raw seconds for pops; `adding` prunes then caps; `pruned`;
  `nextExpiry` (soonest end).
- `celebrationMotion.ts` — reduce motion: confirm still plays `full` (E waived rule 7.2 for it);
  milestones and pops render `still`.
- `celebrationDayMarking.ts` — key `celebrations.lastCelebratedDay.<milestone>.<uid>`, stores
  start-of-day epoch; `hasCelebrated`/`markCelebrated` (localStorage, try/catch). Used only by the
  daily goal today; marked BEFORE the request (F7: no replay after undo-and-recross).
- `confettiPhysics.ts` — `ConfettiPiece` fields as iOS; constants gravity 520, drag 2.2,
  fadeOut 0.7, flutterRampIn 0.6, minimumTumbleScale 0.15; the closed-form state (see
  `ConfettiPhysics.state` — copy the formulas exactly); `ConfettiRandom` = splitmix64 (needs
  BigInt; determinism per seed is what the tests check).
- `confettiRecipe.ts` — palette = `area-work-vivid, area-health-vivid, area-growth-vivid,
area-hobby-vivid, area-orange-vivid, state-go-vivid, state-warn-vivid` (use the Tailwind token
  names and read them via `getComputedStyle` on the canvas element); `everyConfirm` = rain(120)
  - cannons(100) with the ranges in `ConfirmCelebrationRecipe.swift`; glow (`state-go`, peak
    0.32, radius 760, envelope 0.3 in / hold to 0.9 / gone by 2.4, strongest of full-screen bursts).
- `celebrationRecipes.ts` — pop: 19–32 pieces, scale 1.6, speed 250–450 × 1.6, life 0.7–1.0,
  seeded by ordinal × 2654435761; stillPop (spread 48 × 1.6, velocity 0); stillField (120
  pieces, unscaled); still envelope 0.3 s in / 0.7 s out.
- `fireworks.ts` — the 14-shell schedule verbatim (launch times, apex fractions, burst kinds,
  colours, size classes: big 72/400/1.45, medium 56/310/1.3, small 40/220/1.1), physics
  constants (spark gravity 150, drag 2.4, launch lead 0.02, launch height 0.96, rise 0.55 +
  0.25 × (1 − apex.y), eased climb `1-(1-p)^2`, inner ring speed 0.55, flash 40→240 over 0.35 s
  at 0.35 alpha, fade power 1.4); `lastSparkTime` = 4.79 derived from the schedule; the dim
  (`scrim` token, peak 0.85, in 0.35, hold until lastSpark − 0.4 = 4.39, gone by 4.99, only for
  stack-clearing confirms, light scheme only).
- `src/features/celebrations/celebrationStore.ts` — port CelebrationCenter: `request(kind,
origin)` → outcome; ordinal per burst; burst tagged with the frontmost surface; a full-screen
  request while blocked (frontmost dismisses itself, or root with a capture composer open / a
  native `<dialog open>` present) is HELD and released when clear, restarted at release time,
  dropped after 60 s, chimes only when it plays; `surfacePresented/Dismissed`,
  `captureChanged(isOpen)`, `pollHeldBursts` (250 ms while anything is held), `prune(now)`.
  Chime hook fires for full-screen only; the daily goal also gets the "success feel" (no
  haptics on the web — keep the hook for the tests, no-op in production). Gate = live read of
  `preferencesStore.preferences.celebrationsEnabled`.
- Chime: no asset in this repo. Synthesise a two-note chime with the Web Audio API, gated by
  `celebrationSoundsEnabled`, created on the first user gesture (autoplay rules). Record it as
  a web deviation.
- `CelebrationLayer.tsx` — one fixed, `pointer-events-none`, `aria-hidden` canvas over the shell
  (surface `root`), drawing every burst on `requestAnimationFrame`: confetti (full physics or
  still field per `celebrationMotion`), the bottom radial glow for full-screen bursts, the dim
  and fireworks for stack-clearing confirms, pruning on each frame via `nextExpiry`. Pop origin
  = centre of the tapped control (`getBoundingClientRect`), in viewport coordinates.
- Triggers to wire: (1) pop on every task close (Tasks rows, Today "Close it", area detail
  rows, task detail close) — request AFTER the close lands, at the control's centre;
  (2) `dailyGoal` in `TodayPage` where the tracker crosses (mark the day first, then request at
  the ring's centre, keep the aria-live text); (3) `streakSeven` via `useNudgesStore`'s
  `celebrate` option; (4) `confirm(clearedStack)` in `FocusBar.tsx` on each change of
  `latestConfirmation`; (5) `inboxZero` in `captureInboxStore.ts` after sort / journal /
  promote of a capture that WAS waiting (`!processed && seen !== true`) when the inbox is now
  empty (loaded unprocessed list empty, else one `fetchUnprocessedCaptures`); never for
  discard or undoSeen or a failed write. `routineFinished` is Phase 3.
- `PromoteSheet.tsx` should call `surfacePresented('promoteSheet')` on open and
  `surfaceDismissed` on close so a milestone earned from it is held until it closes.
- Settings toggles already exist (`celebrationsEnabled`, `celebrationSoundsEnabled` in
  `src/domain/settings/momentumPreferences.ts`).
- e2e (`tests/e2e/celebrations.spec.ts`): close a task on Today and assert the layer canvas
  appears (a `data-celebrating` attribute or `aria-hidden` canvas count), then with
  celebrations off in Settings assert a confirm produces nothing while a pop still renders.

## M2.5 AI daily summary — design (endpoint read; UI not yet read)

- Server: the iOS repo's `functions/index.js` `dailySummary` — `POST`, `Authorization: Bearer
<Firebase ID token>`, JSON body `{date (ISO), tone, focusMinutesTotal, capturesCount,
completedTasks[{title, lifeAreaName, priority, focusMinutesLogged}], inProgressTasks[{title,
lifeAreaName}], journalEntries[{body, lifeAreaName, energyLevel?, moodEmoji?}]}`; response
  `{success, source, summary: {headline, dopamineWins[], journalReflections,
focusStaminaInsight, gentleTomorrowKickstart[]}}`; errors `{error}` with 401/400/500/502.
  Deployed URL (from `FirebaseDailySummaryGenerator.swift`):
  `https://dailysummary-dg5rypfbaq-uc.a.run.app`, region us-central1.
- **CORS**: the function is deployed with `cors: false`, so a browser on the hosting origin
  cannot call it directly. Use a Firebase Hosting rewrite to the Cloud Run service in
  `firebase.json` (`"rewrites": [{"source": "/api/daily-summary", "run": {"serviceId":
"dailysummary", "region": "us-central1"}}]`) so the call is same-origin; keep
  `scripts/assert-hosting-only.mjs` happy (it must allow a `run` rewrite under hosting). The
  web client posts to `/api/daily-summary`. Changing the function itself is an iOS-repo decision.
- Domain `src/domain/dailySummary/`: tones (`energizing | gentle | coaching | bulleted` with
  labels), `DailySummaryContent`, `GeneratedDailySummary {content, tone, generatedAt, source:
'model' | 'localSynthesis'}`, `buildDailySummaryRequest(date, tone, tasks, focusSessions,
logs, capturesCount, lifeAreaNames)` (completed today via `completedTasks`, open tasks capped
  at 5, focus seconds today, journal-type logs today, "General" for unassigned),
  `hasSomethingToSummarise`, the stub generator (`StubDailySummaryGenerator` copy per tone —
  port verbatim, it is the fallback when the endpoint fails), `dailySummaryCopyText`.
  Tests: `DailySummaryTests`, `DailySummaryHeadlineTests`, `DailySummarySnapshotTests`,
  `DailySummaryRebuildTests`, `DailySummaryServiceTests`, `DailySummaryGenerationCoordinatorTests`,
  `FirebaseDailySummaryGeneratorTests` (decode rules: non-2xx → 401 "Your session expired…",
  else the envelope's `error` or "The summary service returned an error (N)."; 2xx without
  `success`/`summary` → "The summary came back in a shape the app couldn't read.").
- Still to read for the UI and store: `Home/DailySummaryView.swift`,
  `DailySummaryResultCard.swift`, `DailySummaryStore.swift` (per-uid snapshot: tone + last
  summary, only today's summary restores), `DailySummaryGenerationCoordinator.swift`
  (one in-flight generation per uid, reattach), `HomeWeekReviewRow`/`WeekReviewView` for where
  the card sits (the week review page shows "daily summary (M2.5)").
- Client: `firebaseDailySummaryGenerator(auth)` → `getIdToken()` then `fetch('/api/daily-summary')`
  with a 90 s timeout; fallback to the stub on failure (as iOS). In dev/e2e the endpoint is
  unreachable, so the e2e asserts the local-synthesis path ("On-device synthesis" source label).

## M2.6 Phase 2 journeys and deploy notes

- `tests/e2e/journey.spec.ts`: extend with a Phase 2 pass (start a sprint from Today, dismiss a
  nudge, see the celebration layer, generate a summary).
- README: Phase 2 complete, the web deviations list (no Lock Screen notifications, in-tab
  timers only while a tab is open, no location stamps until Phase 3, synthesised chime,
  routines/arrival on the phone).
- `docs/DEPLOY.md`: a Phase 2 checklist for E — verify the `dailysummary` Cloud Run service
  name/region for the hosting rewrite, confirm the hosting site serves `/api/daily-summary`,
  test notifications permission on the deployed origin.
- Dedupe the `uidFor` helper (nudges.spec.ts has a private copy; support.ts now exports one).

## Gotchas learned this session

- Playwright `getByRole` names match substrings case-insensitively: use `exact: true` when one
  label is a prefix of another ("New nudge" vs "New nudge — label and schedule").
- Prettier reflows long JSX; when patching with string replacement, re-grep after `npm run format`.
- `exactOptionalPropertyTypes`: never spread `{ key: undefined }` into a zustand `set`; build the
  patch conditionally. Store state fields are `readonly`, so `set({...})` with a literal, not a
  mutated `Partial`.
- React Router's `navigate()` returns a promise: `void navigate(...)` or ESLint fails.
- `Notification.requestPermission()` only from a gesture; e2e grants `permissions:
['notifications']`.
- The Firestore emulator accepts `Authorization: Bearer owner` on its REST API for seeding;
  the Auth emulator's `accounts:signInWithPassword?key=fake-api-key` yields a uid.
- Spacing lint bans `-3`, `-5`, `-0.5`-style steps and arbitrary `px` padding/margins.
