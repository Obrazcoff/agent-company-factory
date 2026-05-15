'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';

export default function RegisterPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = (await res.json()) as { error?: string; projectId?: string };
      if (!res.ok) {
        setError(data.error ?? t('register.errFailed'));
        return;
      }
      if (data.projectId) {
        try {
          localStorage.setItem('factory_project_id', data.projectId);
        } catch {
          /* ignore */
        }
      }
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto max-w-md p-8">
      <div className="absolute right-8 top-8">
        <LanguageSwitcher />
      </div>
      <h1 className="text-xl font-semibold mb-6">{t('register.title')}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('register.nameOptional')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('register.email')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('register.password')}</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? t('register.creating') : t('register.submit')}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="underline">
          {t('register.signIn')}
        </Link>
      </p>
    </main>
  );
}
