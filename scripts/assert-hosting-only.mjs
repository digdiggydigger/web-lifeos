// This repo may deploy HOSTING and nothing else. Firestore rules, Storage rules and Cloud
// Functions belong to the iOS repo. Fails `npm run check` if firebase.json or the deploy script
// ever drift from that.
import { readFileSync } from 'node:fs';

const firebaseJson = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const forbidden = [
  'firestore',
  'storage',
  'functions',
  'database',
  'remoteconfig',
  'extensions',
  'dataconnect',
];
const present = forbidden.filter((key) => key in firebaseJson);
const failures = [];
if (present.length > 0) {
  failures.push(`firebase.json must contain hosting only; found: ${present.join(', ')}`);
}
if (
  !Array.isArray(firebaseJson.hosting) ||
  !firebaseJson.hosting.every((h) => h.target === 'web')
) {
  failures.push('firebase.json hosting entries must all use target "web"');
}
// Rewrites may only be the SPA fallback (last) and the same-origin proxy to the iOS repo's
// `dailySummary` Cloud Run service. A rewrite routes to a service; it never deploys one.
const ALLOWED_RUN = { serviceId: 'dailysummary', region: 'us-central1' };
for (const h of Array.isArray(firebaseJson.hosting) ? firebaseJson.hosting : []) {
  const rewrites = h.rewrites ?? [];
  for (const [index, r] of rewrites.entries()) {
    const isSpa = r.source === '**' && r.destination === '/index.html';
    const isSummary =
      r.source === '/api/daily-summary' &&
      r.run?.serviceId === ALLOWED_RUN.serviceId &&
      r.run?.region === ALLOWED_RUN.region &&
      Object.keys(r).length === 2;
    if (!isSpa && !isSummary) failures.push(`unexpected hosting rewrite: ${JSON.stringify(r)}`);
    if (isSpa && index !== rewrites.length - 1) {
      failures.push('the SPA fallback rewrite must come last, or it swallows /api/daily-summary');
    }
  }
}
if (pkg.scripts?.deploy !== 'firebase deploy --only hosting:web') {
  failures.push('package.json "deploy" must be exactly: firebase deploy --only hosting:web');
}
if (failures.length > 0) {
  console.error('Hosting-only guard failed:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('hosting-only guard: ok');
