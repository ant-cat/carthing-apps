import type { AccountView, LimitView } from '../../shared/protocol.ts';
import { Bar } from '../components/Bar';
import { agoText, money, untilText } from '../format';

function resetText(limit: LimitView, now: number): string {
  return limit.resetsAt ? `resets in ${untilText(limit.resetsAt, now)}` : 'no reset window';
}

// an empty session window says nothing, so it gives its space to the numbers that do
function worthShowing(limit: LimitView): boolean {
  return !(limit.kind === 'session' && limit.percent === 0 && !limit.resetsAt);
}

function pickHero(limits: LimitView[]): LimitView | null {
  return limits.find(limit => limit.kind === 'weekly_all') ?? limits.find(limit => limit.isActive) ?? limits[0] ?? null;
}

function footerText(account: AccountView, now: number): string {
  const age = account.readingAt ? agoText(account.readingAt, now) : null;
  if (!account.stale) return age ? `updated ${age}` : 'no reading yet';
  const why = account.stale.reason === 'expired' ? 'run claude to refresh' : account.stale.detail;
  if (!age) return why;
  return `${age === 'just now' ? 'stale' : age.replace(' ago', ' old')} · ${why}`;
}

function Hero({ limit, now }: { limit: LimitView; now: number }) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className={`font-mono text-hint tracking-[0.16em] uppercase ${limit.isActive ? 'text-near' : 'text-dim'}`}>
        {limit.label}
      </span>
      <span className="font-display text-[6.5rem] leading-[0.85] font-light tracking-display tabular-nums">
        {limit.percent}
        <span className="ml-1 text-[2.75rem] text-soft">%</span>
      </span>
      <Bar percent={limit.percent} severity={limit.severity} muted={!limit.isActive} height="h-3" />
      <span className="font-mono text-eyebrow text-dim">{resetText(limit, now)}</span>
    </div>
  );
}

function LimitRow({ limit, now }: { limit: LimitView; now: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`truncate font-mono text-eyebrow tracking-[0.16em] uppercase ${
            limit.isActive ? 'text-soft' : 'text-dim'
          }`}>
          {limit.label}
        </span>
        <span className="shrink-0 font-display text-row text-near tabular-nums">{limit.percent}%</span>
      </div>
      <Bar percent={limit.percent} severity={limit.severity} muted={!limit.isActive} height="h-1.5" />
      <div className="font-mono text-eyebrow text-dim">{resetText(limit, now)}</div>
    </div>
  );
}

function dirName(account: AccountView): string {
  return account.dir.slice(account.dir.lastIndexOf('/') + 1);
}

function Card({ account, now, solo }: { account: AccountView; now: number; solo: boolean }) {
  const extra = account.extra;
  const spend = account.spend;
  const limits = account.limits.filter(worthShowing);
  const hero = pickHero(limits);
  const rest = limits.filter(limit => limit !== hero);
  const fresh = account.stale === null;

  return (
    <section className={`flex shrink-0 flex-col gap-5 border border-rule bg-screen p-5 ${solo ? 'h-full' : 'h-122'}`}>
      {(!solo || account.plan) && (
        <header className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-mono text-eyebrow text-dim">{solo ? '' : dirName(account)}</span>
          {account.plan && (
            <span className="shrink-0 bg-accent-soft px-2 py-0.5 font-mono text-eyebrow tracking-[0.16em] text-accent uppercase">
              {account.plan}
            </span>
          )}
        </header>
      )}

      {hero ? (
        <div className={`flex flex-1 flex-col justify-center gap-8 transition-opacity ${fresh ? '' : 'opacity-45'}`}>
          <Hero limit={hero} now={now} />
          {rest.length > 0 && (
            <div className="flex flex-col gap-5">
              {rest.map(limit => (
                <LimitRow key={`${limit.kind}:${limit.label}`} limit={limit} now={now} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center font-mono text-body text-dim">
          {account.stale ? 'no reading yet' : 'waiting for the first reading'}
        </div>
      )}

      {(extra?.enabled || spend?.enabled) && (
        <div className="flex items-baseline justify-between font-mono text-hint">
          <span className="text-dim">extra usage</span>
          <span className="text-near tabular-nums">
            {spend ? money(spend.usedMinor, spend.exponent, spend.currency) : `${extra?.usedCredits ?? 0}`}
            {extra?.utilization !== null && extra?.utilization !== undefined
              ? ` · ${Math.round(extra.utilization)}%`
              : ''}
          </span>
        </div>
      )}

      <footer className="font-mono text-eyebrow text-dim">{footerText(account, now)}</footer>
    </section>
  );
}

export function UsageScreen({
  accounts,
  now,
  scroll,
  hasHost,
}: {
  accounts: AccountView[];
  now: number;
  scroll: number;
  hasHost: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <div className="grid h-full place-items-center font-mono text-body text-dim">
        {hasHost ? 'no claude accounts found on the host' : 'open the bridgething desktop app to see usage'}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <div
        className="flex h-full flex-col gap-3 will-change-transform"
        style={{ transform: `translateY(${-scroll}px)`, transition: 'transform 180ms ease-out' }}>
        {accounts.map(account => (
          <Card key={account.id} account={account} now={now} solo={accounts.length === 1} />
        ))}
      </div>
    </div>
  );
}
