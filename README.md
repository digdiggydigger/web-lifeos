# web-lifeos

The web companion to **ADHD LifeOS**, a browser client for the same Firebase backend as the iOS app.

- Assessment and rationale: [`docs/ios-to-web-assessment.md`](docs/ios-to-web-assessment.md)
- Working rules: [`CLAUDE.md`](CLAUDE.md)
- Deploying: [`docs/DEPLOY.md`](docs/DEPLOY.md)

## Develop

```bash
npm install
npm run dev
npm run check      # lint, format, typecheck, unit tests, build
```

Firebase configuration goes in `.env.local` (see `.env.example`). Tests run against the Firebase Emulator Suite: `npm run test:emulator` for the data layer, `npm run test:e2e` for Playwright journeys, `npm run dev:emulator` for local development without the real project.
