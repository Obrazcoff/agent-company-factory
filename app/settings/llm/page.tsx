'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';
import { Button } from '@/../components/ui/button';
import { cn } from '@/../lib/cn';

const PROVIDER_IDS = ['mock', 'openai', 'neurohub'] as const;

type PublicProfile = {
  provider: string;
  baseUrl: string | null;
  model: string | null;
  hasApiKey: boolean;
};

function providerLabel(id: (typeof PROVIDER_IDS)[number], t: (k: string) => string): string {
  if (id === 'mock') return t('settingsLlm.provMock');
  if (id === 'openai') return t('settingsLlm.provOpenai');
  return t('settingsLlm.provNeurohub');
}

const fieldClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/25 transition placeholder:text-[var(--color-muted)]/70 focus:ring-2';

export default function LlmSettingsPage() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [provider, setProvider] = useState<(typeof PROVIDER_IDS)[number]>('mock');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch('/api/me');
      const j = (await r.json()) as { defaultProjectId?: string | null };
      const id = j.defaultProjectId ?? null;
      if (cancelled) return;
      setProjectId(id);
      if (id) {
        try {
          localStorage.setItem('factory_project_id', id);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/llm`);
        const j = (await r.json()) as { profile: PublicProfile | null };
        if (cancelled) return;
        const p = j.profile;
        if (p) {
          const prov = (
            ['mock', 'openai', 'neurohub'].includes(p.provider) ? p.provider : 'mock'
          ) as (typeof PROVIDER_IDS)[number];
          setProvider(prov);
          setBaseUrl(p.baseUrl ?? '');
          setModel(p.model ?? '');
          setHasStoredKey(p.hasApiKey);
        } else {
          setProvider('mock');
          setBaseUrl('');
          setModel('');
          setHasStoredKey(false);
        }
      } catch {
        /* ignore profile fetch errors */
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!projectId) {
      setErr(t('settingsLlm.errNoProject'));
      return;
    }
    setSaving(true);
    try {
      const body =
        provider === 'mock'
          ? { provider, baseUrl: null, model: null, apiKey: null }
          : {
              provider,
              baseUrl: baseUrl.trim() || null,
              model: model.trim() || null,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            };
      const res = await fetch(`/api/projects/${projectId}/llm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; profile?: PublicProfile };
      if (!res.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      if (data.profile) {
        setHasStoredKey(data.profile.hasApiKey);
        if (provider === 'mock') {
          setBaseUrl('');
          setModel('');
          setApiKey('');
        }
      }
      setMsg(t('settingsLlm.msgSaved'));
      setApiKey('');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16 text-[var(--color-muted)]">
        {t('settingsLlm.loading')}
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="relative min-h-screen overflow-hidden px-6 py-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
            }}
          />
        </div>
        <div className="relative z-10 mx-auto max-w-md text-center">
          <p className="mb-6 text-[var(--color-muted)]">{t('settingsLlm.needSignIn')}</p>
          <Link href="/login" className="font-medium text-[var(--color-accent)] hover:underline">
            {t('settingsLlm.login')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -10%, oklch(0.55 0.14 220 / 0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, oklch(0.4 0.08 260 / 0.2), transparent)',
        }}
      />
      <div className="pointer-events-none absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pr-0 sm:pr-28">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-3xl">
            {t('settingsLlm.title')}
          </h1>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-fg)] hover:underline"
          >
            {t('settingsLlm.back')}
          </Link>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-6 shadow-[0_24px_80px_oklch(0.05_0.02_260/0.45)] backdrop-blur-md sm:p-8">
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t('settingsLlm.intro')}</p>

          {profileLoading ? (
            <p className="mt-8 text-sm text-[var(--color-muted)]">{t('settingsLlm.loadingProfile')}</p>
          ) : (
            <form onSubmit={save} className="mt-8 space-y-8">
              <div>
                <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  {t('settingsLlm.provider')}
                </label>
                <div
                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2"
                  role="radiogroup"
                  aria-label={t('settingsLlm.provider')}
                >
                  {PROVIDER_IDS.map((id) => {
                    const active = provider === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setProvider(id);
                          setMsg(null);
                          setErr(null);
                        }}
                        className={cn(
                          'flex-1 rounded-xl border px-3 py-3 text-left text-sm font-medium transition sm:min-w-[7.5rem] sm:flex-none sm:px-4',
                          active
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-fg)] ring-1 ring-[var(--color-accent)]/40'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)]/50 text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
                        )}
                      >
                        {providerLabel(id, t)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {provider === 'mock' ? (
                <div className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-2)]/40 px-4 py-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {t('settingsLlm.mockHint')}
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                    {t('settingsLlm.remoteFieldsTitle')}
                  </p>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
                      {t('settingsLlm.baseUrl')}
                    </label>
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={
                        provider === 'neurohub'
                          ? t('settingsLlm.baseUrlPlaceholderNeurohub')
                          : t('settingsLlm.baseUrlPlaceholderOpenai')
                      }
                      autoComplete="off"
                      className={cn(fieldClass, 'font-mono text-[13px]')}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
                      {t('settingsLlm.apiKey')}
                    </label>
                    {hasStoredKey && (
                      <p className="mb-2 text-xs leading-relaxed text-[var(--color-success)]">
                        {t('settingsLlm.hasKeyHint')}
                      </p>
                    )}
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t('settingsLlm.apiKeyPh')}
                      autoComplete="off"
                      className={cn(fieldClass, 'font-mono text-[13px]')}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
                      {t('settingsLlm.model')}
                    </label>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={t('settingsLlm.modelPh')}
                      autoComplete="off"
                      className={cn(fieldClass, 'font-mono text-[13px]')}
                    />
                  </div>
                </div>
              )}

              {err && (
                <p className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                  {err}
                </p>
              )}
              {msg && (
                <p className="rounded-lg border border-[var(--color-success)]/35 bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]">
                  {msg}
                </p>
              )}

              <Button
                type="submit"
                disabled={saving || profileLoading}
                className="h-11 w-full text-base sm:w-auto sm:min-w-[10rem]"
              >
                {saving ? t('settingsLlm.saving') : t('settingsLlm.save')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
