# Phase 3 handoff — for the next Claude Code session

Written 2026-09-24 at the end of the session that finished Phase 2 (M2.4–M2.6). Read `CLAUDE.md`
first (rules, commands, design rules), then this note. It holds what a fresh session cannot
recover from the repo: where the work stands, what E has instructed, the Phase 3 scope and a
proposed milestone plan, the decisions E has to make before Phase 3 code is written, and the
gotchas learned so far.

## Where things stand

- Branch `claude/nifty-sagan-tl3gt0`, head `a11e9af` (M2.6). Working tree clean, everything pushed.
  Phase 2 commits: `d61babe` M2.1, `99adc55` M2.2, `0cc8f1f` M2.3, `f262d66` M2.4 Celebrations,
  `0ee495e` M2.5 AI daily summary, `a11e9af` M2.6 journeys and deploy notes.
- Last verified on that head: `npm run check` → 59 files / 599 tests, build ok;
  `npm run test:emulator` → 13 files / 49 tests; e2e → 70 passed (desktop + phone).
- **Phase 2 is awaiting E's review and deploy.** Before starting Phase 3, ask E whether the Phase 1
  and Phase 2 checklists in `docs/DEPLOY.md` have been run and whether anything came back. Fix
  what they found first, as `fix:` commits.
- The iOS repo is the spec. A fresh container needs it cloned:
  `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/digdiggydigger/adhdlifeos /home/user/digdiggydigger/adhdlifeos`
  (sources under `ADHD LifeOS/`, tests under `ADHD LifeOSTests/`). Run `npm install` before
  anything. The e2e command in this container needs the prefix
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`.

## E's standing instructions

- E is the design authority. Direct instructions from E are the work queue. Confirm your
  understanding with E before starting a phase.
- Milestones back to back once E says go: one commit per milestone (`M3.<n>: …`), pushed
  immediately, no review pause between milestones. Stop at the end of the phase for E's review.
- Every milestone passes `npm run check`, `npm run test:emulator` and the e2e suite BEFORE it is
  committed. Reports paste the real terminal output; "it passes" without output is unverified.
- Domain first and TDD: port the Swift test file, watch it fail, then port the implementation.
  Skip the `*CallSiteTests` (they grep Swift source) and anything testing UIKit/ActivityKit.
- Firebase console steps and `npm run deploy` are E's. Claude Code prepares and verifies.
- Companion posture: the phone stays the trigger source (geofences, widgets, Live Activities,
  Lock Screen notifications). Record every web deviation in the commit message and the README's
  "Where the web deliberately differs" list.
- Schema changes are iOS-repo decisions first. `firebase/*.rules` are verbatim copies; never edit
  them to make a web test pass.

## Phase 3 scope (from `docs/ios-to-web-assessment.md`, the phasing table)

> **Places + Routines as viewer/editor:** Places list + editor with a web map + address search +
> radius, actions editor (https/sms only; scheme-based "open app" shown but not verifiable),
> routine plan, routine screen for runs the phone started, journal rows for location events and
> routines, Tools tab, arrival card from a foreground Geolocation fix, manual "I'm here".
> Ported from `Places/` minus the trigger engine (~6K of 9.5K LOC). Size: medium.

**Not ported, by design:** `CoreLocationTriggerMonitor`, `LocationTriggerService`,
`PlaceTriggerEventHandler`'s background path, `PlaceMonitoringCapacity` (the 20-region cap),
`RoutineActivity*`/`RoutineActivityKitPresenter` (Live Activities), `PlaceRoutineNotification*`
(the notification payload/tray/router), `PlaceAppInstallVerification` (no `canOpenURL` in a
browser), `MapKitAddressProvider`/`PlaceMapPicker` (replaced by the web map).

### The data involved (rules in `firebase/firestore.rules`)

| Collection                                      | Web may                             | Notes                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}/places`                            | full CRUD                           | **iOS `save()` overwrites the whole document** (`setData` without merge). A field the web adds is wiped on the next iOS edit. The web must write the complete document through a codec payload, and **unknown action kinds must survive a re-save** (`PlaceActionModels`). snake_case. |
| `users/{uid}/routine_runs`                      | full CRUD                           | Moves offered → started → ended in place (updatable). snake_case.                                                                                                                                                                                                                      |
| `users/{uid}/location_events`                   | read, create, delete; **no update** | Append-only, like logs.                                                                                                                                                                                                                                                                |
| `catalog/app_directory` (top-level `catalog/*`) | read only                           | The remote app directory for the "open app" action.                                                                                                                                                                                                                                    |
| `tasks.at_place_id`                             | already decoded                     | Where a task CAN be done. `place_id` + lat/lng travel with `completed_at` (the location stamp).                                                                                                                                                                                        |

### iOS sources to read, grouped (all under `ADHD LifeOS/Places/`)

- Models and pure logic: `PlaceModels`, `PlaceActionModels`, `PlaceActionEditing`,
  `PlaceEditorValidation`, `PlaceGeometry`, `PlaceMapGeometry`, `PlaceRoutinePlan`,
  `LocationEventModels`, `RoutineRun`, `RoutineRunRecord`, `RoutineRunReconciliation`,
  `PlaceRoutineRunTimeline`, `PlaceRoutineCompletion`, `RoutineDefaults`, `TriggerCooldown`,
  `LocationStamping`, `RecordLocationStamp`, `CaptureLocationStamp`, `CaptureLocationChoice`,
  `PlaceAppDirectory` (+`Bundled`, `Remote`), `PlaceLinkOpening`, `PlaceActionExecution`,
  `ArrivalSurface`, `ArrivalNudgeContent`, `PlaceAutomationGuide`.
- Adapters: `PlacesBackingStore`, `PlacesClientAdapting`, `FirebasePlacesClientAdapter`,
  `FirebaseAppDirectoryClientAdapter`, `RoutineRunRecording`, `RoutineRunHistoryService`,
  `PlacesService`.
- Screens: `PlacesListView`, `PlaceEditorView`, `PlaceActionsEditorView`, `PlaceActionsSection`,
  `PlaceAppPicker*`, `PlaceRoutineScreen*`, `PlaceRoutineCongratulation*`,
  `PlaceRoutineCompletedCard`, `ArrivalSurfaceCard`, `LocationPermissionBanner`/`Prompt`.
- Elsewhere: `Journal/JournalTimeline+RoutineRows.swift`, `Tools/ToolsView.swift` (routines
  catalog + last run), `Home/HomeView` (arrival or live-routine card).

### Swift tests to port (under `ADHD LifeOSTests/`)

`PlaceModelsTests`, `PlaceActionModelsTests`, `PlaceActionEditingTests`,
`PlaceActionExtraPayloadTests`, `PlaceOpenLink*Tests`, `PlaceEditorValidationTests`,
`PlaceGeometryTests`, `PlaceMapGeometryTests`, `PlaceAddressSearchTests`, `PlaceRoutinePlanTests`,
`PlaceRoutineCompletionTests`, `PlaceRoutineProgressTests`, `PlaceRoutineRunTimelineTests`,
`PlaceRoutineScreenCopyTests`, `PlaceRoutineDepartureEndTests`, `RoutineRunRecordTests`,
`RoutineRunReconciliationTests`, `RoutineRunHistoryServiceTests`, `RoutineRunStore*Tests`,
`RoutineDismissRoutingTests`, `RoutineDeferredLoggingTests`, `LocationEventTimelineTests`,
`LocationStampingTests`, `RecordLocationStampTests`, `CaptureLocationStamp*`/`Choice*Tests`,
`TaskLocationStampTests`, `FocusLocationStampTests`, `JournalLocationStampTests`,
`JournalPlaceLineTests`, `JournalRoutineRowsTests`, `JournalServiceRoutineRunsTests`,
`ArrivalSurface*Tests`, `ArrivalNudge*Tests`, `HomeRoutineCardTests`, `PlaceAppDirectory*Tests`,
`PlaceAppDestinationPickTests`, `PlaceAppPickerPresentationTests`, `PlaceAutomationGuideTests`,
`PlacesServiceTests`, `FirebasePlacesClientAdapterTests`, `FirebaseAppDirectoryClientAdapterTests`,
`FirebaseRoutineRunRecorderTests`, `TaskAtPlaceFieldTests`, `TaskCreateAtPlaceTests`,
`ToolsRoutinesCatalogTests`, `ToolsRoutinesLastRunTests`. Doubles: `FakePlacesBackingStore`,
`FakeAppDirectoryBackingStore`, `FakeRoutineRunStores`, `RoutineHandlerHarness`,
`RoutineActivationRig`. Skip the `*CallSiteTests`, `RoutineActivity*`,
`RoutineNotificationTray*`, `PlaceRoutineNotification*`, `PlaceRoutineRouter*`,
`LocationTriggerService*`, `LocationTriggerPlan*`, `PlaceTriggerTestFire*`,
`PlaceAppInstallVerification*` and `LocationAuthorization*` unless a decision below brings one in.

### Proposed milestones (a proposal: confirm the split with E before M3.1)

1. **M3.1 Places data.** Domain (models, actions incl. unknown-kind round trip, geometry, radius
   clamp, validation), codec payload `places.ts` writing the WHOLE document (tests assert the
   wrong convention is absent and unknown actions survive), `placesRepo`, emulator spec,
   `catalog/app_directory` read.
2. **M3.2 Places list and editor.** The web map (see decision 1), address search, radius, the
   actions editor (https and `sms:` executable; "open app" shown, marked unverifiable), the
   automation guide copy; Tools → Places becomes a real door (today it says "On your phone").
3. **M3.3 Routines.** Routine plan, the run lifecycle/record/reconciliation, the routine screen for
   runs the phone started (work the steps, end the run), Tools → Routines with last run, the
   `routineFinished` celebration milestone (the Celebrations layer already supports it; the
   `routineCover` surface exists in `CelebrationSurface`).
4. **M3.4 Journal rows.** Location events and routine rows in the timeline
   (`src/domain/journal/journalTimeline.ts` says they are Phase 3), the place line on entries.
5. **M3.5 Location on the web.** A foreground `navigator.geolocation` fix for the arrival or
   live-routine card on Today, location stamps on captures, closures, sprints and logs (the
   stamping rules), the task at-place field, and "I'm here" if decision 2 allows it.
6. **M3.6 Phase 3 journeys and deploy notes.** Journey pass, README deviations, a Phase 3
   checklist in `docs/DEPLOY.md`.

### Decisions to put to E before writing Phase 3 code

1. **Map provider.** Leaflet + OpenStreetMap tiles with Nominatim search is free, but
   Nominatim's usage policy forbids heavy use and autocomplete-as-you-type. Google Maps + Places
   Autocomplete gives better addresses, costs money and needs an API key (a restricted browser key
   is still a console step for E). Mapbox is the middle option. Recommendation: Leaflet + OSM
   tiles, with search on submit (not per keystroke) through Nominatim.
2. **"I'm here" and web-written crossings.** Should the web write `location_events` and offer
   `routine_runs` from a manual "I'm here" (the phone's handler, run in the foreground)? It is the
   one Phase 3 feature that writes trigger-shaped data from a second device, so cooldowns and
   duplicate runs across devices need a rule. Recommendation: allow it, reuse `TriggerCooldown`,
   and mark web-originated events (only if the schema allows it without an iOS change;
   otherwise ask).
3. **Location stamps on web writes.** Stamp only when the browser already has permission, or ask
   on first use? iOS stamps only with permission granted and the "Remember where things happen"
   switch on. Recommendation: the same switch, asked for on a gesture (never on load).
4. **`dailySummary` exposure** (open since the assessment): the function has no per-user quota,
   and the web makes sign-ups easier. App Check or a quota is a `functions/` change in the iOS
   repo, so E decides and schedules it.

## What Phase 2 delivered (patterns to reuse)

Each milestone: domain modules with the Swift tests ported (`src/domain/<area>/*.test.ts`), codec
payloads + repo writes with an emulator spec when data is written, a zustand vanilla store behind
a client seam with fake-client tests (`src/features/<area>/*Store.test.ts`), per-uid store caches,
screens, an e2e spec, then check → emulator → e2e → commit → push.

- **Celebrations** (`src/domain/celebrations/*`, `src/features/celebrations/*`): one app-wide
  centre (`appCelebrations.ts`: `celebrations.request(kind, origin)`, `popFrom(el)`,
  `centreOf(el)`), one canvas layer in `Shell.tsx`. A store that earns a milestone takes a
  `celebrate` option and its `use*Store` hook hands it to the centre (nudges, captures). Pops fire
  at the tap, as on iOS. Full-screen bursts are held behind any `dialog[open]`, the promote sheet
  (`surfacePresented('promoteSheet')`) and the capture composer. For M3.3: request
  `{ kind: 'milestone', milestone: 'routineFinished' }`; if the routine screen is a full-screen
  surface, call `surfacePresented('routineCover')` and mount a second `CelebrationLayer` with
  `surface="routineCover"`.
- **Daily summary** (`src/domain/dailySummary/*`, `src/features/dailySummary/*`): posts to
  same-origin `/api/daily-summary` (Hosting rewrite to Cloud Run `dailysummary`,
  `us-central1`). `scripts/assert-hosting-only.mjs` allows exactly that rewrite plus the SPA
  fallback, which must come last. Against the emulators the on-device synthesis is the generator.
- **Focus** exposes `latestConfirmation`; **nudges** exposes `dueNudges(nudges, now)`; Today's
  ring has `data-momentum-ring`.
- e2e helpers in `tests/e2e/support.ts`: `signUpAndEnter`, `uidFor`, `seedDueNudge` (Firestore
  emulator REST with `Authorization: Bearer owner`). The celebration layer's
  `data-last-burst` / `data-burst-count` / `data-celebrating` attributes let a spec assert what
  played without racing a one-second pop.

## Gotchas learned (Phase 2, on top of those in `docs/phase-2-handoff.md`)

- `Date` truncates to whole milliseconds. Anything ported from a Swift `TimeInterval` clock that
  tests at sub-millisecond precision uses fractional epoch ms (`performance.timeOrigin +
performance.now()`), not `Date`.
- Native `<dialog>` opened with `showModal()` sits in the browser's top layer, above every
  z-index. Anything that must be seen over a sheet has to be inside the dialog or wait for it.
- React runs effect cleanups before the child's new effects: a parent's "surface dismissed"
  cleanup can run while the child `<dialog>` is still open. Poll (the celebration hold watch does)
  rather than assume order.
- Playwright: a `div` with `aria-label` but no role has NO accessible name; give it a role
  (`article`, `region` via `<section>`) before locating it by name.
- `SectionLabel` renders an `h2`: never put it inside a `<p>`, and never override its colour with
  a second `text-*` class (the order is not guaranteed); use a plain span with the label classes.
- Swift argument evaluation order matters when porting seeded generators: draw from the random
  source in exactly the Swift order (argument order, then the callee's body).
- `npm run format` rewrites files you have open; re-read before an exact-string edit.

## First steps for the next session

1. Read `CLAUDE.md`, this note, then the Phase 3 row and the Places sections of
   `docs/ios-to-web-assessment.md`.
2. `npm install`, clone the iOS repo (above), and run the three suites to confirm the baseline
   (599 / 49 / 70).
3. Ask E about the Phase 1/2 deploy results, then put the four decisions and the milestone split
   to E. Start M3.1 only on E's go.
