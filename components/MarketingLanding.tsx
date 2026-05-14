import Link from 'next/link';

/** Публичный лендинг до входа — тёмная сетка, акцент, CTA на login/register. */
export function MarketingLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.22 0.04 260 / 0.9), oklch(0.14 0.03 260 / 0.95)),
            radial-gradient(ellipse 80% 50% at 20% -10%, oklch(0.55 0.2 250), transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 20%, oklch(0.45 0.18 200), transparent 50%),
            radial-gradient(ellipse 50% 35% at 50% 100%, oklch(0.35 0.12 280), transparent 45%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-[var(--color-fg)] hover:opacity-90"
        >
          Agent Company Factory
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-medium text-black hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <div className="max-w-2xl space-y-6">
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            MVP control plane
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[var(--color-fg)] md:text-5xl md:leading-[1.1]">
            One goal → a company of agents that actually runs.
          </h1>
          <p className="text-base text-[var(--color-muted)] md:text-lg">
            Blueprint, roles, orchestrator ticks, approvals, and cost — wired for a clean swap to real LLMs
            and connectors. Sign in to spin up a demo company on your project.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_24px_oklch(0.65_0.15_220/0.35)] hover:opacity-95"
            >
              Try the console
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
            >
              Create account
            </Link>
          </div>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { t: 'Goal → blueprint', d: 'Mission, KPIs, budget, and initial task graph from one prompt.' },
            { t: 'Human in the loop', d: 'Approvals and pause/cancel before anything risky ships.' },
            { t: 'Observable spend', d: 'Per-agent cost and audit trail while the orchestrator ticks.' },
          ].map((x) => (
            <li
              key={x.t}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 backdrop-blur-sm"
            >
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">{x.t}</h2>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{x.d}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
