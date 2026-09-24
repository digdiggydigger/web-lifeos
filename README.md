# web-lifeos

The web companion to **ADHD LifeOS**, a browser client for the same Firebase backend as the iOS app.

- Assessment and rationale: [`docs/ios-to-web-assessment.md`](docs/ios-to-web-assessment.md)
- Working rules: [`CLAUDE.md`](CLAUDE.md)

## Develop

```bash
npm install
npm run dev
npm run check      # lint, format, typecheck, unit tests, build
```

Firebase configuration goes in `.env.local` (see `.env.example` once it exists); tests run against the Firebase Emulator Suite.
