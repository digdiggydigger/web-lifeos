// The spacing grid is 4 / 8 / 16 / 24 px (CLAUDE.md design rule 2), so the Tailwind steps
// 1, 2, 4 and 6 (and 8-multiples above) are allowed for padding, margin and gap; the off-grid
// steps 0.5, 1.5, 2.5, 3 (12px), 3.5, 5 (20px) and arbitrary pixel values are not.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const PROPS =
  '(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)';
const BANNED_STEPS = '(?:0\\.5|1\\.5|2\\.5|3|3\\.5|5)';
const banned = new RegExp(`(?<![\\w-])-?${PROPS}-${BANNED_STEPS}(?![\\w.])`, 'g');
const arbitraryPx = new RegExp(`(?<![\\w-])-?${PROPS}-\\[\\d+(?:\\.\\d+)?px\\]`, 'g');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const failures = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const re of [banned, arbitraryPx]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        failures.push(`${file.replace(ROOT, 'src/')}:${i + 1}: off-grid spacing "${m[0]}"`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error('Spacing grid violations (allowed steps: 1, 2, 4, 6 and multiples of 8px):');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('spacing grid: ok');
