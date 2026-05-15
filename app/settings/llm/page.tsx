'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';

const PROVIDER_IDS = ['mock', 'openai', 'neurohub'] as const;

function providerLabel(id: (typeof PROVIDER_IDS)[number], t: (k: string) => string): string {
  if (id === 'mock') return t('settingsLlm.provMock');
  if (id === 'openai') return t('settingsLlm.provOpenai');
  return t('settingsLlm.provNeurohub');
}

export default function LlmSettingsPage() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('mock');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me');
      const j = (await r.json()) as { defaultProjectId?: string | null };
      const id = j.defaultProjectId ?? null;
      setProjectId(id);
      if (id) {
        try {
          localStorage.setItem('factory_project_id', id);
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

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
      const res = await fetch(`/api/projects/${projectId}/llm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          baseUrl: baseUrl.trim() || null,
          model: model.trim() || null,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setMsg(t('settingsLlm.msgSaved'));
      setApiKey('');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <main className="p-8">{t('settingsLlm.loading')}</main>;
  if (!session?.user) {
    return (
      <main className="p-8">
        <p className="mb-4">{t('settingsLlm.needSignIn')}</p>
        <Link href="/login" className="underline">
          {t('settingsLlm.login')}
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-lg space-y-6 p-8">
      <div className="absolute right-8 top-8">
        <LanguageSwitcher />
      </div>
      <div className="flex items-center justify-between gap-4 pr-24">
        <h1 className="text-xl font-semibold">{t('settingsLlm.title')}</h1>
        <Link href="/" className="shrink-0 text-sm underline">
          {t('settingsLlm.back')}
        </Link>
      </div>
      <p className="text-sm text-gray-600">{t('settingsLlm.intro')}</p>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-600">{t('settingsLlm.provider')}</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {providerLabel(id, t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">{t('settingsLlm.baseUrl')}</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === 'neurohub'
                ? t('settingsLlm.baseUrlPlaceholderNeurohub')
                : t('settingsLlm.baseUrlPlaceholderOpenai')
            }
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">{t('settingsLlm.apiKey')}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('settingsLlm.apiKeyPh')}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">{t('settingsLlm.model')}</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t('settingsLlm.modelPh')}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t('settingsLlm.saving') : t('settingsLlm.save')}
        </button>
      </form>
    </main>
  );
}
