import { COLOR_TOKENS } from '@/theme/tokens';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';

/** Dev-only: every colour token as a live swatch, so both appearances can be eyeballed. */
export function TokensPage() {
  return (
    <>
      <PageHeader
        title="Tokens"
        subtitle={`${COLOR_TOKENS.length} colour sets from the iOS asset catalog`}
      />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {COLOR_TOKENS.map((token) => (
          <li key={token.name}>
            <Card className="p-2">
              <div
                className="h-16 rounded-card border border-card-border"
                style={{ backgroundColor: `var(--color-${token.name})` }}
              />
              <p className="mt-2 font-mono text-xs">{token.name}</p>
              <p className="font-mono text-xs text-label-tertiary">
                {token.light} / {token.dark}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
