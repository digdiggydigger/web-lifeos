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
if (pkg.scripts?.deploy !== 'firebase deploy --only hosting:web') {
  failures.push('package.json "deploy" must be exactly: firebase deploy --only hosting:web');
}
if (failures.length > 0) {
  console.error('Hosting-only guard failed:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('hosting-only guard: ok');
