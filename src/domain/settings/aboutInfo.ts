/** `Settings/AboutInfo.swift`: "version (build)", with an em dash for anything missing. */
export function formatAbout(version: string | undefined, build: string | undefined): string {
  return `${version ?? '—'} (${build ?? '—'})`;
}
