'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PROVIDERS = [
  { id: 'mock', label: 'Mock (deterministic, no API cost)' },
  { id: 'openai', label: 'OpenAI-compatible (URL + key + model)' },
  { id: 'neurohub', label: 'Neurohub / Qwen (OpenAI-compatible endpoint)' },
] as const;

export default function LlmSettingsPage() {
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
      setErr('No project — register and sign in with DATABASE_URL configured.');
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
      setMsg('Saved. New LLM calls use this profile (running tasks keep the old model until done).');
      setApiKey('');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <main className="p-8">Loading…</main>;
  if (!session?.user) {
    return (
      <main className="p-8">
        <p className="mb-4">Sign in to edit LLM settings.</p>
        <Link href="/login" className="underline">
          Login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">LLM profile (per project)</h1>
        <Link href="/" className="text-sm underline">
          Control plane
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        For OpenAI use base URL <code className="text-xs">https://api.openai.com/v1</code>. For Neurohub use
        the base path your host documents (must end with <code className="text-xs">/v1</code> for chat
        completions).
      </p>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">API key (stored as plain text in MVP DB)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave blank to keep existing"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Model</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini or qwen-…"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  );
}
