# Phase 3 session opener

Written 2026-09-29. Phases 0–2 are deployed (head `297e025`); Phase 3 has not started. Fill in the
answers in step 3, then paste everything below the line into a fresh Claude Code session in the
`web-lifeos` directory. To skip the decision round, replace step 3 with "Go with your
recommendations on all four decisions and the milestone split" (still say whether the deploy
checks were run).

---

```
Resuming web-lifeos Phase 3 (Places + Routines). Before anything else:

1. Read CLAUDE.md, then docs/phase-3-handoff.md, then the Phase 3 row and the Places
   sections of docs/ios-to-web-assessment.md. Your memory note "phase-3-start-gate" has
   the state as of 2026-09-29; don't re-derive status from scratch.
2. Confirm the baseline: git status (branch claude/nifty-sagan-tl3gt0, expected head
   297e025 or the commit that added this file, clean), then run npm run check,
   npm run test:emulator and npm run test:e2e. Paste the real output.
   Expected: 599 unit / 49 emulator / 70 e2e.
   Make sure the iOS repo (the spec) is available locally; the handoff says how to clone it.
3. My answers to your open questions:
   - Deploy checks (docs/DEPLOY.md, the Phase 1 loop and the Phase 2 checklist):
     <run / not run yet — findings, if any>
   - Map provider: <Leaflet + OSM with search on submit / Google / Mapbox>
   - Manual "I'm here" writing location_events and routine_runs from the web:
     <allow, reusing TriggerCooldown / don't allow>
   - Location stamps on web writes: <same "Remember where things happen" switch,
     asked on a gesture / other>
   - dailySummary quota / App Check: <schedule it in the iOS repo now / later / skip>
   - Milestone split M3.1–M3.6 as proposed in the handoff: <yes / changes>
4. Fix any deploy-check findings first, as fix: commits. Then play back your plan for
   M3.1 and wait for my "go" before writing code. Once I say go, run the milestones back
   to back, TDD from the ported Swift tests, and stop for my review at the end of Phase 3.
   Hand me each commit as a ready "!" one-liner, since commits and pushes are blocked on
   this Mac.
```
